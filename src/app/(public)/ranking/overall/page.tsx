import { headers } from 'next/headers'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OverallRanking } from '@/types'

async function getBaseUrl() {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export default async function OverallRankingPage() {
  const baseUrl = await getBaseUrl()
  const response = await fetch(`${baseUrl}/api/rankings/overall`, { cache: 'no-store' })
  const data = (await response.json()) as { rankings: OverallRanking[] }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>総合ランキング</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">順位</th>
                  <th className="py-2">プレイヤー</th>
                  <th className="py-2">純利益合計</th>
                  <th className="py-2">ゲーム数</th>
                </tr>
              </thead>
              <tbody>
                {(data.rankings ?? []).map((row) => (
                  <tr key={row.playerId} className="border-b">
                    <td className="py-2">{row.rank}</td>
                    <td className="py-2">{row.playerName}</td>
                    <td className="py-2">{row.netProfitSum.toLocaleString('ja-JP')} pt</td>
                    <td className="py-2">{row.sessionCount}</td>
                  </tr>
                ))}
                {(!data.rankings || data.rankings.length === 0) ? (
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
    </main>
  )
}
