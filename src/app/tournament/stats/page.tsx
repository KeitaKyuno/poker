'use client'

import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { BackButton } from '@/components/back-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GetPlayerTournamentStatsResponse, Player } from '@/types'

type ChartPoint = {
  date: string
  label: string
  points: number
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

export default function TournamentStatsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [stats, setStats] = useState<GetPlayerTournamentStatsResponse['stats']>([])

  useEffect(() => {
    const loadPlayers = async () => {
      const response = await fetch('/api/players')
      const data = await response.json()
      const list = (data.players ?? []) as Player[]
      setPlayers(list)
      if (list.length > 0) setPlayerId(list[0].id)
    }

    void loadPlayers()
  }, [])

  useEffect(() => {
    if (!playerId) return

    const load = async () => {
      const response = await fetch(`/api/players/${playerId}/tournament-stats`)
      const data = (await response.json()) as GetPlayerTournamentStatsResponse
      setStats(data.stats ?? [])
    }

    void load()
  }, [playerId])

  const chartData = useMemo<ChartPoint[]>(() => {
    return [...stats]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        date: item.date,
        label: formatDateLabel(item.date),
        points: item.points,
      }))
  }, [stats])

  const maxPoints = useMemo(() => Math.max(...chartData.map((item) => item.points), 1), [chartData])

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader><CardTitle>トーナメント戦績</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger><SelectValue placeholder="プレイヤーを選択" /></SelectTrigger>
              <SelectContent>
                {players.map((player) => <SelectItem key={player.id} value={player.id}>{player.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {chartData.length === 0 ? <p className="text-sm text-muted-foreground">データがありません</p> : null}

          {chartData.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, maxPoints]} allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => `${value}pt`}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as ChartPoint | undefined
                      return item?.date ?? ''
                    }}
                  />
                  <Line dataKey="points" name="ポイント" stroke="#d4af37" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
