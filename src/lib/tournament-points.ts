export type TournamentEntryPointRow = {
  tournament_id: string | null
  tournament_date: string | null
  rank: number | null
  points: number | null
}

type TournamentStat = {
  tournamentId: string
  date: string
  rank: number
  points: number
}

function isValidRow(row: TournamentEntryPointRow): row is {
  tournament_id: string
  tournament_date: string
  rank: number
  points: number
} {
  return (
    typeof row.tournament_id === 'string' &&
    row.tournament_id.length > 0 &&
    typeof row.tournament_date === 'string' &&
    row.tournament_date.length > 0 &&
    typeof row.rank === 'number' &&
    Number.isFinite(row.rank) &&
    typeof row.points === 'number' &&
    Number.isFinite(row.points)
  )
}

export function buildTournamentStats(rows: TournamentEntryPointRow[]): TournamentStat[] {
  const sortedRows = [...rows].sort((a, b) => {
    const dateA = a.tournament_date ?? ''
    const dateB = b.tournament_date ?? ''

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB)
    }

    const idA = a.tournament_id ?? ''
    const idB = b.tournament_id ?? ''
    return idA.localeCompare(idB)
  })

  let cumulativePoints = 0

  return sortedRows.map((row) => {
    if (!isValidRow(row)) {
      throw new Error('Invalid tournament entry point row')
    }

    cumulativePoints += row.points

    return {
      tournamentId: row.tournament_id,
      date: row.tournament_date,
      rank: row.rank,
      points: cumulativePoints,
    }
  })
}
