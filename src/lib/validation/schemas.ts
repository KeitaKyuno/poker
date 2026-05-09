import { z } from 'zod'

const PinSchema = z.string().regex(/^[0-9]{4}$/)
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const UUIDSchema = z.string().uuid()
const PositiveIntSchema = z.number().int().positive()

export const PostPlayersRequestSchema = z.object({
  name: z.string().min(1),
  pin: PinSchema,
})

export const PostSessionsRequestSchema = z.object({
  playerId: z.string().uuid(),
  pin: PinSchema,
  sessionDate: DateSchema,
  initialBuyinAmount: PositiveIntSchema,
  idempotencyKey: UUIDSchema,
})

export const PostSessionBuyinsRequestSchema = z.object({
  playerId: z.string().uuid(),
  pin: PinSchema,
  amount: PositiveIntSchema,
  idempotencyKey: UUIDSchema,
})

export const PatchBuyinRequestSchema = z.object({
  playerId: z.string().uuid(),
  pin: PinSchema,
  amount: PositiveIntSchema,
})

export const DeleteBuyinRequestSchema = z.object({
  playerId: z.string().uuid(),
  pin: PinSchema,
})

export const PatchSessionRequestSchema = z.object({
  playerId: z.string().uuid(),
  pin: PinSchema,
  sessionDate: DateSchema.optional(),
  status: z.enum(['in_progress', 'closed']).optional(),
  totalCashoutAmount: z.number().int().min(0).nullable().optional(),
})

export const PostSessionCloseRequestSchema = z.object({
  playerId: z.string().uuid(),
  pin: PinSchema,
  totalCashoutAmount: z.number().int().min(0),
})

export const PostTournamentsRequestSchema = z.object({
  date: DateSchema,
  players: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        startingLevel: z.number().int().min(1).default(1),
      })
    )
    .min(1),
  blinds: z
    .array(
      z.object({
        level: z.number().int().min(1),
        sb: z.number().int().positive(),
        bb: z.number().int().positive(),
        ante: z.number().int().min(0),
        durationMinutes: z.number().int().positive(),
      })
    )
    .min(1),
})

export const PostTournamentResultsRequestSchema = z.object({
  results: z.array(
    z.object({
      playerId: z.string().uuid(),
      rank: z.number().int().min(1),
    })
  ),
})

export const PostTournamentEntryRequestSchema = z.object({
  playerId: z.string().uuid(),
  startingLevel: z.number().int().min(1),
})
