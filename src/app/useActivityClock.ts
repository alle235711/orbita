import { useCallback, useEffect, useRef } from 'react'
import { logSession } from '../db/actions'
import type { SessionType } from '../db/schema'
import type { ISODate } from '../lib/dates'

/**
 * Accumula il tempo passato a scrivere e lo salva come una sessione quando
 * esci dalla schermata, cambi materia o metti l'app in secondo piano.
 */
export function useActivityClock(type: SessionType, today: ISODate, courseId?: string): (activeMs: number) => void {
  const ms = useRef(0)
  const flush = useCallback(() => {
    if (ms.current >= 30_000) void logSession({ date: today, type, minutes: Math.max(1, Math.round(ms.current / 60_000)), courseId })
    ms.current = 0
  }, [type, today, courseId])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  // una scheda lasciata a metà per ore non diventa un pomeriggio di studio
  return (activeMs: number) => {
    ms.current += Math.max(0, Math.min(activeMs, 20 * 60_000))
  }
}
