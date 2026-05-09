import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

type LimitResult = {
  success: boolean
}

type Limiter = {
  limit: (key: string) => Promise<LimitResult>
}

const hasUpstashConfig =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

const passThroughLimiter: Limiter = {
  // TODO: Configure Upstash Redis before production. This fallback does not enforce rate limits.
  async limit() {
    return { success: true }
  },
}

const redis = hasUpstashConfig ? Redis.fromEnv() : null

const writeLimiter: Limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rl:write',
    })
  : passThroughLimiter

const pinLimiter: Limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 m'),
      prefix: 'rl:pin',
    })
  : passThroughLimiter

function isWriteApi(request: NextRequest) {
  const method = request.method.toUpperCase()
  return ['POST', 'PATCH', 'DELETE'].includes(method) && request.nextUrl.pathname.startsWith('/api/')
}

function isPinSensitiveRoute(request: NextRequest) {
  const method = request.method.toUpperCase()
  const pathname = request.nextUrl.pathname

  if (method === 'POST' && pathname === '/api/players') return true
  if (method === 'POST' && pathname === '/api/sessions') return true
  if (method === 'POST' && /^\/api\/sessions\/[^/]+\/buyins$/.test(pathname)) return true
  if (method === 'POST' && /^\/api\/sessions\/[^/]+\/close$/.test(pathname)) return true
  if (method === 'PATCH' && /^\/api\/sessions\/[^/]+$/.test(pathname)) return true
  if ((method === 'PATCH' || method === 'DELETE') && /^\/api\/buyins\/[^/]+$/.test(pathname)) return true

  return false
}

function getRequestIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

function rateLimitExceededResponse() {
  return NextResponse.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    { status: 429, headers: { 'Retry-After': '60' } }
  )
}

export async function middleware(request: NextRequest) {
  if (!isWriteApi(request)) {
    return NextResponse.next()
  }

  const ip = getRequestIp(request)

  const writeResult = await writeLimiter.limit(`write:${ip}`)
  if (!writeResult.success) {
    return rateLimitExceededResponse()
  }

  if (isPinSensitiveRoute(request)) {
    const pinResult = await pinLimiter.limit(`pin:${ip}`)
    if (!pinResult.success) {
      return rateLimitExceededResponse()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
