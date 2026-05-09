'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { BackButton } from '@/components/back-button'
import type { ApiErrorResponse, TournamentBlind, TournamentTimerState } from '@/types'

type TournamentListItem = {
  id: string
  date: string
  createdAt: string
}

type TournamentsResponse = {
  tournaments: TournamentListItem[]
}

type TournamentDetailResponse = {
  tournament: {
    id: string
    date: string
    blinds: TournamentBlind[]
    entries: unknown[]
    results: unknown[]
    timerState: TournamentTimerState | null
  }
}

type TimerState = {
  tournamentId: string
  blinds: TournamentBlind[]
  currentLevelIndex: number
  currentLevelStartTimestamp: number
  isPaused: boolean
  pausedRemainingSeconds: number | null
}

type ConfirmedTournament = {
  id: string
  date: string
  blinds: TournamentBlind[]
  timerState: TournamentTimerState | null
}

const TIMER_STORAGE_KEY = 'poker-timer-state'

function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function sortBlinds(blinds: TournamentBlind[]): TournamentBlind[] {
  return [...blinds].sort((a, b) => a.level - b.level)
}

function isValidTimerState(value: unknown): value is TimerState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TimerState>

  return (
    typeof candidate.tournamentId === 'string' &&
    Array.isArray(candidate.blinds) &&
    typeof candidate.currentLevelIndex === 'number' &&
    typeof candidate.currentLevelStartTimestamp === 'number' &&
    typeof candidate.isPaused === 'boolean' &&
    (candidate.pausedRemainingSeconds === null || typeof candidate.pausedRemainingSeconds === 'number')
  )
}

function getErrorMessage(data: ApiErrorResponse | unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const apiError = data as ApiErrorResponse
    if (apiError.error?.message) return apiError.error.message
  }
  return fallback
}

export default function TournamentTimerPage() {
  const [selectedDate, setSelectedDate] = useState<string>(formatDateInput(new Date()))
  const [confirmedTournament, setConfirmedTournament] = useState<ConfirmedTournament | null>(null)
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [isFinished, setIsFinished] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [, setNow] = useState<number>(Date.now())

  const timerStateRef = useRef<TimerState | null>(null)

  useEffect(() => {
    timerStateRef.current = timerState
  }, [timerState])

  const persistTimerState = useCallback((next: TimerState | null) => {
    if (next === null) {
      localStorage.removeItem(TIMER_STORAGE_KEY)
    } else {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(next))
    }

    if (!confirmedTournament) return

    const timerStateForDb: TournamentTimerState | null =
      next === null
        ? null
        : {
            currentLevelIndex: next.currentLevelIndex,
            currentLevelStartTimestamp: next.currentLevelStartTimestamp,
            isPaused: next.isPaused,
            pausedRemainingSeconds: next.pausedRemainingSeconds,
          }

    void fetch(`/api/tournaments/${confirmedTournament.id}/timer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timerState: timerStateForDb }),
    }).catch(() => {})
  }, [confirmedTournament])

  const flash = useCallback(() => {
    setIsFlashing(true)
    window.setTimeout(() => setIsFlashing(false), 200)
  }, [])

  const fetchTournamentDetail = useCallback(async (tournamentId: string): Promise<ConfirmedTournament> => {
    const response = await fetch(`/api/tournaments/${tournamentId}`)
    const data = (await response.json()) as TournamentDetailResponse | ApiErrorResponse

    if (!response.ok || !('tournament' in data)) {
      throw new Error(getErrorMessage(data, 'トーナメント情報の取得に失敗しました'))
    }

    const sortedBlinds = sortBlinds(data.tournament.blinds)
    if (sortedBlinds.length === 0) {
      throw new Error('ブラインド設定がありません')
    }

    return {
      id: data.tournament.id,
      date: data.tournament.date,
      blinds: sortedBlinds,
      timerState: data.tournament.timerState,
    }
  }, [])

  const onConfirm = useCallback(async () => {
    setIsConfirming(true)
    setErrorMessage(null)
    setInfoMessage(null)
    setConfirmedTournament(null)
    setTimerState(null)
    setIsFinished(false)

    try {
      const listResponse = await fetch('/api/tournaments?status=active')
      const listData = (await listResponse.json()) as TournamentsResponse | ApiErrorResponse

      if (!listResponse.ok || !('tournaments' in listData)) {
        throw new Error(getErrorMessage(listData, 'トーナメント一覧の取得に失敗しました'))
      }

      const matchedTournament = listData.tournaments.find((tournament) => tournament.date === selectedDate)

      if (!matchedTournament) {
        setInfoMessage('該当するトーナメントがありません')
        return
      }

      const detailedTournament = await fetchTournamentDetail(matchedTournament.id)
      setConfirmedTournament(detailedTournament)

      if (detailedTournament.timerState) {
        const safeIndex = Math.min(Math.max(detailedTournament.timerState.currentLevelIndex, 0), detailedTournament.blinds.length - 1)
        const restored: TimerState = {
          tournamentId: detailedTournament.id,
          blinds: detailedTournament.blinds,
          currentLevelIndex: safeIndex,
          currentLevelStartTimestamp: detailedTournament.timerState.currentLevelStartTimestamp,
          isPaused: detailedTournament.timerState.isPaused,
          pausedRemainingSeconds: detailedTournament.timerState.isPaused
            ? Math.max(0, detailedTournament.timerState.pausedRemainingSeconds ?? 0)
            : null,
        }
        setTimerState(restored)
        setInfoMessage('保存されたタイマーを復元しました。')
        return
      }

      const raw = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!raw) {
        setInfoMessage('タイマーが開始されていません')
        return
      }

      const parsed = JSON.parse(raw) as unknown
      if (!isValidTimerState(parsed)) {
        localStorage.removeItem(TIMER_STORAGE_KEY)
        setInfoMessage('タイマーが開始されていません')
        return
      }

      if (parsed.tournamentId !== detailedTournament.id) {
        setInfoMessage('タイマーが開始されていません')
        return
      }

      const safeIndex = Math.min(Math.max(parsed.currentLevelIndex, 0), detailedTournament.blinds.length - 1)
      const restored: TimerState = {
        tournamentId: parsed.tournamentId,
        blinds: detailedTournament.blinds,
        currentLevelIndex: safeIndex,
        currentLevelStartTimestamp: parsed.currentLevelStartTimestamp,
        isPaused: parsed.isPaused,
        pausedRemainingSeconds: parsed.isPaused ? Math.max(0, parsed.pausedRemainingSeconds ?? 0) : null,
      }

      setTimerState(restored)
      setInfoMessage('保存されたタイマーを復元しました。')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '確認に失敗しました')
    } finally {
      setIsConfirming(false)
    }
  }, [fetchTournamentDetail, selectedDate])

  const onStart = useCallback(() => {
    if (!confirmedTournament || timerState) return

    const next: TimerState = {
      tournamentId: confirmedTournament.id,
      blinds: confirmedTournament.blinds,
      currentLevelIndex: 0,
      currentLevelStartTimestamp: Date.now(),
      isPaused: false,
      pausedRemainingSeconds: null,
    }

    setTimerState(next)
    setIsFinished(false)
    setInfoMessage(null)
    setErrorMessage(null)
    persistTimerState(next)
  }, [confirmedTournament, persistTimerState, timerState])

  const updateTimerState = useCallback(
    (updater: (prev: TimerState) => TimerState | null) => {
      const prev = timerStateRef.current
      if (!prev) return

      const next = updater(prev)
      setTimerState(next)
      persistTimerState(next)
    },
    [persistTimerState]
  )

  const onPreviousLevel = useCallback(() => {
    updateTimerState((prev) => {
      if (prev.currentLevelIndex <= 0) return prev
      const next: TimerState = {
        ...prev,
        currentLevelIndex: prev.currentLevelIndex - 1,
        currentLevelStartTimestamp: Date.now(),
        isPaused: false,
        pausedRemainingSeconds: null,
      }
      flash()
      return next
    })
  }, [flash, updateTimerState])

  const onNextLevel = useCallback(() => {
    updateTimerState((prev) => {
      if (prev.currentLevelIndex >= prev.blinds.length - 1) return prev
      const next: TimerState = {
        ...prev,
        currentLevelIndex: prev.currentLevelIndex + 1,
        currentLevelStartTimestamp: Date.now(),
        isPaused: false,
        pausedRemainingSeconds: null,
      }
      flash()
      return next
    })
  }, [flash, updateTimerState])

  const onTogglePause = useCallback(() => {
    updateTimerState((prev) => {
      const currentLevel = prev.blinds[prev.currentLevelIndex]
      if (!currentLevel) return prev

      if (!prev.isPaused) {
        const elapsedSeconds = Math.floor((Date.now() - prev.currentLevelStartTimestamp) / 1000)
        const remaining = Math.max(0, currentLevel.durationMinutes * 60 - elapsedSeconds)
        return {
          ...prev,
          isPaused: true,
          pausedRemainingSeconds: remaining,
        }
      }

      const resumedRemaining = Math.max(0, prev.pausedRemainingSeconds ?? currentLevel.durationMinutes * 60)
      const resumedStart = Date.now() - (currentLevel.durationMinutes * 60 - resumedRemaining) * 1000
      return {
        ...prev,
        isPaused: false,
        pausedRemainingSeconds: null,
        currentLevelStartTimestamp: resumedStart,
      }
    })
  }, [updateTimerState])

  const onEnd = useCallback(() => {
    setTimerState(null)
    setIsFinished(false)
    setInfoMessage(null)
    setErrorMessage(null)
    persistTimerState(null)
  }, [persistTimerState])

  const remainingSeconds = (() => {
    if (!timerState) return 0
    const level = timerState.blinds[timerState.currentLevelIndex]
    if (!level) return 0

    if (timerState.isPaused) {
      return Math.max(0, timerState.pausedRemainingSeconds ?? 0)
    }

    return Math.max(0, level.durationMinutes * 60 - Math.floor((Date.now() - timerState.currentLevelStartTimestamp) / 1000))
  })()

  useEffect(() => {
    if (!timerState || timerState.isPaused || isFinished) return

    const intervalId = window.setInterval(() => {
      setNow(Date.now())

      const current = timerStateRef.current
      if (!current || current.isPaused) return

      const currentLevel = current.blinds[current.currentLevelIndex]
      if (!currentLevel) return

      const remaining =
        currentLevel.durationMinutes * 60 - Math.floor((Date.now() - current.currentLevelStartTimestamp) / 1000)

      if (remaining > 0) return

      if (current.currentLevelIndex >= current.blinds.length - 1) {
        setTimerState(null)
        setIsFinished(true)
        setInfoMessage('トーナメント終了')
        localStorage.removeItem(TIMER_STORAGE_KEY)
        return
      }

      const next: TimerState = {
        ...current,
        currentLevelIndex: current.currentLevelIndex + 1,
        currentLevelStartTimestamp: current.currentLevelStartTimestamp + currentLevel.durationMinutes * 60 * 1000,
        isPaused: false,
        pausedRemainingSeconds: null,
      }
      setTimerState(next)
      persistTimerState(next)
      flash()
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [flash, isFinished, persistTimerState, timerState])

  const currentBlind = timerState ? timerState.blinds[timerState.currentLevelIndex] : null
  const hasRunningTimerForTournament = Boolean(timerState && confirmedTournament && timerState.tournamentId === confirmedTournament.id)
  const startDisabled = !confirmedTournament || hasRunningTimerForTournament

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-10 text-white">
      <BackButton href="/" />
      {isFlashing ? <div className="pointer-events-none absolute inset-0 z-10 bg-primary/20" /> : null}

      <h1 className="text-2xl font-semibold">トーナメントタイマー</h1>

      <section className="space-y-4 rounded-xl border-2 border-white/80 bg-black/20 p-6">
        <p className="text-sm text-white/80">日付を選択して確認してください</p>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="w-full rounded-xl border-2 border-white/70 bg-transparent px-4 py-3 text-white outline-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-xl border-2 border-white/80 px-5 py-3 font-bold transition-all duration-200 hover:bg-white/10 hover:shadow-[0_0_16px_rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void onConfirm()
            }}
            disabled={isConfirming}
          >
            {isConfirming ? '確認中...' : '確認'}
          </button>
          <button
            type="button"
            className="rounded-xl border-2 border-white/80 px-5 py-3 font-bold transition-all duration-200 hover:bg-white/10 hover:shadow-[0_0_16px_rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onStart}
            disabled={startDisabled}
          >
            開始
          </button>
        </div>

        {errorMessage ? <p className="text-sm text-red-300">{errorMessage}</p> : null}
        {infoMessage ? <p className="text-sm text-white/80">{infoMessage}</p> : null}
      </section>

      {confirmedTournament ? (
        <section className="space-y-4 rounded-xl border-2 border-white/80 bg-black/20 p-6">
          <p className="text-sm text-white/80">{confirmedTournament.date} のブラインド構成</p>
          <div className="overflow-x-auto rounded-xl border border-white/30 text-sm">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-white/20 text-left text-white/70">
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">SB</th>
                  <th className="px-3 py-2">BB</th>
                  <th className="px-3 py-2">Ante</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {confirmedTournament.blinds.map((blind) => (
                  <tr key={blind.level} className="border-b border-white/10">
                    <td className="px-3 py-2">{blind.level}</td>
                    <td className="px-3 py-2">{blind.sb}</td>
                    <td className="px-3 py-2">{blind.bb}</td>
                    <td className="px-3 py-2">{blind.ante}</td>
                    <td className="px-3 py-2">{blind.durationMinutes}分</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {timerState ? (
        <section className="space-y-6 rounded-xl border-2 border-white/80 bg-black/20 p-6">
          <p className="text-center text-4xl font-bold">Level {currentBlind?.level ?? '-'}</p>

          <div className="grid gap-4 text-center sm:grid-cols-3">
            <div className="rounded-xl border border-white/50 p-4">
              <p className="text-sm text-white/70">SB</p>
              <p className="text-4xl font-bold">{currentBlind?.sb ?? '-'}</p>
            </div>
            <div className="rounded-xl border border-white/50 p-4">
              <p className="text-sm text-white/70">BB</p>
              <p className="text-4xl font-bold">{currentBlind?.bb ?? '-'}</p>
            </div>
            <div className="rounded-xl border border-white/50 p-4">
              <p className="text-sm text-white/70">Ante</p>
              <p className="text-4xl font-bold">{currentBlind?.ante ?? '-'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/70 bg-primary/10 p-6 text-center">
            <p className="text-sm text-white/70">残り時間</p>
            <p className="text-7xl font-bold tabular-nums">{formatTime(remainingSeconds)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={onPreviousLevel}
              disabled={timerState.currentLevelIndex === 0}
              className="rounded-xl border-2 border-white/80 px-5 py-3 font-bold transition-all duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ◀ 前
            </button>
            <button
              type="button"
              onClick={onNextLevel}
              disabled={timerState.currentLevelIndex >= timerState.blinds.length - 1}
              className="rounded-xl border-2 border-white/80 px-5 py-3 font-bold transition-all duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ▶ 次
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              className="rounded-xl border-2 border-white/80 px-5 py-3 font-bold transition-all duration-200 hover:bg-white/10"
            >
              {timerState.isPaused ? '▶ 再開' : '⏸ 一時停止'}
            </button>
            <button
              type="button"
              onClick={onEnd}
              className="rounded-xl border-2 border-white/80 px-5 py-3 font-bold transition-all duration-200 hover:bg-white/10"
            >
              ■ 終了
            </button>
          </div>
        </section>
      ) : null}

      {isFinished ? (
        <section className="rounded-xl border-2 border-white/80 bg-black/20 p-6 text-center">
          <p className="text-3xl font-bold">トーナメント終了</p>
        </section>
      ) : null}
    </main>
  )
}
