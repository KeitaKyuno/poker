import { NextResponse } from 'next/server'

import { Errors } from '@/lib/api/response'
import { TOURNAMENT_ERROR_CODES } from '@/lib/tournament-error-codes'
import { createServiceClient } from '@/lib/supabase/service'
import { PostTournamentResultsRequestSchema } from '@/lib/validation/schemas'
import { UuidSchema } from '@/lib/validation/schemas'

type SubmitTournamentResultsRpcRow = {
  player_id: string
  rank: number
}

const mapSubmitResultsError = (code: string | null) => {
  if (code === TOURNAMENT_ERROR_CODES.TOURNAMENT_NOT_FOUND) {
    return Errors.NOT_FOUND('トーナメントが見つかりません')
  }

  if (code === TOURNAMENT_ERROR_CODES.RESULT_COUNT_MISMATCH) {
    return Errors.BAD_REQUEST('順位提出件数が参加人数と一致しません')
  }

  if (code === TOURNAMENT_ERROR_CODES.PLAYER_NOT_ENTERED) {
    return Errors.BAD_REQUEST('参加していないプレイヤーが含まれています')
  }

  if (code === TOURNAMENT_ERROR_CODES.DUPLICATE_PLAYER) {
    return Errors.BAD_REQUEST('プレイヤーが重複しています')
  }

  if (code === TOURNAMENT_ERROR_CODES.DUPLICATE_RANK) {
    return Errors.BAD_REQUEST('順位が重複しています')
  }

  if (
    code === TOURNAMENT_ERROR_CODES.INVALID_RESULTS_FORMAT ||
    code === TOURNAMENT_ERROR_CODES.INVALID_RANK_RANGE ||
    code === TOURNAMENT_ERROR_CODES.INVALID_RANK_SEQUENCE
  ) {
    return Errors.BAD_REQUEST('順位は1から参加人数までの重複なし連番で入力してください')
  }

  return null
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let parsed

  try {
    parsed = PostTournamentResultsRequestSchema.parse(await request.json())
  } catch {
    return Errors.BAD_REQUEST('Invalid request body')
  }

  const { id } = await context.params

  try {
    UuidSchema.parse(id)
  } catch {
    return Errors.BAD_REQUEST('トーナメントIDが不正です')
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('submit_tournament_results', {
    p_tournament_id: id,
    p_results: parsed.results,
  })

  if (error) {
    const mapped = mapSubmitResultsError(error.code ?? null)
    if (mapped) {
      return mapped
    }
    console.error('[POST /api/tournaments/[id]/results] Unmapped RPC error', error)
    return Errors.INTERNAL()
  }

  return NextResponse.json({
    results: (data ?? []).map((result: SubmitTournamentResultsRpcRow) => ({
      playerId: result.player_id,
      rank: result.rank,
    })),
  })
}
