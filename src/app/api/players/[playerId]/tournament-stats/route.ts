import { NextResponse } from 'next/server'
import { z } from 'zod'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { buildTournamentStats, type TournamentEntryPointRow } from '@/lib/tournament-points'

export async function GET(_: Request, context: { params: Promise<{ playerId: string }> }) {
  let playerId: string | undefined

  try {
    const params = await context.params
    const parsedPlayerId = z.string().uuid().safeParse(params.playerId)

    if (!parsedPlayerId.success) {
      return Errors.BAD_REQUEST('playerId must be a valid UUID')
    }

    playerId = parsedPlayerId.data

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('v_tournament_entry_points')
      .select('tournament_id,rank,points,tournament_date')
      .eq('player_id', playerId)
      .order('tournament_date', { ascending: true })
      .returns<TournamentEntryPointRow[]>()

    if (error) {
      throw error
    }

    return NextResponse.json({
      stats: buildTournamentStats(data ?? []),
    })
  } catch (error) {
    console.error('Failed to fetch tournament stats', {
      playerId,
      error,
    })

    return Errors.INTERNAL()
  }
}
