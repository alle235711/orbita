import { useEffect, useState } from 'react'
import { todayISO, type ISODate } from '../lib/dates'

/** La data di oggi, che cambia da sola a mezzanotte o al ritorno sull'app. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO)

  useEffect(() => {
    const refresh = () => setToday(todayISO())
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const timer = window.setTimeout(refresh, midnight.getTime() - now.getTime())
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [today])

  return today
}

/** I minuti dalla mezzanotte, aggiornati ogni minuto. */
export function useMinuteClock(): number {
  const read = () => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  }
  const [minutes, setMinutes] = useState(read)
  useEffect(() => {
    const tick = () => setMinutes(read())
    const timer = window.setInterval(tick, 20_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return minutes
}
