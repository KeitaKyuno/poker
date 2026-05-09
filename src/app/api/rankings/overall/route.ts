import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'

type OverallRankingRow = {
  player_id: string
  player_name: string
  net_profit_sum: number
  session_count: number
}

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('v_overall_ranking')
    .select('player_id,player_name,net_profit_sum,session_count')

  if (error) {
    return Errors.INTERNAL()
  }

  const sorted = [...(data ?? [])]
    .sort((a, b) => {
      if (b.net_profit_sum !== a.net_profit_sum) {
        return b.net_profit_sum - a.net_profit_sum
      }
      return a.player_name.localeCompare(b.player_name, 'ja')
    })
    .map((row, index) => ({
      rank: index + 1,
      playerId: row.player_id,
      playerName: row.player_name,
      netProfitSum: row.net_profit_sum,
      sessionCount: row.session_count,
    }))

  return NextResponse.json({ rankings: sorted })
}
