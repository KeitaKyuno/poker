'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { PinInput } from '@/components/forms/PinInput'
import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewPlayerPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message ?? '登録に失敗しました')
      }

      toast.success('プレイヤーを登録しました')
      router.push('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <BackButton href="/" />
      <Card>
        <CardHeader>
          <CardTitle>プレイヤー登録</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">プレイヤー名</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (4桁)</Label>
              <PinInput id="pin" value={pin} onChange={(e) => setPin(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '送信中...' : '登録する'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
