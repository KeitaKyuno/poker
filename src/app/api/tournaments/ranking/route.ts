import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'

type RankingRow = {
  rank: number
  player_id: string
  player_name: string
  total_points: number
  game_count: number
}

export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_tournament_ranking')
    .select('rank,player_id,player_name,total_points,game_count')
    .returns<RankingRow[]>()

  if (error) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({
    rankings: (data ?? []).map((row) => ({
      rank: row.rank,
      playerId: row.player_id,
      playerName: row.player_name,
      totalPoints: row.total_points,
      gameCount: row.game_count,
    })),
  })
}
