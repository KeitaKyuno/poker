import { NextResponse } from 'next/server'

import { verifyPin } from '@/lib/auth/pin'
import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { PatchSessionRequestSchema } from '@/lib/validation/schemas'

type SessionRow = {
  id: string
  player_id: string
  session_date: string
  total_cashout_amount: number | null
  status: 'in_progress' | 'closed'
  created_at: string
  updated_at: string
}

type SessionTotalsRow = {
  session_id: string
  total_buyin_amount: number
  net_profit: number | null
}

function toSession(session: SessionRow, totals: SessionTotalsRow | null) {
  return {
    id: session.id,
    playerId: session.player_id,
    sessionDate: session.session_date,
    totalBuyinAmount: totals?.total_buyin_amount ?? 0,
    totalCashoutAmount: session.total_cashout_amount,
    netProfit: totals?.net_profit ?? null,
    status: session.status,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  }
}

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params
  const supabase = createServiceClient()

  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('id,player_id,session_date,total_cashout_amount,status,created_at,updated_at')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>()

  if (sessionError) {
    return Errors.INTERNAL()
  }

  if (!sessionRow) {
    return Errors.NOT_FOUND('Session not found')
  }

  const { data: totalsRow, error: totalsError } = await supabase
    .from('v_session_buyin_totals')
    .select('session_id,total_buyin_amount,net_profit')
    .eq('session_id', sessionId)
    .maybeSingle<SessionTotalsRow>()

  if (totalsError) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({ session: toSession(sessionRow, totalsRow) })
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  let parsed

  try {
    const body = await request.json()
    parsed = PatchSessionRequestSchema.parse(body)
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  if (parsed.status === 'in_progress') {
    // セッションを再開する場合、以前の total_cashout_amount は null にリセットされる。
    parsed = {
      ...parsed,
      totalCashoutAmount: null,
    }
  }

  const { sessionId } = await context.params
  const supabase = createServiceClient()

  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('id,player_id,session_date,total_cashout_amount,status,created_at,updated_at')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>()

  if (sessionError) {
    return Errors.INTERNAL()
  }

  if (!sessionRow) {
    return Errors.NOT_FOUND('Session not found')
  }

  if (sessionRow.player_id !== parsed.playerId) {
    return Errors.UNAUTHORIZED('Player mismatch')
  }

  const { data: playerRow, error: playerError } = await supabase
    .from('players')
    .select('password_hash')
    .eq('id', parsed.playerId)
    .maybeSingle<{ password_hash: string }>()

  if (playerError || !playerRow) {
    return Errors.INTERNAL()
  }

  const isValid = await verifyPin(parsed.pin, playerRow.password_hash)
  if (!isValid) {
    return Errors.INVALID_PIN()
  }

  const updatePayload: {
    session_date?: string
    status?: 'in_progress' | 'closed'
    total_cashout_amount?: number | null
  } = {}

  if (parsed.sessionDate !== undefined) {
    updatePayload.session_date = parsed.sessionDate
  }
  if (parsed.status !== undefined) {
    updatePayload.status = parsed.status
  }
  if (parsed.totalCashoutAmount !== undefined) {
    updatePayload.total_cashout_amount = parsed.totalCashoutAmount
  }

  if (Object.keys(updatePayload).length === 0) {
    return Errors.BAD_REQUEST('No fields to update')
  }

  const { data: updatedSession, error: updateError } = await supabase
    .from('sessions')
    .update(updatePayload)
    .eq('id', sessionId)
    .select('id,player_id,session_date,total_cashout_amount,status,created_at,updated_at')
    .single<SessionRow>()

  if (updateError || !updatedSession) {
    return Errors.BAD_REQUEST(updateError?.message ?? 'Failed to update session')
  }

  const { data: totalsRow, error: totalsError } = await supabase
    .from('v_session_buyin_totals')
    .select('session_id,total_buyin_amount,net_profit')
    .eq('session_id', sessionId)
    .maybeSingle<SessionTotalsRow>()

  if (totalsError) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({ session: toSession(updatedSession, totalsRow) })
}
