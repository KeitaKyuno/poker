import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'

type SessionRow = {
  id: string
  session_date: string
}

type SessionTotalsRow = {
  session_id: string
  net_profit: number | null
}

type DailyStat = {
  date: string
  netProfit: number
}

export async function GET(_request: Request, context: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await context.params
  const supabase = createServiceClient()

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id')
    .eq('id', playerId)
    .maybeSingle<{ id: string }>()

  if (playerError) {
    return Errors.INTERNAL()
  }

  if (!player) {
    return Errors.NOT_FOUND('Player not found')
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id,session_date')
    .eq('player_id', playerId)
    .eq('status', 'closed')
    .returns<SessionRow[]>()

  if (sessionsError) {
    return Errors.INTERNAL()
  }

  const sessionRows = sessions ?? []
  const sessionIds = sessionRows.map((session) => session.id)

  const { data: totalsRows, error: totalsError } = sessionIds.length
    ? await supabase
        .from('v_session_buyin_totals')
        .select('session_id,net_profit')
        .in('session_id', sessionIds)
        .returns<SessionTotalsRow[]>()
    : { data: [] as SessionTotalsRow[], error: null }

  if (totalsError) {
    return Errors.INTERNAL()
  }

  const sessionById = new Map(sessionRows.map((row) => [row.id, row]))
  const dailyNetProfit = new Map<string, number>()

  for (const row of totalsRows ?? []) {
    const session = sessionById.get(row.session_id)
    if (!session) continue

    const current = dailyNetProfit.get(session.session_date) ?? 0
    dailyNetProfit.set(session.session_date, current + (row.net_profit ?? 0))
  }

  const stats: DailyStat[] = Array.from(dailyNetProfit.entries())
    .map(([date, netProfit]) => ({ date, netProfit }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ stats })
}
