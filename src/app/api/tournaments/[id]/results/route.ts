import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { PostTournamentResultsRequestSchema } from '@/lib/validation/schemas'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let parsed

  try {
    parsed = PostTournamentResultsRequestSchema.parse(await request.json())
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const { id } = await context.params
  const supabase = createServiceClient()

  const { error } = await supabase.from('tournament_results').upsert(
    parsed.results.map((result) => ({
      tournament_id: id,
      player_id: result.playerId,
      rank: result.rank,
    })),
    { onConflict: 'tournament_id,player_id' }
  )

  if (error) {
    return Errors.BAD_REQUEST(error.message)
  }

  const { error: updateError } = await supabase.from('tournaments').update({ status: 'finished' }).eq('id', id)
  if (updateError) {
    return Errors.BAD_REQUEST(updateError.message)
  }

  return NextResponse.json({
    results: parsed.results.map((result) => ({
      playerId: result.playerId,
      rank: result.rank,
    })),
  })
}
