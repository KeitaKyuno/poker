import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  verifyPin: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/validation/schemas', () => ({
  PostSessionsRequestSchema: {
    parse: mocks.parse,
  },
}))

vi.mock('@/lib/auth/pin', () => ({
  verifyPin: mocks.verifyPin,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}))

import { POST } from './route'

type QueueItem = { data?: unknown; error?: { code?: string; message?: string } | null }

function buildSupabaseMock(queue: QueueItem[]) {
  const state = { queue }
  const next = () => {
    const item = state.queue.shift()
    if (!item) return { data: null, error: null }
    return { data: item.data ?? null, error: item.error ?? null }
  }

  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => next()),
    single: vi.fn(async () => next()),
    returns: vi.fn(async () => next()),
  }

  return {
    from: vi.fn(() => query),
    rpc: vi.fn(() => query),
  }
}

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes buyinIdempotencyKey from request to RPC', async () => {
    mocks.parse.mockReturnValue({
      playerId: '11111111-1111-1111-1111-111111111111',
      pin: '1234',
      sessionDate: '2026-09-17',
      initialBuyinAmount: 1000,
      idempotencyKey: '22222222-2222-2222-2222-222222222222',
      buyinIdempotencyKey: '33333333-3333-3333-3333-333333333333',
    })

    mocks.verifyPin.mockResolvedValue(true)

    const supabase = buildSupabaseMock([
      { data: { id: '11111111-1111-1111-1111-111111111111', password_hash: 'hash' } },
      { data: { session_id: '44444444-4444-4444-4444-444444444444', buyin_id: '55555555-5555-5555-5555-555555555555' } },
      { data: { id: '44444444-4444-4444-4444-444444444444', player_id: '11111111-1111-1111-1111-111111111111', session_date: '2026-09-17', total_cashout_amount: null, status: 'in_progress', created_at: '2026-09-17T00:00:00.000Z', updated_at: '2026-09-17T00:00:00.000Z' } },
      { data: { id: '55555555-5555-5555-5555-555555555555', session_id: '44444444-4444-4444-4444-444444444444', entry_type: 'initial', amount: 1000, idempotency_key: '33333333-3333-3333-3333-333333333333', recorded_at: '2026-09-17T00:00:00.000Z' } },
      { data: { session_id: '44444444-4444-4444-4444-444444444444', total_buyin_amount: 1000, net_profit: null } },
    ])

    mocks.createServiceClient.mockReturnValue(supabase)

    const response = await POST(new Request('http://localhost/api/sessions', { method: 'POST', body: JSON.stringify({}) }))
    expect(response.status).toBe(201)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_session_with_buyin',
      expect.objectContaining({ p_buyin_idempotency_key: '33333333-3333-3333-3333-333333333333' })
    )
  })

  it('maps INVALID_AMOUNT RPC error to bad request', async () => {
    mocks.parse.mockReturnValue({
      playerId: '11111111-1111-1111-1111-111111111111',
      pin: '1234',
      sessionDate: '2026-09-17',
      initialBuyinAmount: 1000,
      idempotencyKey: '22222222-2222-2222-2222-222222222222',
      buyinIdempotencyKey: '33333333-3333-3333-3333-333333333333',
    })

    mocks.verifyPin.mockResolvedValue(true)

    const supabase = buildSupabaseMock([
      { data: { id: '11111111-1111-1111-1111-111111111111', password_hash: 'hash' } },
      { error: { code: 'P0001', message: 'INVALID_AMOUNT' } },
    ])

    mocks.createServiceClient.mockReturnValue(supabase)

    const response = await POST(new Request('http://localhost/api/sessions', { method: 'POST', body: JSON.stringify({}) }))
    expect(response.status).toBe(400)
  })

  it('maps DUPLICATE_SESSION RPC error to conflict', async () => {
    mocks.parse.mockReturnValue({
      playerId: '11111111-1111-1111-1111-111111111111',
      pin: '1234',
      sessionDate: '2026-09-17',
      initialBuyinAmount: 1000,
      idempotencyKey: '22222222-2222-2222-2222-222222222222',
      buyinIdempotencyKey: '33333333-3333-3333-3333-333333333333',
    })

    mocks.verifyPin.mockResolvedValue(true)

    const supabase = buildSupabaseMock([
      { data: { id: '11111111-1111-1111-1111-111111111111', password_hash: 'hash' } },
      { error: { code: 'P0001', message: 'DUPLICATE_SESSION: session already in progress' } },
    ])

    mocks.createServiceClient.mockReturnValue(supabase)

    const response = await POST(new Request('http://localhost/api/sessions', { method: 'POST', body: JSON.stringify({}) }))
    expect(response.status).toBe(409)
  })

  it('maps 23505 with one-in-progress constraint to conflict', async () => {
    mocks.parse.mockReturnValue({
      playerId: '11111111-1111-1111-1111-111111111111',
      pin: '1234',
      sessionDate: '2026-09-17',
      initialBuyinAmount: 1000,
      idempotencyKey: '22222222-2222-2222-2222-222222222222',
      buyinIdempotencyKey: '33333333-3333-3333-3333-333333333333',
    })

    mocks.verifyPin.mockResolvedValue(true)

    const supabase = buildSupabaseMock([
      { data: { id: '11111111-1111-1111-1111-111111111111', password_hash: 'hash' } },
      {
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "sessions_one_in_progress_per_player_idx"',
        },
      },
    ])

    mocks.createServiceClient.mockReturnValue(supabase)

    const response = await POST(new Request('http://localhost/api/sessions', { method: 'POST', body: JSON.stringify({}) }))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SESSION_ALREADY_IN_PROGRESS' },
    })
  })

  it('maps 23505 with other constraints to duplicate entry conflict', async () => {
    mocks.parse.mockReturnValue({
      playerId: '11111111-1111-1111-1111-111111111111',
      pin: '1234',
      sessionDate: '2026-09-17',
      initialBuyinAmount: 1000,
      idempotencyKey: '22222222-2222-2222-2222-222222222222',
      buyinIdempotencyKey: '33333333-3333-3333-3333-333333333333',
    })

    mocks.verifyPin.mockResolvedValue(true)

    const supabase = buildSupabaseMock([
      { data: { id: '11111111-1111-1111-1111-111111111111', password_hash: 'hash' } },
      {
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "sessions_idempotency_key_key"',
        },
      },
    ])

    mocks.createServiceClient.mockReturnValue(supabase)

    const response = await POST(new Request('http://localhost/api/sessions', { method: 'POST', body: JSON.stringify({}) }))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'DUPLICATE_ENTRY' },
    })
  })
})
