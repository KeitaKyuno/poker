import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

import { verifyPin } from '@/lib/auth/pin'
import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { PostSessionsRequestSchema } from '@/lib/validation/schemas'

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

type CreateSessionWithBuyinRpcRow = {
  session_id: string
  buyin_id: string
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get('playerId')
  const statusParam = searchParams.get('status')

  if (!playerId) {
    return Errors.BAD_REQUEST('playerId is required')
  }

  if (statusParam !== null && statusParam !== 'in_progress' && statusParam !== 'closed') {
    return Errors.BAD_REQUEST('status must be in_progress or closed')
  }

  const supabase = createServiceClient()

  let sessionQuery = supabase
    .from('sessions')
    .select('id,player_id,session_date,total_cashout_amount,status,created_at,updated_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  if (statusParam !== null) {
    sessionQuery = sessionQuery.eq('status', statusParam)
  }

  const { data: sessionRows, error: sessionError } = await sessionQuery.returns<SessionRow[]>()

  if (sessionError) {
    return Errors.INTERNAL()
  }

  if (!sessionRows || sessionRows.length === 0) {
    return NextResponse.json({ sessions: [] })
  }

  const sessionIds = sessionRows.map((row) => row.id)
  const { data: totalsRows, error: totalsError } = await supabase
    .from('v_session_buyin_totals')
    .select('session_id,total_buyin_amount,net_profit')
    .in('session_id', sessionIds)
    .returns<SessionTotalsRow[]>()

  if (totalsError) {
    return Errors.INTERNAL()
  }

  const totalsBySessionId = new Map((totalsRows ?? []).map((row) => [row.session_id, row]))
  const sessions = sessionRows.map((sessionRow) => toSession(sessionRow, totalsBySessionId.get(sessionRow.id) ?? null))

  return NextResponse.json({ sessions })
}

export async function POST(request: Request) {
  let parsed

  try {
    const body = await request.json()
    parsed = PostSessionsRequestSchema.parse(body)
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const supabase = createServiceClient()

  const { data: playerRow, error: playerError } = await supabase
    .from('players')
    .select('id,password_hash')
    .eq('id', parsed.playerId)
    .maybeSingle()

  if (playerError) {
    return Errors.INTERNAL()
  }

  if (!playerRow) {
    return Errors.NOT_FOUND('Player not found')
  }

  const isValid = await verifyPin(parsed.pin, playerRow.password_hash)
  if (!isValid) {
    return Errors.INVALID_PIN()
  }

  const { data: rpcRow, error: rpcError } = await supabase
    .rpc('create_session_with_buyin', {
      p_player_id: parsed.playerId,
      p_session_date: parsed.sessionDate,
      p_session_idempotency_key: parsed.idempotencyKey,
      p_buyin_amount: parsed.initialBuyinAmount,
      p_buyin_idempotency_key: uuidv4(),
    })
    .single<CreateSessionWithBuyinRpcRow>()

  if (rpcError?.message?.includes('DUPLICATE_SESSION')) {
    return Errors.SESSION_ALREADY_IN_PROGRESS()
  }

  if (rpcError?.code === '23505') {
    return Errors.DUPLICATE_ENTRY()
  }

  if (rpcError || !rpcRow) {
    return Errors.INTERNAL()
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('id,player_id,session_date,total_cashout_amount,status,created_at,updated_at')
    .eq('id', rpcRow.session_id)
    .maybeSingle<SessionRow>()

  if (sessionError || !sessionRow) {
    return Errors.INTERNAL()
  }

  const { data: buyinRow, error: buyinError } = await supabase
    .from('buyins')
    .select('id,session_id,entry_type,amount,idempotency_key,recorded_at')
    .eq('id', rpcRow.buyin_id)
    .maybeSingle<BuyinRow>()

  if (buyinError || !buyinRow) {
    return Errors.INTERNAL()
  }

  const { data: totalsRow, error: totalsError } = await supabase
    .from('v_session_buyin_totals')
    .select('session_id,total_buyin_amount,net_profit')
    .eq('session_id', rpcRow.session_id)
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
