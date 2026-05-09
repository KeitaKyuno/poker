'use client'

import { useEffect, useState } from 'react'

import { BackButton } from '@/components/back-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TournamentRanking } from '@/types'

export default function TournamentRankingPage() {
  const [rankings, setRankings] = useState<TournamentRanking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const response = await fetch('/api/tournaments/ranking')
      const data = await response.json()
      setRankings(data.rankings ?? [])
      setLoading(false)
    }

    void load()
  }, [])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <BackButton href="/" />
      <Card className="border-primary/70 bg-card/90">
        <CardHeader>
          <CardTitle>トーナメントランキング</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
            <p>1位:10pt / 2位:5pt / 3位:3pt / 4位:2pt / 5位:1pt</p>
            <p>6人以上参加で4位からポイント付与、8人以上参加で5位からポイント付与</p>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-primary/60 bg-primary/10 text-left text-primary">
                  <th className="py-2">順位</th>
                  <th className="py-2">プレイヤー</th>
                  <th className="py-2">合計ポイント</th>
                  <th className="py-2">ゲーム数</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((row) => (
                  <tr key={row.playerId} className="border-b border-border/60">
                    <td className="py-2">
                      <span
                        className={
                          row.rank === 1
                            ? 'rounded-full border border-amber-300/70 bg-amber-400/20 px-2 py-0.5 font-semibold text-amber-300'
                            : row.rank === 2
                              ? 'rounded-full border border-slate-300/70 bg-slate-200/15 px-2 py-0.5 font-semibold text-slate-200'
                              : row.rank === 3
                                ? 'rounded-full border border-orange-400/70 bg-orange-400/15 px-2 py-0.5 font-semibold text-orange-300'
                                : ''
                        }
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="py-2">{row.playerName}</td>
                    <td className="py-2 font-medium text-emerald-400">{row.totalPoints} pt</td>
                    <td className="py-2">{row.gameCount}</td>
                  </tr>
                ))}
                {!loading && rankings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">データがありません</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
