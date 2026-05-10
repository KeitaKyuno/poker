'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PinInput } from '@/components/forms/PinInput'
import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GetPlayersResponse, GetSessionsResponse, GetTournamentResponse, Player, Session, Tournament } from '@/types'

type EditTargetType = 'cash' | 'tournament'

type GetTournamentsResponse = {
  tournaments: Pick<Tournament, 'id' | 'date' | 'createdAt'>[]
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function EditPage() {
  const [targetType, setTargetType] = useState<EditTargetType>('cash')
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [date, setDate] = useState(today())

  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  const [session, setSession] = useState<Session | null>(null)
  const [cashoutAmount, setCashoutAmount] = useState('')
  const [pin, setPin] = useState('')
  const [savingCash, setSavingCash] = useState(false)
  const [deletingCash, setDeletingCash] = useState(false)

  const [tournamentId, setTournamentId] = useState('')
  const [currentRank, setCurrentRank] = useState<number | null>(null)
  const [newRank, setNewRank] = useState('')
  const [savingTournament, setSavingTournament] = useState(false)
  const [deletingTournament, setDeletingTournament] = useState(false)

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const response = await fetch('/api/players')
        const data = (await response.json()) as GetPlayersResponse
        if (!response.ok) {
          throw new Error('プレイヤー一覧の取得に失敗しました')
        }
        setPlayers(data.players ?? [])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'プレイヤー一覧の取得に失敗しました')
      }
    }

    void loadPlayers()
  }, [])

  const resetResults = () => {
    setSearched(false)
    setSession(null)
    setCashoutAmount('')
    setPin('')
    setTournamentId('')
    setCurrentRank(null)
    setNewRank('')
  }

  const canSearch = useMemo(() => {
    return Boolean(playerId) && Boolean(date)
  }, [playerId, date])

  const canSaveCash = useMemo(() => {
    return Boolean(session) && pin.length === 4 && Number(cashoutAmount) >= 0
  }, [session, pin, cashoutAmount])

  const canSaveTournament = useMemo(() => {
    return Boolean(tournamentId) && Number(newRank) >= 1
  }, [tournamentId, newRank])

  const canDeleteCash = useMemo(() => {
    return Boolean(session) && pin.length === 4
  }, [session, pin])

  const canDeleteTournament = useMemo(() => {
    return Boolean(tournamentId)
  }, [tournamentId])

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSearch) {
      return
    }

    setLoading(true)
    setSearched(false)
    setSession(null)
    setTournamentId('')
    setCurrentRank(null)

    try {
      if (targetType === 'cash') {
        const query = new URLSearchParams({ playerId })
        const response = await fetch(`/api/sessions?${query.toString()}`)
        const data = (await response.json()) as GetSessionsResponse

        if (!response.ok) {
          throw new Error('セッション取得に失敗しました')
        }

        const found = data.sessions.find((item) => item.sessionDate === date) ?? null
        setSession(found)
        setCashoutAmount(found?.totalCashoutAmount?.toString() ?? '')
      } else {
        const listResponse = await fetch('/api/tournaments')
        const listData = (await listResponse.json()) as GetTournamentsResponse

        if (!listResponse.ok) {
          throw new Error('トーナメント一覧の取得に失敗しました')
        }

        const found = listData.tournaments.find((item) => item.date === date)
        if (!found) {
          setTournamentId('')
          setCurrentRank(null)
          setNewRank('')
          setSearched(true)
          return
        }

        const detailResponse = await fetch(`/api/tournaments/${found.id}`)
        const detailData = (await detailResponse.json()) as GetTournamentResponse

        if (!detailResponse.ok) {
          throw new Error('トーナメント詳細の取得に失敗しました')
        }

        const result = detailData.tournament.results.find((item) => item.playerId === playerId)
        setTournamentId(found.id)
        setCurrentRank(result?.rank ?? null)
        setNewRank(result?.rank?.toString() ?? '')
      }

      setSearched(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '検索に失敗しました')
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const onSaveCash = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!session) {
      return
    }

    setSavingCash(true)

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          pin,
          totalCashoutAmount: Number(cashoutAmount),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '保存に失敗しました')
      }

      toast.success('修正しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setSavingCash(false)
    }
  }

  const onSaveTournament = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!tournamentId) {
      return
    }

    setSavingTournament(true)

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: [{ playerId, rank: Number(newRank) }],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '保存に失敗しました')
      }

      setCurrentRank(Number(newRank))
      toast.success('修正しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setSavingTournament(false)
    }
  }

  const onDeleteCash = async () => {
    if (!session) {
      return
    }

    setDeletingCash(true)

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, pin }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '削除に失敗しました')
      }

      setSession(null)
      setCashoutAmount('')
      toast.success('削除しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    } finally {
      setDeletingCash(false)
    }
  }

  const onDeleteTournament = async () => {
    if (!tournamentId) {
      return
    }

    setDeletingTournament(true)

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '削除に失敗しました')
      }

      setTournamentId('')
      setCurrentRank(null)
      setNewRank('')
      toast.success('削除しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    } finally {
      setDeletingTournament(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>修正</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>種別</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={targetType === 'cash' ? 'default' : 'outline'}
                onClick={() => {
                  setTargetType('cash')
                  resetResults()
                }}
              >
                キャッシュゲーム
              </Button>
              <Button
                type="button"
                variant={targetType === 'tournament' ? 'default' : 'outline'}
                onClick={() => {
                  setTargetType('tournament')
                  resetResults()
                }}
              >
                トーナメント
              </Button>
            </div>
          </div>

          <form onSubmit={onSearch} className="space-y-4">
            <div className="space-y-2">
              <Label>プレイヤー</Label>
              <Select
                value={playerId}
                onValueChange={(value) => {
                  setPlayerId(value)
                  resetResults()
                }}
              >
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

            <div className="space-y-2 overflow-hidden">
              <Label htmlFor="date">日付</Label>
              <Input
                id="date"
                type="date"
                className="w-full appearance-none"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  resetResults()
                }}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={!canSearch || loading}>
              {loading ? '検索中...' : '検索'}
            </Button>
          </form>

          {searched && targetType === 'cash' && !session ? (
            <p className="text-sm text-muted-foreground">該当するセッションがありません</p>
          ) : null}

          {searched && targetType === 'cash' && session ? (
            <form onSubmit={onSaveCash} className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label>バイイン合計</Label>
                <Input value={session.totalBuyinAmount.toString()} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashout">合計獲得額</Label>
                <Input
                  id="cashout"
                  type="number"
                  min={0}
                  value={cashoutAmount}
                  onChange={(e) => setCashoutAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <PinInput id="pin" value={pin} onChange={(e) => setPin(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={!canSaveCash || savingCash}>
                {savingCash ? '保存中...' : '保存'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => void onDeleteCash()}
                disabled={!canDeleteCash || deletingCash}
              >
                {deletingCash ? '削除中...' : '削除'}
              </Button>
            </form>
          ) : null}

          {searched && targetType === 'tournament' && !tournamentId ? (
            <p className="text-sm text-muted-foreground">該当するトーナメントがありません</p>
          ) : null}

          {searched && targetType === 'tournament' && tournamentId ? (
            <form onSubmit={onSaveTournament} className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label>現在の順位</Label>
                <Input value={currentRank?.toString() ?? ''} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newRank">新しい順位</Label>
                <Input
                  id="newRank"
                  type="number"
                  min={1}
                  value={newRank}
                  onChange={(e) => setNewRank(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={!canSaveTournament || savingTournament}>
                {savingTournament ? '保存中...' : '保存'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => void onDeleteTournament()}
                disabled={!canDeleteTournament || deletingTournament}
              >
                {deletingTournament ? '削除中...' : '削除'}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
