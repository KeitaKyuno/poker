import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'

type TournamentStatRow = {
  tournament_id: string
  rank: number
  tournaments: {
    date: string
  } | null
}

type TournamentEntryRow = {
  tournament_id: string
}

function calculatePoints(rank: number, entryCount: number) {
  if (rank === 1) return 10
  if (rank === 2) return 5
  if (rank === 3 && entryCount >= 3) return 3
  if (rank === 4 && entryCount >= 6) return 2
  if (rank === 5 && entryCount >= 8) return 1
  return 0
}

export async function GET(_: Request, context: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await context.params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('tournament_results')
    .select('tournament_id,rank,tournaments(date)')
    .eq('player_id', playerId)
    .order('date', { referencedTable: 'tournaments', ascending: true })
    .returns<TournamentStatRow[]>()

  if (error) {
    return Errors.BAD_REQUEST(error.message)
  }

  const tournamentIds = Array.from(new Set((data ?? []).map((row) => row.tournament_id)))
  const entryCountByTournamentId = new Map<string, number>()

  if (tournamentIds.length > 0) {
    const { data: entries, error: entriesError } = await supabase
      .from('tournament_entries')
      .select('tournament_id')
      .in('tournament_id', tournamentIds)
      .returns<TournamentEntryRow[]>()

    if (entriesError) {
      return Errors.BAD_REQUEST(entriesError.message)
    }

    for (const entry of entries ?? []) {
      entryCountByTournamentId.set(
        entry.tournament_id,
        (entryCountByTournamentId.get(entry.tournament_id) ?? 0) + 1,
      )
    }
  }

  return NextResponse.json({
    stats: (data ?? []).map((row) => ({
      tournamentId: row.tournament_id,
      date: row.tournaments?.date ?? '',
      rank: row.rank,
      points: calculatePoints(row.rank, entryCountByTournamentId.get(row.tournament_id) ?? 0),
    })),
  })
}
