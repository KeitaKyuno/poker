import { describe, expect, it } from 'vitest'

import { PostTournamentResultsRequestSchema } from './schemas'

describe('PostTournamentResultsRequestSchema', () => {
  it('空配列は失敗する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({ results: [] })
    expect(result.success).toBe(false)
  })

  it('rankが0は失敗する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({
      results: [{ playerId: '11111111-1111-4111-8111-111111111111', rank: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('rankが負数は失敗する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({
      results: [{ playerId: '11111111-1111-4111-8111-111111111111', rank: -1 }],
    })
    expect(result.success).toBe(false)
  })

  it('rankが小数は失敗する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({
      results: [{ playerId: '11111111-1111-4111-8111-111111111111', rank: 1.5 }],
    })
    expect(result.success).toBe(false)
  })

  it('playerIdがuuidでない場合は失敗する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({
      results: [{ playerId: 'not-uuid', rank: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('playerId重複は失敗する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({
      results: [
        { playerId: '11111111-1111-4111-8111-111111111111', rank: 1 },
        { playerId: '11111111-1111-4111-8111-111111111111', rank: 2 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rank重複は失敗する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({
      results: [
        { playerId: '11111111-1111-4111-8111-111111111111', rank: 1 },
        { playerId: '22222222-2222-4222-8222-222222222222', rank: 1 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('正常系は成功する', () => {
    const result = PostTournamentResultsRequestSchema.safeParse({
      results: [
        { playerId: '11111111-1111-4111-8111-111111111111', rank: 1 },
        { playerId: '22222222-2222-4222-8222-222222222222', rank: 2 },
      ],
    })
    expect(result.success).toBe(true)
  })
})
