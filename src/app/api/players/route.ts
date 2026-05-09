import { NextResponse } from 'next/server'

import { hashPin } from '@/lib/auth/pin'
import { Errors } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/service'
import { PostPlayersRequestSchema } from '@/lib/validation/schemas'

type PlayerRow = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

function toPlayer(row: PlayerRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('players')
    .select('id,name,created_at,updated_at')
    .order('created_at', { ascending: true })

  if (error) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({ players: (data ?? []).map(toPlayer) })
}

export async function POST(request: Request) {
  let parsed

  try {
    const body = await request.json()
    parsed = PostPlayersRequestSchema.parse(body)
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const supabase = createServiceClient()
  const passwordHash = await hashPin(parsed.pin)

  const { data, error } = await supabase
    .from('players')
    .insert({ name: parsed.name.trim(), password_hash: passwordHash })
    .select('id,name,created_at,updated_at')
    .single()

  if (error?.code === '23505') {
    return Errors.DUPLICATE_ENTRY()
  }

  if (error || !data) {
    return Errors.INTERNAL()
  }

  return NextResponse.json({ player: toPlayer(data) }, { status: 201 })
}
