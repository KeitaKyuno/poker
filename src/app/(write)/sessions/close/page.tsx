'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { PinInput } from '@/components/forms/PinInput'
import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Player, Session } from '@/types'

function CloseSessionPageInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId') ?? ''

  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [pin, setPin] = useState('')
  const [totalCashoutAmount, setTotalCashoutAmount] = useState('')
  const [resultSession, setResultSession] = useState<Session | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/players')
      const data = await response.json()
      setPlayers(data.players ?? [])
    }
    void load()
  }, [])

  const canSubmit = useMemo(() => {
    return Boolean(sessionId) && playerId && pin.length === 4 && Number(totalCashoutAmount) >= 0
  }, [sessionId, playerId, pin, totalCashoutAmount])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!sessionId) {
      toast.error('sessionId クエリが必要です')
      return
    }

    setSubmitting(true)

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

      setResultSession(data.session)
      toast.success('セッションを終了しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'セッション終了に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const net = resultSession?.netProfit ?? null

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>セッション終了</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">sessionId: {sessionId || '(未指定)'}</p>
          <form onSubmit={onSubmit} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="cashout">合計獲得額</Label>
              <Input
                id="cashout"
                type="number"
                min={0}
                value={totalCashoutAmount}
                onChange={(e) => setTotalCashoutAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={!canSubmit || submitting}>
              {submitting ? '送信中...' : '終了する'}
            </Button>
          </form>

          {net !== null ? (
            <div className="mt-6 rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">純利益</p>
              <p className={`text-4xl font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {net >= 0 ? '+' : ''}
                {net.toLocaleString('ja-JP')} pt
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}

export default function CloseSessionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CloseSessionPageInner />
    </Suspense>
  )
}
