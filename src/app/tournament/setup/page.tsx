'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Player } from '@/types'

type BlindForm = {
  level: number
  sb: string
  bb: string
  ante: string
  durationMinutes: string
}

type Mode = 'none' | 'new' | 'add'

type TournamentSummary = {
  id: string
  date: string
}

type TournamentDetail = {
  id: string
  entries: {
    playerId: string
  }[]
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const initialBlinds: BlindForm[] = [
  { level: 1, sb: '100', bb: '200', ante: '200', durationMinutes: '20' },
  { level: 2, sb: '200', bb: '400', ante: '400', durationMinutes: '20' },
  { level: 3, sb: '300', bb: '600', ante: '600', durationMinutes: '20' },
  { level: 4, sb: '400', bb: '800', ante: '800', durationMinutes: '20' },
  { level: 5, sb: '500', bb: '1000', ante: '1000', durationMinutes: '20' },
  { level: 6, sb: '600', bb: '1200', ante: '1200', durationMinutes: '20' },
  { level: 7, sb: '800', bb: '1600', ante: '1600', durationMinutes: '20' },
  { level: 8, sb: '1000', bb: '2000', ante: '2000', durationMinutes: '20' },
  { level: 9, sb: '1500', bb: '3000', ante: '3000', durationMinutes: '15' },
  { level: 10, sb: '2000', bb: '4000', ante: '4000', durationMinutes: '15' },
  { level: 11, sb: '3000', bb: '6000', ante: '6000', durationMinutes: '15' },
  { level: 12, sb: '4000', bb: '8000', ante: '8000', durationMinutes: '15' },
  { level: 13, sb: '5000', bb: '10000', ante: '10000', durationMinutes: '15' },
]

export default function TournamentSetupPage() {
  const router = useRouter()

  const [date, setDate] = useState(today())
  const [mode, setMode] = useState<Mode>('none')
  const [hasSearched, setHasSearched] = useState(false)

  const [players, setPlayers] = useState<Player[]>([])

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [blinds, setBlinds] = useState<BlindForm[]>(initialBlinds)
  const [creating, setCreating] = useState(false)

  const [targetTournamentId, setTargetTournamentId] = useState<string | null>(null)
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [selectedAddPlayerId, setSelectedAddPlayerId] = useState<string>('')
  const [findingTournament, setFindingTournament] = useState(false)
  const [addingEntry, setAddingEntry] = useState(false)
  const [addMessage, setAddMessage] = useState<string>('')

  useEffect(() => {
    const loadPlayers = async () => {
      const response = await fetch('/api/players')
      const data = await response.json()
      setPlayers(data.players ?? [])
    }

    void loadPlayers()
  }, [])

  const canCreate = useMemo(() => selectedPlayerIds.length > 0 && blinds.length > 0, [selectedPlayerIds, blinds])

  const resetSearchResult = () => {
    setMode('none')
    setHasSearched(false)
    setSelectedPlayerIds([])
    setBlinds(initialBlinds)
    setCreating(false)

    setTargetTournamentId(null)
    setAvailablePlayers([])
    setSelectedAddPlayerId('')
    setFindingTournament(false)
    setAddingEntry(false)
    setAddMessage('')
  }

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    )
  }

  const addBlindLevel = () => {
    setBlinds((prev) => [...prev, { level: prev.length + 1, sb: '0', bb: '0', ante: '0', durationMinutes: '20' }])
  }

  const removeBlindLevel = (index: number) => {
    setBlinds((prev) => prev.filter((_, i) => i !== index).map((blind, i) => ({ ...blind, level: i + 1 })))
  }

  const updateBlind = (index: number, key: keyof BlindForm, value: string) => {
    setBlinds((prev) => prev.map((blind, i) => (i === index ? { ...blind, [key]: value } : blind)))
  }

  const onCreateTournament = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)

    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          players: selectedPlayerIds.map((playerId) => ({
            playerId,
            startingLevel: 1,
          })),
          blinds: blinds.map((blind) => ({
            level: blind.level,
            sb: Number(blind.sb),
            bb: Number(blind.bb),
            ante: Number(blind.ante),
            durationMinutes: Number(blind.durationMinutes),
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? 'トーナメント作成に失敗しました')
      }

      router.push(`/tournament/${data.tournament.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'トーナメント作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  const refreshAvailablePlayers = async (tournamentId: string, allPlayers: Player[]) => {
    const detailRes = await fetch(`/api/tournaments/${tournamentId}`)
    const detailData = await detailRes.json()

    if (!detailRes.ok) {
      throw new Error(detailData?.error?.message ?? 'トーナメント詳細の取得に失敗しました')
    }

    const tournament = detailData.tournament as TournamentDetail
    const enteredIds = new Set((tournament.entries ?? []).map((entry) => entry.playerId))
    const notEnteredPlayers = allPlayers.filter((player) => !enteredIds.has(player.id))

    setAvailablePlayers(notEnteredPlayers)
    setSelectedAddPlayerId((prev) => {
      if (prev && notEnteredPlayers.some((player) => player.id === prev)) {
        return prev
      }
      return notEnteredPlayers[0]?.id ?? ''
    })
  }

  const onFindTournament = async () => {
    setHasSearched(true)
    setFindingTournament(true)
    setTargetTournamentId(null)
    setAvailablePlayers([])
    setSelectedAddPlayerId('')
    setAddMessage('')

    try {
      const tournamentsRes = await fetch('/api/tournaments?status=active')
      const tournamentsData = await tournamentsRes.json()

      if (!tournamentsRes.ok) {
        throw new Error(tournamentsData?.error?.message ?? 'トーナメント一覧の取得に失敗しました')
      }

      const tournaments = (tournamentsData.tournaments ?? []) as TournamentSummary[]
      const found = tournaments.find((tournament) => tournament.date === date)

      if (!found) {
        setMode('new')
        return
      }

      let allPlayers = players
      if (allPlayers.length === 0) {
        const playersRes = await fetch('/api/players')
        const playersData = await playersRes.json()

        if (!playersRes.ok) {
          throw new Error(playersData?.error?.message ?? 'プレイヤー一覧の取得に失敗しました')
        }

        allPlayers = (playersData.players ?? []) as Player[]
        setPlayers(allPlayers)
      }

      setMode('add')
      setTargetTournamentId(found.id)
      await refreshAvailablePlayers(found.id, allPlayers)
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '取得に失敗しました')
    } finally {
      setFindingTournament(false)
    }
  }

  const onAddEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!targetTournamentId || !selectedAddPlayerId) {
      return
    }

    setAddingEntry(true)
    setAddMessage('')

    try {
      const response = await fetch(`/api/tournaments/${targetTournamentId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedAddPlayerId,
          startingLevel: 1,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '追加登録に失敗しました')
      }

      setAddMessage('登録しました')
      await refreshAvailablePlayers(targetTournamentId, players)
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '追加登録に失敗しました')
    } finally {
      setAddingEntry(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>参加登録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="date">日付</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  resetSearchResult()
                }}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onFindTournament} disabled={findingTournament}>
                {findingTournament ? '検索中...' : '検索'}
              </Button>
            </div>
          </div>

          {hasSearched && mode === 'new' && (
            <form onSubmit={onCreateTournament} className="space-y-6">
              <p className="text-sm text-muted-foreground">{`${date} でトーナメントを新規開催します`}</p>
              <div className="space-y-2">
                <Label>参加プレイヤー</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {players.map((player) => (
                    <div key={player.id} className="rounded border p-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedPlayerIds.includes(player.id)}
                          onChange={() => togglePlayer(player.id)}
                        />
                        <span>{player.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>ブラインド設定</Label>
                  <Button type="button" variant="outline" onClick={addBlindLevel}>
                    + レベルを追加
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2">Level</th>
                        <th className="py-2">SB</th>
                        <th className="py-2">BB</th>
                        <th className="py-2">Ante</th>
                        <th className="py-2">Time(分)</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {blinds.map((blind, index) => (
                        <tr key={blind.level} className="border-b">
                          <td className="py-2">{blind.level}</td>
                          <td className="py-2">
                            <Input
                              type="number"
                              min={100}
                              step={100}
                              value={blind.sb}
                              onChange={(e) => updateBlind(index, 'sb', e.target.value)}
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              type="number"
                              min={100}
                              step={100}
                              value={blind.bb}
                              onChange={(e) => updateBlind(index, 'bb', e.target.value)}
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              value={blind.ante}
                              onChange={(e) => updateBlind(index, 'ante', e.target.value)}
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              type="number"
                              min={5}
                              step={5}
                              value={blind.durationMinutes}
                              onChange={(e) => updateBlind(index, 'durationMinutes', e.target.value)}
                            />
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => removeBlindLevel(index)}
                              disabled={blinds.length === 1}
                            >
                              削除
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Button type="submit" disabled={!canCreate || creating} className="w-full">
                {creating ? '作成中...' : '作成する'}
              </Button>
            </form>
          )}

          {hasSearched && mode === 'add' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{`${date} のトーナメントに追加登録します`}</p>

              {addMessage && <p className="text-sm text-muted-foreground">{addMessage}</p>}

              {targetTournamentId && (
                <form onSubmit={onAddEntry} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-player">追加可能プレイヤー</Label>
                    <select
                      id="add-player"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedAddPlayerId}
                      onChange={(e) => setSelectedAddPlayerId(e.target.value)}
                      disabled={availablePlayers.length === 0}
                    >
                      {availablePlayers.length === 0 ? (
                        <option value="">追加可能なプレイヤーはいません</option>
                      ) : (
                        availablePlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <Button type="submit" disabled={!selectedAddPlayerId || addingEntry || availablePlayers.length === 0}>
                    {addingEntry ? '登録中...' : '追加登録'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
