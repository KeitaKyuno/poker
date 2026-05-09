import { NextResponse } from 'next/server'

import { verifyPin } from '@/lib/auth/pin'
import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { PostSessionBuyinsRequestSchema } from '@/lib/validation/schemas'

type SessionRow = {
  id: string
  player_id: string
  session_date: string
  total_cashout_amount: number | null
  status: 'in_progress' | 'closed'
  created_at: string
  updated_at: string
}

type BuyinRow = {
  id: string
  session_id: string
  entry_type: 'initial' | 'reentry'
  amount: number
  idempotency_key: string
  recorded_at: string
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

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  let parsed

  try {
    const body = await request.json()
    parsed = PostSessionBuyinsRequestSchema.parse(body)
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
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

  if (sessionRow.status !== 'in_progress') {
    return Errors.SESSION_CLOSED()
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

  const { data: buyinRow, error: buyinError } = await supabase
    .from('buyins')
    .insert({
      session_id: sessionId,
      entry_type: 'reentry',
      amount: parsed.amount,
      idempotency_key: parsed.idempotencyKey,
    })
    .select('id,session_id,entry_type,amount,idempotency_key,recorded_at')
    .single<BuyinRow>()

  if (buyinError?.code === '23505') {
    return Errors.DUPLICATE_ENTRY()
  }

  if (buyinError || !buyinRow) {
    return Errors.INTERNAL()
  }

  const { data: totalsRow, error: totalsError } = await supabase
    .from('v_session_buyin_totals')
    .select('session_id,total_buyin_amount,net_profit')
    .eq('session_id', sessionId)
    .maybeSingle<SessionTotalsRow>()

  if (totalsError) {
    return Errors.INTERNAL()
  }

  return NextResponse.json(
    {
      session: toSession(sessionRow, totalsRow),
      buyin: toBuyin(buyinRow),
    },
    { status: 201 }
  )
}
