'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PinInput } from '@/components/forms/PinInput'
import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Player, Session } from '@/types'

const AUTH_STORAGE_KEY = 'session-manager-auth'

type StoredAuth = {
  playerId: string
  pin: string
}

export default function SessionManagementPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [pin, setPin] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [buyinAmount, setBuyinAmount] = useState('')
  const [totalCashoutAmount, setTotalCashoutAmount] = useState('')
  const [buyinSubmitting, setBuyinSubmitting] = useState(false)
  const [closeSubmitting, setCloseSubmitting] = useState(false)

  useEffect(() => {
    const loadPlayers = async () => {
      const response = await fetch('/api/players')
      const data = await response.json()
      setPlayers(data.players ?? [])
    }
    void loadPlayers()

    const saved = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!saved) return
    try {
      const auth = JSON.parse(saved) as StoredAuth
      setPlayerId(auth.playerId ?? '')
      setPin(auth.pin ?? '')
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const loadSession = async () => {
      const response = await fetch(`/api/sessions/${sessionId}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? 'セッションの取得に失敗しました')
      }
      setSession(data.session)
    }

    void loadSession().catch((error) => {
      toast.error(error instanceof Error ? error.message : 'セッションの取得に失敗しました')
    })
  }, [sessionId])

  useEffect(() => {
    if (!playerId || pin.length !== 4) return
    const auth: StoredAuth = { playerId, pin }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  }, [playerId, pin])

  const canSubmitBuyin = useMemo(() => {
    return playerId && pin.length === 4 && Number(buyinAmount) > 0
  }, [playerId, pin, buyinAmount])

  const canSubmitClose = useMemo(() => {
    return playerId && pin.length === 4 && Number(totalCashoutAmount) >= 0
  }, [playerId, pin, totalCashoutAmount])

  const onSubmitBuyin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBuyinSubmitting(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/buyins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          pin,
          amount: Number(buyinAmount),
          idempotencyKey: crypto.randomUUID(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '追加バイインに失敗しました')
      }

      setSession(data.session)
      setBuyinAmount('')
      toast.success('追加バイインを登録しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '追加バイインに失敗しました')
    } finally {
      setBuyinSubmitting(false)
    }
  }

  const onSubmitClose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCloseSubmitting(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          pin,
          totalCashoutAmount: Number(totalCashoutAmount),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? 'セッション終了に失敗しました')
      }

      setSession(data.session)
      toast.success('セッションを終了しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'セッション終了に失敗しました')
    } finally {
      setCloseSubmitting(false)
    }
  }

  const net = session?.netProfit

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>追加バイイン/ゲーム終了</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1 text-sm">
            <p>
              現在のバイイン合計:{' '}
              <span className="font-semibold">{(session?.totalBuyinAmount ?? 0).toLocaleString('ja-JP')} pt</span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>プレイヤー</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
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
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <PinInput id="pin" value={pin} onChange={(e) => setPin(e.target.value)} required />
            </div>
          </div>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">追加バイイン</h2>
            <form onSubmit={onSubmitBuyin} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="buyinAmount">追加バイイン額</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="buyinAmount"
                    type="number"
                    min={1}
                    value={buyinAmount}
                    onChange={(e) => setBuyinAmount(e.target.value)}
                    required
                  />
                  <span className="text-sm text-muted-foreground">pt</span>
                </div>
              </div>
              <Button className="w-full" type="submit" disabled={!canSubmitBuyin || buyinSubmitting}>
                {buyinSubmitting ? '送信中...' : '追加バイインを登録'}
              </Button>
            </form>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">ゲーム終了</h2>
            <form onSubmit={onSubmitClose} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cashoutAmount">合計獲得額</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="cashoutAmount"
                    type="number"
                    min={0}
                    value={totalCashoutAmount}
                    onChange={(e) => setTotalCashoutAmount(e.target.value)}
                    required
                  />
                  <span className="text-sm text-muted-foreground">pt</span>
                </div>
              </div>
              <Button className="w-full" type="submit" disabled={!canSubmitClose || closeSubmitting}>
                {closeSubmitting ? '送信中...' : 'ゲームを終了'}
              </Button>
            </form>

            {net !== null && net !== undefined ? (
              <div className="space-y-2 rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">純利益</p>
                <p className={`text-4xl font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {net >= 0 ? '+' : ''}
                  {net.toLocaleString('ja-JP')} pt
                </p>
                <Link href="/ranking/overall" className="text-sm text-primary underline">
                  ランキングを見る
                </Link>
              </div>
            ) : null}
          </section>
        </CardContent>
      </Card>
    </main>
  )
}
