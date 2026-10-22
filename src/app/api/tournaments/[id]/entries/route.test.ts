import { afterEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}))

afterEach(() => {
  vi.clearAllMocks()
})

const validBody = {
  playerId: '11111111-1111-4111-8111-111111111111',
  startingLevel: 1,
}

const validTournamentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('POST /api/tournaments/[id]/entries', () => {
  it('finishedトーナメントなら409を返しinsertを呼ばない', async () => {
    const insert = vi.fn()

    const maybeSingleTournament = vi.fn().mockResolvedValueOnce({
      data: { status: 'finished' },
      error: null,
    })
    const eqTournamentId = vi.fn().mockReturnValue({ maybeSingle: maybeSingleTournament })
    const selectTournament = vi.fn().mockReturnValue({ eq: eqTournamentId })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') return { select: selectTournament }
      if (table === 'tournament_entries') return { insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    const request = new Request('http://localhost/api/tournaments/t1/entries', {
      method: 'POST',
      body: JSON.stringify(validBody),
    })

    const response = await POST(request, { params: Promise.resolve({ id: validTournamentId }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error.message).toBe('終了済みトーナメントには参加者を追加できません')
    expect(insert).not.toHaveBeenCalled()
  })

  it('activeトーナメントなら成功する', async () => {
    const maybeSingleTournament = vi.fn().mockResolvedValueOnce({ data: { status: 'active' }, error: null })
    const eqTournamentStatus = vi.fn().mockReturnValue({ maybeSingle: maybeSingleTournament })
    const selectTournament = vi.fn().mockReturnValue({ eq: eqTournamentStatus })

    const maybeSingleExistingEntry = vi.fn().mockResolvedValueOnce({ data: null, error: null })
    const eqPlayerId = vi.fn().mockReturnValue({ maybeSingle: maybeSingleExistingEntry })
    const eqTournamentIdForEntry = vi.fn().mockReturnValue({ eq: eqPlayerId })
    const selectEntries = vi.fn().mockReturnValue({ eq: eqTournamentIdForEntry })

    const insert = vi.fn().mockResolvedValueOnce({ error: null })

    const maybeSinglePlayer = vi.fn().mockResolvedValueOnce({ data: { name: 'Alice' }, error: null })
    const eqPlayerLookup = vi.fn().mockReturnValue({ maybeSingle: maybeSinglePlayer })
    const selectPlayer = vi.fn().mockReturnValue({ eq: eqPlayerLookup })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') return { select: selectTournament }
      if (table === 'tournament_entries') return { select: selectEntries, insert }
      if (table === 'players') return { select: selectPlayer }
      throw new Error(`Unexpected table: ${table}`)
    })

    const request = new Request('http://localhost/api/tournaments/t1/entries', {
      method: 'POST',
      body: JSON.stringify(validBody),
    })

    const response = await POST(request, { params: Promise.resolve({ id: validTournamentId }) })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith({
      tournament_id: validTournamentId,
      player_id: validBody.playerId,
      starting_level: validBody.startingLevel,
    })
    expect(body).toEqual({
      entry: {
        playerId: validBody.playerId,
        playerName: 'Alice',
        startingLevel: validBody.startingLevel,
      },
    })
  })

  it('大会が存在しない場合は404を返す', async () => {
    const maybeSingleTournament = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    })
    const eqTournamentId = vi.fn().mockReturnValue({ maybeSingle: maybeSingleTournament })
    const selectTournament = vi.fn().mockReturnValue({ eq: eqTournamentId })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') return { select: selectTournament }
      throw new Error(`Unexpected table: ${table}`)
    })

    const request = new Request('http://localhost/api/tournaments/t1/entries', {
      method: 'POST',
      body: JSON.stringify(validBody),
    })

    const response = await POST(request, { params: Promise.resolve({ id: validTournamentId }) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.message).toBe('トーナメントが見つかりません')
  })

  it('insert時にPT009なら409を返す', async () => {
    const maybeSingleTournament = vi.fn().mockResolvedValueOnce({ data: { status: 'active' }, error: null })
    const eqTournamentStatus = vi.fn().mockReturnValue({ maybeSingle: maybeSingleTournament })
    const selectTournament = vi.fn().mockReturnValue({ eq: eqTournamentStatus })

    const maybeSingleExistingEntry = vi.fn().mockResolvedValueOnce({ data: null, error: null })
    const eqPlayerId = vi.fn().mockReturnValue({ maybeSingle: maybeSingleExistingEntry })
    const eqTournamentIdForEntry = vi.fn().mockReturnValue({ eq: eqPlayerId })
    const selectEntries = vi.fn().mockReturnValue({ eq: eqTournamentIdForEntry })

    const insert = vi.fn().mockResolvedValueOnce({
      error: { code: 'PT009' },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') return { select: selectTournament }
      if (table === 'tournament_entries') return { select: selectEntries, insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    const request = new Request('http://localhost/api/tournaments/t1/entries', {
      method: 'POST',
      body: JSON.stringify(validBody),
    })

    const response = await POST(request, { params: Promise.resolve({ id: validTournamentId }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error.message).toBe('終了済みトーナメントには参加者を追加できません')
  })

  it('大会取得クエリがエラーなら500を返す', async () => {
    const maybeSingleTournament = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'db failure' },
    })
    const eqTournamentId = vi.fn().mockReturnValue({ maybeSingle: maybeSingleTournament })
    const selectTournament = vi.fn().mockReturnValue({ eq: eqTournamentId })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') return { select: selectTournament }
      throw new Error(`Unexpected table: ${table}`)
    })

    const request = new Request('http://localhost/api/tournaments/t1/entries', {
      method: 'POST',
      body: JSON.stringify(validBody),
    })

    const response = await POST(request, { params: Promise.resolve({ id: validTournamentId }) })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.message).toBe('Internal server error')
  })
})
