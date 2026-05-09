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
import type { Player } from '@/types'

function BuyinPageInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId') ?? ''

  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [pin, setPin] = useState('')
  const [amount, setAmount] = useState('')
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
    return Boolean(sessionId) && playerId && pin.length === 4 && Number(amount) > 0
  }, [sessionId, playerId, pin, amount])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!sessionId) {
      toast.error('sessionId クエリが必要です')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/buyins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          pin,
          amount: Number(amount),
          idempotencyKey: crypto.randomUUID(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '追加バイインに失敗しました')
      }

      toast.success('追加バイインを登録しました')
      setAmount('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '追加バイインに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>追加バイイン</CardTitle>
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
              <Label htmlFor="amount">追加バイイン額</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={!canSubmit || submitting}>
              {submitting ? '送信中...' : '追加する'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default function BuyinPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BuyinPageInner />
    </Suspense>
  )
}
