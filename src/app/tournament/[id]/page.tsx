'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GetTournamentResponse, Player } from '@/types'

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<GetTournamentResponse['tournament'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedRanks, setSelectedRanks] = useState<Record<string, string>>({})
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [selectedAdditionalPlayerId, setSelectedAdditionalPlayerId] = useState('')
  const [addingEntry, setAddingEntry] = useState(false)

  const fetchTournament = async (tournamentId: string) => {
    const response = await fetch(`/api/tournaments/${tournamentId}`)
    const json = (await response.json()) as GetTournamentResponse
    if (!response.ok) {
      throw new Error((json as { error?: { message?: string } }).error?.message ?? '取得に失敗しました')
    }
    return json.tournament
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const tournament = await fetchTournament(params.id)
        setData(tournament)
        const initialRanks: Record<string, string> = {}
        for (const result of tournament.results) {
          initialRanks[result.playerId] = String(result.rank)
        }
        setSelectedRanks(initialRanks)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [params.id])

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const response = await fetch('/api/players')
        const json = (await response.json()) as { players?: Player[] }
        if (!response.ok) {
          throw new Error((json as { error?: { message?: string } }).error?.message ?? 'プレイヤー取得に失敗しました')
        }
        setAllPlayers(json.players ?? [])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'プレイヤー取得に失敗しました')
      }
    }

    void loadPlayers()
  }, [])

  const maxRank = useMemo(() => data?.entries.length ?? 0, [data])
  const availableAdditionalPlayers = useMemo(() => {
    if (!data) return []
    const entryIds = new Set(data.entries.map((entry) => entry.playerId))
    return allPlayers.filter((player) => !entryIds.has(player.id))
  }, [allPlayers, data])

  const saveResults = async () => {
    if (!data) return
    setSaving(true)

    try {
      const results = data.entries
        .filter((entry) => selectedRanks[entry.playerId])
        .map((entry) => ({
          playerId: entry.playerId,
          rank: Number(selectedRanks[entry.playerId]),
        }))

      const response = await fetch(`/api/tournaments/${data.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error?.message ?? '結果の保存に失敗しました')
      }

      toast.success('結果を保存しました')
      const tournament = await fetchTournament(data.id)
      setData(tournament)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '結果の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const addEntry = async () => {
    if (!data || !selectedAdditionalPlayerId) return
    setAddingEntry(true)

    try {
      const response = await fetch(`/api/tournaments/${data.id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedAdditionalPlayerId,
          startingLevel: 1,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error?.message ?? '追加登録に失敗しました')
      }

      const tournament = await fetchTournament(data.id)
      setData(tournament)
      setSelectedAdditionalPlayerId('')
      toast.success('プレイヤーを登録しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '追加登録に失敗しました')
    } finally {
      setAddingEntry(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 text-sm text-muted-foreground">
        <BackButton href="/" />
        読み込み中...
      </main>
    )
  }
  if (!data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 text-sm text-muted-foreground">
        <BackButton href="/" />
        データがありません
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader><CardTitle>トーナメント詳細</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">日付: {data.date}</p>
          <div>
            <p className="mb-2 text-sm font-medium">参加プレイヤー</p>
            <ul className="list-inside list-disc text-sm">
              {data.entries.map((entry) => <li key={entry.playerId}>{entry.playerName} (開始Lv: {entry.startingLevel})</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>追加登録</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {availableAdditionalPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">追加できるプレイヤーがいません</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableAdditionalPlayers.map((player) => {
                const isSelected = selectedAdditionalPlayerId === player.id
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setSelectedAdditionalPlayerId(player.id)}
                    className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                  >
                    {player.name}
                  </button>
                )
              })}
            </div>
          )}
          <Button onClick={addEntry} disabled={!selectedAdditionalPlayerId || addingEntry}>
            {addingEntry ? '登録中...' : '登録する'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ブラインド設定</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b text-left"><th className="py-2">Level</th><th className="py-2">SB</th><th className="py-2">BB</th><th className="py-2">Ante</th><th className="py-2">Time</th></tr></thead>
              <tbody>
                {data.blinds.map((blind) => (
                  <tr key={blind.level} className="border-b"><td className="py-2">{blind.level}</td><td className="py-2">{blind.sb}</td><td className="py-2">{blind.bb}</td><td className="py-2">{blind.ante}</td><td className="py-2">{blind.durationMinutes}分</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>結果入力</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {data.entries.map((entry) => (
              <div key={entry.playerId} className="grid grid-cols-[1fr_200px] items-center gap-3">
                <p className="text-sm">{entry.playerName}</p>
                <Select
                  value={selectedRanks[entry.playerId] ?? ''}
                  onValueChange={(value) => setSelectedRanks((prev) => ({ ...prev, [entry.playerId]: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="順位を選択" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxRank }, (_, i) => i + 1).map((rank) => (
                      <SelectItem key={rank} value={String(rank)}>{rank}位</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button onClick={saveResults} disabled={saving}>{saving ? '保存中...' : '結果を保存'}</Button>

          {data.results.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium">保存済み結果</p>
              <ul className="list-inside list-disc text-sm">
                {data.results.map((result) => <li key={result.playerId}>{result.rank}位: {result.playerName}</li>)}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

    </main>
  )
}
