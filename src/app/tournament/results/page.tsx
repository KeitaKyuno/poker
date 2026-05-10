'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GetTournamentResponse, Tournament } from '@/types'

type GetTournamentsResponse = {
  tournaments: Pick<Tournament, 'id' | 'date' | 'createdAt'>[]
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function TournamentResultsPage() {
  const [date, setDate] = useState(today())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searched, setSearched] = useState(false)
  const [tournament, setTournament] = useState<GetTournamentResponse['tournament'] | null>(null)
  const [selectedRanks, setSelectedRanks] = useState<Record<string, string>>({})

  const maxRank = useMemo(() => tournament?.entries.length ?? 0, [tournament])

  const onSearch = async () => {
    setLoading(true)
    setSearched(false)
    setTournament(null)
    setSelectedRanks({})

    try {
      const listResponse = await fetch('/api/tournaments?status=active')
      const listData = (await listResponse.json()) as GetTournamentsResponse

      if (!listResponse.ok) {
        throw new Error('トーナメント一覧の取得に失敗しました')
      }

      const found = listData.tournaments.find((item) => item.date === date)
      if (!found) {
        setSearched(true)
        return
      }

      const detailResponse = await fetch(`/api/tournaments/${found.id}`)
      const detailData = (await detailResponse.json()) as GetTournamentResponse

      if (!detailResponse.ok) {
        throw new Error('トーナメント詳細の取得に失敗しました')
      }

      const initialRanks: Record<string, string> = {}
      for (const result of detailData.tournament.results) {
        initialRanks[result.playerId] = String(result.rank)
      }

      setSelectedRanks(initialRanks)
      setTournament(detailData.tournament)
      setSearched(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '検索に失敗しました')
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const onSave = async () => {
    if (!tournament) {
      return
    }

    const results = tournament.entries.map((entry) => ({
      playerId: entry.playerId,
      rank: Number(selectedRanks[entry.playerId]),
    }))

    if (results.some((result) => !Number.isInteger(result.rank) || result.rank < 1 || result.rank > maxRank)) {
      toast.error('全員の順位を入力してください')
      return
    }

    const rankValues = results.map((r) => r.rank)
    if (new Set(rankValues).size !== rankValues.length) {
      toast.error('同じ順位を複数人に割り当てることはできません')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '保存に失敗しました')
      }

      toast.success('順位を登録しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>トーナメント順位登録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 overflow-hidden">
            <Label htmlFor="date">日付</Label>
            <Input id="date" type="date" className="w-full appearance-none" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>

          <Button onClick={onSearch} disabled={loading || !date}>
            {loading ? '検索中...' : '検索'}
          </Button>

          {searched && !tournament ? <p className="text-sm text-muted-foreground">該当するトーナメントがありません</p> : null}

          {tournament ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">対象日: {tournament.date}</p>
              <div className="space-y-3">
                {tournament.entries.map((entry) => (
                  <div key={entry.playerId} className="grid grid-cols-[1fr_180px] items-center gap-3">
                    <p className="text-sm">{entry.playerName}</p>
                    <Select
                      value={selectedRanks[entry.playerId] ?? ''}
                      onValueChange={(value) => setSelectedRanks((prev) => ({ ...prev, [entry.playerId]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="順位を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: maxRank }, (_, index) => index + 1).map((rank) => (
                          <SelectItem key={rank} value={String(rank)}>
                            {rank}位
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <Button onClick={onSave} disabled={saving}>
                {saving ? '保存中...' : '保存する'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
