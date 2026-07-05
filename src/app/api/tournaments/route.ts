import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { PostTournamentsRequestSchema } from '@/lib/validation/schemas'

type TournamentRow = {
  id: string
  date: string
  status: 'active' | 'finished'
  created_at: string
}

type TournamentStatus = 'active' | 'finished'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')

  if (statusParam !== null && statusParam !== 'active' && statusParam !== 'finished') {
    return Errors.BAD_REQUEST('Invalid status parameter')
  }

  const supabase = createServiceClient()
  let query = supabase
    .from('tournaments')
    .select('id,date,status,created_at')
    .order('date', { ascending: false })

  if (statusParam) {
    query = query.eq('status', statusParam as TournamentStatus)
  }

  const { data, error } = await query.returns<TournamentRow[]>()

  if (error) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({
    tournaments: (data ?? []).map((tournament) => ({
      id: tournament.id,
      date: tournament.date,
      status: tournament.status,
      createdAt: tournament.created_at,
    })),
  })
}

export async function POST(request: Request) {
  let parsed

  try {
    parsed = PostTournamentsRequestSchema.parse(await request.json())
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const playerMap = new Map<string, number>()
  for (const player of parsed.players) {
    if (!playerMap.has(player.playerId)) {
      playerMap.set(player.playerId, player.startingLevel)
    }
  }
  const uniquePlayers = [...playerMap.entries()].map(([playerId, startingLevel]) => ({ playerId, startingLevel }))

  if (uniquePlayers.length < 1) {
    return Errors.BAD_REQUEST('players must contain at least one player')
  }

  if (parsed.blinds.length < 1) {
    return Errors.BAD_REQUEST('blinds must contain at least one level')
  }

  const supabase = createServiceClient()

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .insert({ date: parsed.date })
    .select('id,date,created_at')
    .single<TournamentRow>()

  if (tournamentError || !tournament) {
    if (tournamentError?.code === '23505') {
      return Errors.BAD_REQUEST('この日付のトーナメントは既に存在します')
    }
    return Errors.INTERNAL()
  }

  const { error: entryError } = await supabase.from('tournament_entries').insert(
    uniquePlayers.map((player) => ({
      tournament_id: tournament.id,
      player_id: player.playerId,
      starting_level: player.startingLevel,
    }))
  )

  if (entryError) {
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    return Errors.BAD_REQUEST(entryError.message)
  }

  const { error: blindError } = await supabase.from('tournament_blinds').insert(
    parsed.blinds.map((blind) => ({
      tournament_id: tournament.id,
      level: blind.level,
      sb: blind.sb,
      bb: blind.bb,
      ante: blind.ante,
      duration_minutes: blind.durationMinutes,
    }))
  )

  if (blindError) {
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    return Errors.BAD_REQUEST(blindError.message)
  }

  return NextResponse.json(
    {
      tournament: {
        id: tournament.id,
        date: tournament.date,
        createdAt: tournament.created_at,
      },
    },
    { status: 201 }
  )
}
