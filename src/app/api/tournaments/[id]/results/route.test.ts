import { afterEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
  }),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/tournaments/[id]/results', () => {
  it.each([
    ['PT001', 404, 'トーナメントが見つかりません'],
    ['PT002', 400, '順位提出件数が参加人数と一致しません'],
    ['PT003', 400, '順位は1から参加人数までの重複なし連番で入力してください'],
    ['PT004', 400, '順位は1から参加人数までの重複なし連番で入力してください'],
    ['PT005', 400, 'プレイヤーが重複しています'],
    ['PT006', 400, '順位が重複しています'],
    ['PT007', 400, '参加していないプレイヤーが含まれています'],
    ['PT008', 400, '順位は1から参加人数までの重複なし連番で入力してください'],
  ])('RPCエラー %s をHTTPエラーへ変換する', async (code, expectedStatus, expectedMessage) => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code,
        message: 'db error detail',
      },
    })

    const request = new Request('http://localhost/api/tournaments/t1/results', {
      method: 'POST',
      body: JSON.stringify({
        results: [{ playerId: '11111111-1111-4111-8111-111111111111', rank: 1 }],
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    const body = await response.json()

    expect(response.status).toBe(expectedStatus)
    expect(body.error.message).toBe(expectedMessage)
  })

  it('bodyがJSONとして不正なら400を返しRPCを呼ばない', async () => {
    const request = new Request('http://localhost/api/tournaments/t1/results', {
      method: 'POST',
      body: '{',
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.message).toBe('Invalid request body')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('resultsが空配列なら400を返しRPCを呼ばない', async () => {
    const request = new Request('http://localhost/api/tournaments/t1/results', {
      method: 'POST',
      body: JSON.stringify({ results: [] }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })

    expect(response.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('rank重複なら400を返しRPCを呼ばない', async () => {
    const request = new Request('http://localhost/api/tournaments/t1/results', {
      method: 'POST',
      body: JSON.stringify({
        results: [
          { playerId: '11111111-1111-4111-8111-111111111111', rank: 1 },
          { playerId: '22222222-2222-4222-8222-222222222222', rank: 1 },
        ],
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })

    expect(response.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('idがuuidでないなら400を返しRPCを呼ばない', async () => {
    const request = new Request('http://localhost/api/tournaments/invalid/results', {
      method: 'POST',
      body: JSON.stringify({
        results: [{ playerId: '11111111-1111-4111-8111-111111111111', rank: 1 }],
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'invalid-id' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.message).toBe('トーナメントIDが不正です')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it.each([
    ['23505'],
    [null],
  ])('未知のcode(%s)なら500を返しDBエラーメッセージをレスポンスに含めない', async (code) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code,
        message: 'unexpected database failure detail',
      },
    })

    const request = new Request('http://localhost/api/tournaments/t1/results', {
      method: 'POST',
      body: JSON.stringify({
        results: [{ playerId: '11111111-1111-4111-8111-111111111111', rank: 1 }],
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.message).toBe('Internal server error')
    expect(JSON.stringify(body)).not.toContain('unexpected database failure detail')
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('正常系でRPC引数が正しくcamelCaseで返る', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { player_id: '11111111-1111-1111-1111-111111111111', rank: 1 },
        { player_id: '22222222-2222-2222-2222-222222222222', rank: 2 },
      ],
      error: null,
    })

    const request = new Request('http://localhost/api/tournaments/t1/results', {
      method: 'POST',
      body: JSON.stringify({
        results: [
          { playerId: '11111111-1111-4111-8111-111111111111', rank: 1 },
          { playerId: '22222222-2222-4222-8222-222222222222', rank: 2 },
        ],
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('submit_tournament_results', {
      p_tournament_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_results: [
        { playerId: '11111111-1111-4111-8111-111111111111', rank: 1 },
        { playerId: '22222222-2222-4222-8222-222222222222', rank: 2 },
      ],
    })
    expect(body).toEqual({
      results: [
        { playerId: '11111111-1111-1111-1111-111111111111', rank: 1 },
        { playerId: '22222222-2222-2222-2222-222222222222', rank: 2 },
      ],
    })
  })
})
