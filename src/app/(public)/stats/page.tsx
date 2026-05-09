'use client'

import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { BackButton } from '@/components/back-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GetPlayerDailyStatsResponse, Player } from '@/types'

type ChartPoint = {
  date: string
  label: string
  netProfit: number
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [stats, setStats] = useState<GetPlayerDailyStatsResponse['stats']>([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadPlayers = async () => {
      setLoadingPlayers(true)
      setError('')

      try {
        const response = await fetch('/api/players')
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error?.message ?? 'プレイヤー取得に失敗しました')
        }

        const playerList = (data.players ?? []) as Player[]
        setPlayers(playerList)
        if (playerList.length > 0) {
          setPlayerId((prev) => prev || playerList[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'プレイヤー取得に失敗しました')
      } finally {
        setLoadingPlayers(false)
      }
    }

    void loadPlayers()
  }, [])

  useEffect(() => {
    if (!playerId) {
      setStats([])
      return
    }

    const controller = new AbortController()

    const loadStats = async () => {
      setLoadingStats(true)
      setError('')

      try {
        const response = await fetch(`/api/players/${playerId}/stats`, { signal: controller.signal })
        const data = (await response.json()) as GetPlayerDailyStatsResponse

        if (!response.ok) {
          throw new Error((data as { error?: { message?: string } }).error?.message ?? '戦績取得に失敗しました')
        }

        setStats(data.stats ?? [])
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return
        setStats([])
        setError(e instanceof Error ? e.message : '戦績取得に失敗しました')
      } finally {
        setLoadingStats(false)
      }
    }

    void loadStats()

    return () => controller.abort()
  }, [playerId])

  const chartData = useMemo<ChartPoint[]>(() => {
    return stats.map((item) => ({
      date: item.date,
      label: formatDateLabel(item.date),
      netProfit: item.netProfit,
    }))
  }, [stats])

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>戦績</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <p className="text-sm text-muted-foreground">プレイヤー</p>
            <Select value={playerId} onValueChange={setPlayerId} disabled={loadingPlayers || players.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          {loadingStats ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}

          {!loadingStats && chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">データがありません</p>
          ) : null}

          {!loadingStats && chartData.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => `${value}`} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" />
                  <Tooltip
                    formatter={(value) => `${Number(value).toLocaleString('ja-JP')} pt`}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as ChartPoint | undefined
                      return item?.date ?? ''
                    }}
                  />
                  <Line dataKey="netProfit" name="純利益" stroke="#10b981" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
