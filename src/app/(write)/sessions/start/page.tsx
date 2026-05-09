'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PinInput } from '@/components/forms/PinInput'
import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GetSessionsResponse, Player, Session } from '@/types'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function StartSessionPage() {
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [pin, setPin] = useState('')
  const [sessionDate, setSessionDate] = useState(today())
  const [initialBuyinAmount, setInitialBuyinAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null)
  const [inProgressSession, setInProgressSession] = useState<Session | null>(null)

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/players')
      const data = await response.json()
      setPlayers(data.players ?? [])
    }
    void load()
  }, [])

  useEffect(() => {
    if (!playerId) {
      setInProgressSession(null)
      return
    }

    const controller = new AbortController()

    const loadInProgressSession = async () => {
      const query = new URLSearchParams({ playerId, status: 'in_progress' })
      const response = await fetch(`/api/sessions?${query.toString()}`, { signal: controller.signal })
      const data = (await response.json()) as GetSessionsResponse

      if (!response.ok) {
        throw new Error('進行中セッションの確認に失敗しました')
      }

      setInProgressSession(data.sessions[0] ?? null)
    }

    void loadInProgressSession().catch((error) => {
      if ((error as { name?: string }).name === 'AbortError') return
      setInProgressSession(null)
      toast.error(error instanceof Error ? error.message : '進行中セッションの確認に失敗しました')
    })

    return () => {
      controller.abort()
    }
  }, [playerId])

  const canSubmit = useMemo(() => {
    return playerId && pin.length === 4 && Number(initialBuyinAmount) > 0
  }, [playerId, pin, initialBuyinAmount])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          pin,
          sessionDate,
          initialBuyinAmount: Number(initialBuyinAmount),
          idempotencyKey: crypto.randomUUID(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? 'セッション開始に失敗しました')
      }

      setCreatedSessionId(data.session.id)
      toast.success('セッションを開始しました')
      router.push(`/sessions/${data.session.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'セッション開始に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>参加登録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {inProgressSession ? (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
              <p className="text-sm font-medium">進行中のセッションがあります</p>
              <Button asChild className="mt-3" variant="outline">
                <Link href={`/sessions/${inProgressSession.id}`}>セッションを続ける</Link>
              </Button>
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>プレイヤー</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger className="w-full">
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
              <Label htmlFor="sessionDate">日付</Label>
              <Input
                id="sessionDate"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialBuyinAmount">初回バイイン額</Label>
              <Input
                id="initialBuyinAmount"
                type="number"
                min={1}
                value={initialBuyinAmount}
                onChange={(e) => setInitialBuyinAmount(e.target.value)}
                required
              />
            </div>

            <Button className="w-full" type="submit" disabled={!canSubmit || submitting}>
              {submitting ? '送信中...' : '開始する'}
            </Button>
          </form>

          {createdSessionId ? (
            <div className="mt-6 space-y-2 rounded-lg border p-3 text-sm">
              <p>
                セッションID: <span className="font-mono">{createdSessionId}</span>
              </p>
              <div className="flex gap-4">
                <Link className="text-primary underline" href={`/sessions/buyin?sessionId=${createdSessionId}`}>
                  追加バイインへ
                </Link>
                <Link className="text-primary underline" href={`/sessions/close?sessionId=${createdSessionId}`}>
                  終了入力へ
                </Link>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
