import { NextResponse } from 'next/server'

import { verifyPin } from '@/lib/auth/pin'
import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { DeleteBuyinRequestSchema, PatchBuyinRequestSchema } from '@/lib/validation/schemas'

type BuyinRow = {
  id: string
  session_id: string
  entry_type: 'initial' | 'reentry'
  amount: number
  idempotency_key: string
  recorded_at: string
}

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

function toBuyin(row: BuyinRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    entryType: row.entry_type,
    amount: row.amount,
    idempotencyKey: row.idempotency_key,
    recordedAt: row.recorded_at,
  }
}

async function getSessionWithChecks(
  supabase: ReturnType<typeof createServiceClient>,
  buyinId: string,
  playerId: string,
  pin: string
): Promise<{ session: SessionRow; buyin: BuyinRow } | Response> {
  const { data: buyinRow, error: buyinError } = await supabase
    .from('buyins')
    .select('id,session_id,entry_type,amount,idempotency_key,recorded_at')
    .eq('id', buyinId)
    .maybeSingle<BuyinRow>()

  if (buyinError) {
    return Errors.INTERNAL()
  }

  if (!buyinRow) {
    return Errors.NOT_FOUND('Buyin not found')
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('id,player_id,session_date,total_cashout_amount,status,created_at,updated_at')
    .eq('id', buyinRow.session_id)
    .maybeSingle<SessionRow>()

  if (sessionError) {
    return Errors.INTERNAL()
  }

  if (!sessionRow) {
    return Errors.NOT_FOUND('Session not found')
  }

  if (sessionRow.status !== 'in_progress') {
    return Errors.SESSION_CLOSED()
  }

  if (sessionRow.player_id !== playerId) {
    return Errors.UNAUTHORIZED('Player mismatch')
  }

  const { data: playerRow, error: playerError } = await supabase
    .from('players')
    .select('password_hash')
    .eq('id', playerId)
    .maybeSingle<{ password_hash: string }>()

  if (playerError || !playerRow) {
    return Errors.INTERNAL()
  }

  const isValid = await verifyPin(pin, playerRow.password_hash)
  if (!isValid) {
    return Errors.INVALID_PIN()
  }

  return { session: sessionRow, buyin: buyinRow }
}

export async function PATCH(request: Request, context: { params: Promise<{ buyinId: string }> }) {
  let parsed

  try {
    const body = await request.json()
    parsed = PatchBuyinRequestSchema.parse(body)
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const { buyinId } = await context.params
  const supabase = createServiceClient()
  const checked = await getSessionWithChecks(supabase, buyinId, parsed.playerId, parsed.pin)

  if (checked instanceof Response) {
    return checked
  }

  const { session } = checked
  const { data: updatedBuyin, error: updateError } = await supabase
    .from('buyins')
    .update({ amount: parsed.amount })
    .eq('id', buyinId)
    .select('id,session_id,entry_type,amount,idempotency_key,recorded_at')
    .single<BuyinRow>()

  if (updateError || !updatedBuyin) {
    return Errors.BAD_REQUEST(updateError?.message ?? 'Failed to update buyin')
  }

  const { data: totalsRow, error: totalsError } = await supabase
    .from('v_session_buyin_totals')
    .select('session_id,total_buyin_amount,net_profit')
    .eq('session_id', session.id)
    .maybeSingle<SessionTotalsRow>()

  if (totalsError) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({
    session: toSession(session, totalsRow),
    buyin: toBuyin(updatedBuyin),
  })
}

export async function DELETE(request: Request, context: { params: Promise<{ buyinId: string }> }) {
  let parsed

  try {
    const body = await request.json()
    parsed = DeleteBuyinRequestSchema.parse(body)
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const { buyinId } = await context.params
  const supabase = createServiceClient()
  const checked = await getSessionWithChecks(supabase, buyinId, parsed.playerId, parsed.pin)

  if (checked instanceof Response) {
    return checked
  }

  const { session } = checked
  const { error: deleteError } = await supabase.from('buyins').delete().eq('id', buyinId)

  if (deleteError) {
    return Errors.BAD_REQUEST(deleteError.message)
  }

  const { data: totalsRow, error: totalsError } = await supabase
    .from('v_session_buyin_totals')
    .select('session_id,total_buyin_amount,net_profit')
    .eq('session_id', session.id)
    .maybeSingle<SessionTotalsRow>()

  if (totalsError) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({
    session: toSession(session, totalsRow),
    deletedBuyinId: buyinId,
  })
}
