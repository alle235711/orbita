import { useEffect, useState } from 'react'
import { logSession, logWorkout } from '../db/actions'
import { db } from '../db/db'
import { useSetting } from '../db/hooks'
import { getSetting, setSetting, type ActiveTimer } from '../db/settings'
import type { SessionType, WorkoutType } from '../db/schema'
import { getI18n } from '../i18n/store'
import { todayISO, toHHMM } from '../lib/dates'
import type { RenderedItem } from '../i18n/render'
import { toast } from './toast'

// Il timer di sessione avviato dal sommario di Oggi. Sta nelle impostazioni,
// così sopravvive a una ricarica della pagina e all'uscita dall'app.

const WORKOUTS: string[] = ['arrampicata', 'corsa', 'palestra']

export function timerFor(item: RenderedItem): ActiveTimer {
  return {
    key: item.key,
    title: item.title,
    kind: WORKOUTS.includes(item.kind) ? 'workout' : 'session',
    type: item.kind,
    courseId: item.courseId,
    startedAt: Date.now(),
  }
}

/** Ferma il timer in corso e salva la sessione o l'allenamento. */
export async function stopTimer(): Promise<void> {
  const timer = await getSetting(db, 'activeTimer')
  if (!timer) return
  const { t, f } = getI18n()
  await setSetting(db, 'activeTimer', null)
  const minutes = Math.round((Date.now() - timer.startedAt) / 60_000)
  if (minutes < 1) {
    toast(t.app.timer.tooShort({ title: timer.title }))
    return
  }
  const started = new Date(timer.startedAt)
  const date = todayISO(started)
  const start = toHHMM(started.getHours() * 60 + started.getMinutes())
  if (timer.type === 'camminata') {
    toast(t.app.timer.walkDone({ minutes }, f))
  } else if (timer.kind === 'workout') {
    await logWorkout({ date, start, minutes, type: timer.type as WorkoutType })
    toast(t.app.timer.savedWorkout({ minutes, title: timer.title }, f))
  } else {
    await logSession({ date, start, minutes, type: timer.type as SessionType, courseId: timer.courseId })
    toast(t.app.timer.savedSession({ minutes, title: timer.title }, f))
  }
}

/** Avvia una voce del piano; se ne stava andando un'altra, prima la salva. */
export async function startTimer(item: RenderedItem): Promise<void> {
  const current = await getSetting(db, 'activeTimer')
  if (current?.key === item.key) return stopTimer()
  if (current) await stopTimer()
  await setSetting(db, 'activeTimer', timerFor(item))
}

export function useActiveTimer(): ActiveTimer | null | undefined {
  return useSetting('activeTimer')
}

/** Tempo trascorso in secondi, aggiornato ogni secondo mentre il timer va. */
export function useElapsed(startedAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [startedAt])
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
