'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { BackButton } from '@/components/back-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MonthlyRanking, OverallRanking } from '@/types'

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function MonthlyRankingPage() {
  const [yearMonth, setYearMonth] = useState(currentYearMonth())
  const [overallRankings, setOverallRankings] = useState<OverallRanking[]>([])
  const [overallLoading, setOverallLoading] = useState(false)
  const [rankings, setRankings] = useState<MonthlyRanking[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadOverall = async () => {
      setOverallLoading(true)
      try {
        const response = await fetch('/api/rankings/overall')
        if (!response.ok) {
          throw new Error('取得に失敗しました')
        }
        const data = await response.json()
        setOverallRankings(data.rankings ?? [])
      } catch {
        toast.error('取得に失敗しました')
      } finally {
        setOverallLoading(false)
      }
    }

    void loadOverall()
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/rankings/monthly?yearMonth=${yearMonth}`)
        if (!response.ok) {
          throw new Error('取得に失敗しました')
        }
        const data = await response.json()
        setRankings(data.rankings ?? [])
      } catch {
        toast.error('取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [yearMonth])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <BackButton href="/" />
      <div className="space-y-6">
        <Card className="border-primary/70 bg-card/90">
          <CardHeader>
            <CardTitle>総合ランキング</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overallLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-primary/60 bg-primary/10 text-left text-primary">
                    <th className="py-2">順位</th>
                    <th className="py-2">プレイヤー</th>
                    <th className="py-2">純利益合計</th>
                    <th className="py-2">ゲーム数</th>
                  </tr>
                </thead>
                <tbody>
                  {overallRankings.map((row) => (
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
                      <td
                        className={`py-2 font-medium ${row.netProfitSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {row.netProfitSum.toLocaleString('ja-JP')} pt
                      </td>
                      <td className="py-2">{row.sessionCount}</td>
                    </tr>
                  ))}
                  {overallRankings.length === 0 && !overallLoading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        データがありません
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/70 bg-card/90">
          <CardHeader>
            <CardTitle>月間ランキング</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="yearMonth">対象年月</Label>
              <Input
                id="yearMonth"
                type="month"
                className="w-full appearance-none"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
              />
            </div>

            {loading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-primary/60 bg-primary/10 text-left text-primary">
                    <th className="py-2">順位</th>
                    <th className="py-2">プレイヤー</th>
                    <th className="py-2">純利益合計</th>
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
                      <td
                        className={`py-2 font-medium ${row.netProfitSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {row.netProfitSum.toLocaleString('ja-JP')} pt
                      </td>
                      <td className="py-2">{row.sessionCount}</td>
                    </tr>
                  ))}
                  {rankings.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        データがありません
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
