import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { BackButton } from '@/components/back-button'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GetPlayerStatsResponse } from '@/types'

async function getBaseUrl() {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export default async function PlayerStatsPage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params
  const baseUrl = await getBaseUrl()
  const response = await fetch(`${baseUrl}/api/players/${playerId}/stats`, { cache: 'no-store' })

  if (response.status === 404) {
    notFound()
  }

  if (!response.ok) {
    throw new Error('Failed to load player stats')
  }

  const data = (await response.json()) as GetPlayerStatsResponse

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-2xl font-bold">{data.player.name} の成績</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">ゲーム数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data.metrics.sessionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">純利益合計</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data.metrics.netProfitSum.toLocaleString('ja-JP')} pt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">平均利益</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {data.metrics.averageProfitPerSession.toLocaleString('ja-JP')} pt
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>累積利益推移</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfitTrendChart data={data.trend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>セッション履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">日付</th>
                  <th className="py-2">バイイン合計</th>
                  <th className="py-2">獲得額</th>
                  <th className="py-2">純利益</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr key={session.sessionId} className="border-b">
                    <td className="py-2">{session.sessionDate}</td>
                    <td className="py-2">{session.totalBuyinAmount.toLocaleString('ja-JP')} pt</td>
                    <td className="py-2">{session.totalCashoutAmount.toLocaleString('ja-JP')} pt</td>
                    <td className={`py-2 font-medium ${session.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {session.netProfit >= 0 ? '+' : ''}
                      {session.netProfit.toLocaleString('ja-JP')} pt
                    </td>
                  </tr>
                ))}
                {data.sessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      まだ終了済みセッションがありません
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
