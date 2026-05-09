import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import type { TournamentTimerState } from '@/types'

type TournamentRow = {
  id: string
  date: string
  created_at: string
  timer_state: TournamentTimerState | null
}

type EntryRow = {
  player_id: string
  starting_level: number
  players: {
    name: string
  } | null
}

type BlindRow = {
  level: number
  sb: number
  bb: number
  ante: number
  duration_minutes: number
}

type ResultRow = {
  player_id: string
  rank: number
  players: {
    name: string
  } | null
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = createServiceClient()

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id,date,created_at,timer_state')
    .eq('id', id)
    .maybeSingle<TournamentRow>()

  if (tournamentError) {
    return Errors.INTERNAL()
  }

  if (!tournament) {
    return Errors.NOT_FOUND('Tournament not found')
  }

  const { data: entries, error: entriesError } = await supabase
    .from('tournament_entries')
    .select('player_id,starting_level,players(name)')
    .eq('tournament_id', id)
    .returns<EntryRow[]>()

  if (entriesError) {
    return Errors.INTERNAL()
  }

  const { data: blinds, error: blindsError } = await supabase
    .from('tournament_blinds')
    .select('level,sb,bb,ante,duration_minutes')
    .eq('tournament_id', id)
    .order('level', { ascending: true })
    .returns<BlindRow[]>()

  if (blindsError) {
    return Errors.INTERNAL()
  }

  const { data: results, error: resultsError } = await supabase
    .from('tournament_results')
    .select('player_id,rank,players(name)')
    .eq('tournament_id', id)
    .order('rank', { ascending: true })
    .returns<ResultRow[]>()

  if (resultsError) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      date: tournament.date,
      createdAt: tournament.created_at,
      entries: (entries ?? []).map((entry) => ({
        playerId: entry.player_id,
        playerName: entry.players?.name ?? 'Unknown',
        startingLevel: entry.starting_level,
      })),
      blinds: (blinds ?? []).map((blind) => ({
        level: blind.level,
        sb: blind.sb,
        bb: blind.bb,
        ante: blind.ante,
        durationMinutes: blind.duration_minutes,
      })),
      results: (results ?? []).map((result) => ({
        playerId: result.player_id,
        playerName: result.players?.name ?? 'Unknown',
        rank: result.rank,
      })),
      timerState: tournament.timer_state as TournamentTimerState | null,
    },
  })
}
