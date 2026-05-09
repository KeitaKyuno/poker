import { NextResponse } from 'next/server'

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export const Errors = {
  NOT_FOUND: (msg = 'Not found') => apiError('NOT_FOUND', msg, 404),
  UNAUTHORIZED: (msg = 'Unauthorized') => apiError('UNAUTHORIZED', msg, 401),
  INVALID_PIN: () => apiError('INVALID_PIN', 'Invalid PIN', 401),
  SESSION_CLOSED: () => apiError('SESSION_CLOSED', 'Session is already closed', 422),
  SESSION_ALREADY_IN_PROGRESS: () =>
    apiError('SESSION_ALREADY_IN_PROGRESS', 'Player already has an in-progress session', 409),
  DUPLICATE_ENTRY: () => apiError('DUPLICATE_ENTRY', 'Duplicate entry', 409),
  RATE_LIMITED: () => apiError('RATE_LIMITED', 'Too many requests', 429),
  BAD_REQUEST: (msg: string) => apiError('BAD_REQUEST', msg, 400),
  INTERNAL: () => apiError('INTERNAL_ERROR', 'Internal server error', 500),
}
