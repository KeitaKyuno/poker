import { describe, expect, it } from 'vitest'

import { buildTournamentStats, type TournamentEntryPointRow } from '@/lib/tournament-points'

describe('buildTournamentStats', () => {
  it('calculates cumulative points and sorts by date asc', () => {
    const rows: TournamentEntryPointRow[] = [
      {
        tournament_id: 't2',
        tournament_date: '2026-01-05',
        rank: 2,
        points: 0,
      },
      {
        tournament_id: 't1',
        tournament_date: '2026-01-01',
        rank: 1,
        points: 2,
      },
      {
        tournament_id: 't3',
        tournament_date: '2026-01-10',
        rank: 3,
        points: -2,
      },
    ]

    expect(buildTournamentStats(rows)).toEqual([
      { tournamentId: 't1', date: '2026-01-01', rank: 1, points: 2 },
      { tournamentId: 't2', date: '2026-01-05', rank: 2, points: 2 },
      { tournamentId: 't3', date: '2026-01-10', rank: 3, points: 0 },
    ])
  })

  it('handles odd entry-count points correctly', () => {
    const rows: TournamentEntryPointRow[] = [
      { tournament_id: 'odd-1', tournament_date: '2026-02-01', rank: 1, points: 2 },
      { tournament_id: 'odd-2', tournament_date: '2026-02-02', rank: 2, points: 0 },
      { tournament_id: 'odd-3', tournament_date: '2026-02-03', rank: 3, points: -2 },
    ]

    expect(buildTournamentStats(rows).map((row) => row.points)).toEqual([2, 2, 0])
  })

  it('handles even entry-count points correctly', () => {
    const rows: TournamentEntryPointRow[] = [
      { tournament_id: 'even-1', tournament_date: '2026-03-01', rank: 1, points: 3 },
      { tournament_id: 'even-2', tournament_date: '2026-03-02', rank: 2, points: 1 },
      { tournament_id: 'even-3', tournament_date: '2026-03-03', rank: 3, points: -1 },
      { tournament_id: 'even-4', tournament_date: '2026-03-04', rank: 4, points: -3 },
    ]

    expect(buildTournamentStats(rows).map((row) => row.points)).toEqual([3, 4, 3, 0])
  })

  it('handles single-entry and two-entry cases correctly', () => {
    const single: TournamentEntryPointRow[] = [
      { tournament_id: 'solo', tournament_date: '2026-04-01', rank: 1, points: 0 },
    ]
    const two: TournamentEntryPointRow[] = [
      { tournament_id: 'pair-1', tournament_date: '2026-04-02', rank: 1, points: 1 },
      { tournament_id: 'pair-2', tournament_date: '2026-04-03', rank: 2, points: -1 },
    ]

    expect(buildTournamentStats(single)).toEqual([
      { tournamentId: 'solo', date: '2026-04-01', rank: 1, points: 0 },
    ])
    expect(buildTournamentStats(two).map((row) => row.points)).toEqual([1, 0])
  })

  it('throws when required fields are nullish', () => {
    expect(() =>
      buildTournamentStats([
        { tournament_id: 'x', tournament_date: null, rank: 1, points: 1 },
      ]),
    ).toThrow(/invalid tournament entry point row/i)

    expect(() =>
      buildTournamentStats([
        { tournament_id: 'x', tournament_date: '2026-05-01', rank: null, points: 1 },
      ]),
    ).toThrow(/invalid tournament entry point row/i)

    expect(() =>
      buildTournamentStats([
        { tournament_id: 'x', tournament_date: '2026-05-01', rank: 1, points: null },
      ]),
    ).toThrow(/invalid tournament entry point row/i)
  })
})
