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

  const { data: tournamentRaw, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id,date,created_at,timer_state')
    .eq('id', id)
    .maybeSingle()
  const tournament = tournamentRaw as TournamentRow | null

  if (tournamentError) {
    console.error('[GET /api/tournaments/[id]] tournament:', tournamentError)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: tournamentError.message } }, { status: 500 })
  }

  if (!tournament) {
    return Errors.NOT_FOUND('Tournament not found')
  }

  const { data: entriesRaw, error: entriesError } = await supabase
    .from('tournament_entries')
    .select('player_id,starting_level,players(name)')
    .eq('tournament_id', id)
  const entries = (entriesRaw ?? []) as unknown as EntryRow[]

  if (entriesError) {
    console.error('[GET /api/tournaments/[id]] entries:', entriesError)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: entriesError.message } }, { status: 500 })
  }

  const { data: blindsRaw, error: blindsError } = await supabase
    .from('tournament_blinds')
    .select('level,sb,bb,ante,duration_minutes')
    .eq('tournament_id', id)
    .order('level', { ascending: true })
  const blinds = (blindsRaw ?? []) as BlindRow[]

  if (blindsError) {
    console.error('[GET /api/tournaments/[id]] blinds:', blindsError)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: blindsError.message } }, { status: 500 })
  }

  const { data: resultsRaw, error: resultsError } = await supabase
    .from('tournament_results')
    .select('player_id,rank,players(name)')
    .eq('tournament_id', id)
    .order('rank', { ascending: true })
  const results = (resultsRaw ?? []) as unknown as ResultRow[]

  if (resultsError) {
    console.error('[GET /api/tournaments/[id]] results:', resultsError)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: resultsError.message } }, { status: 500 })
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

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = createServiceClient()

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', id)
    .maybeSingle<{ id: string }>()

  if (tournamentError) {
    return Errors.INTERNAL()
  }

  if (!tournament) {
    return Errors.NOT_FOUND('Tournament not found')
  }

  const { error: deleteError } = await supabase.from('tournaments').delete().eq('id', id)

  if (deleteError) {
    return Errors.BAD_REQUEST(deleteError.message)
  }

  return NextResponse.json({ deletedTournamentId: id })
}
