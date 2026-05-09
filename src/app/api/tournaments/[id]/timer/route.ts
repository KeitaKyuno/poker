import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'

type TournamentTimerState = {
  currentLevelIndex: number
  currentLevelStartTimestamp: number
  isPaused: boolean
  pausedRemainingSeconds: number | null
}

type PatchBody = {
  timerState: TournamentTimerState | null
}

function isTimerStateLike(value: unknown): value is TournamentTimerState {
  return typeof value === 'object' && value !== null
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  let body: PatchBody | null
  try {
    body = (await request.json()) as PatchBody | null
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  if (typeof body !== 'object' || body === null || !('timerState' in body)) {
    return Errors.BAD_REQUEST('timerState is required')
  }

  if (body.timerState !== null && !isTimerStateLike(body.timerState)) {
    return Errors.BAD_REQUEST('timerState must be null or object')
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('tournaments').update({ timer_state: body.timerState }).eq('id', id)

  if (error) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({ ok: true })
}
