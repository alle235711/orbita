import { formatElapsed, stopTimer, useActiveTimer, useElapsed } from './timer'
import './TimerChip.css'

/** Il timer in corso, visibile in barra da tutte le schermate. */
export function TimerChip() {
  const timer = useActiveTimer()
  const elapsed = useElapsed(timer?.startedAt)
  if (!timer) return null
  return (
    <button
      type="button"
      className="timer-chip press"
      onClick={() => void stopTimer()}
      aria-label={`${timer.title}, in corso da ${formatElapsed(elapsed)}. Ferma e salva.`}
    >
      <span className="timer-chip__dot" aria-hidden="true" />
      <span className="timer-chip__title">{timer.title}</span>
      <span className="timer-chip__time tnum">{formatElapsed(elapsed)}</span>
      <svg className="timer-chip__stop" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="1.5" y="1.5" width="9" height="9" rx="2" fill="currentColor" />
      </svg>
    </button>
  )
}
