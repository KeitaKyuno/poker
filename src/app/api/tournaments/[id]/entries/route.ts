import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { PostTournamentEntryRequestSchema } from '@/lib/validation/schemas'

type PlayerRow = {
  name: string
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  let parsed
  try {
    parsed = PostTournamentEntryRequestSchema.parse(await request.json())
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const supabase = createServiceClient()

  const { data: existingEntry, error: existingEntryError } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', id)
    .eq('player_id', parsed.playerId)
    .maybeSingle<{ id: string }>()

  if (existingEntryError) {
    return Errors.INTERNAL()
  }

  if (existingEntry) {
    return Errors.BAD_REQUEST('Player is already entered in this tournament')
  }

  const { error: insertError } = await supabase.from('tournament_entries').insert({
    tournament_id: id,
    player_id: parsed.playerId,
    starting_level: parsed.startingLevel,
  })

  if (insertError) {
    return Errors.BAD_REQUEST(insertError.message)
  }

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('name')
    .eq('id', parsed.playerId)
    .maybeSingle<PlayerRow>()

  if (playerError) {
    return Errors.INTERNAL()
  }

  return NextResponse.json(
    {
      entry: {
        playerId: parsed.playerId,
        playerName: player?.name ?? 'Unknown',
        startingLevel: parsed.startingLevel,
      },
    },
    { status: 201 }
  )
}
