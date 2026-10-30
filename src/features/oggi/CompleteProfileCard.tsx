import { useState } from 'react'
import { href } from '../../app/router'
import { useOnboarding } from '../../db/onboarding'
import { useT } from '../../i18n/store'

const DISMISS_KEY = 'orbita.dismissCompleta'

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Invito discreto per chi ha già dei dati ma un profilo da completare (per
 * esempio dopo l'aggiornamento): non blocca nulla e sta nel flusso in basso
 * della copertina, quindi non sposta l'orbita.
 */
export function CompleteProfileCard() {
  const t = useT()
  const state = useOnboarding()
  const [dismissed, setDismissed] = useState(dismissedThisSession)
  if (state !== 'complete-profile' || dismissed) return null
  const tc = t.profilo.complete

  const later = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // senza sessionStorage l'invito sparisce comunque fino alla prossima apertura
    }
    setDismissed(true)
  }

  return (
    <section className="complete-card swap-in" aria-labelledby="complete-title">
      <span className="complete-card__dot" aria-hidden="true" />
      <div className="complete-card__body">
        <h2 id="complete-title">{tc.title}</h2>
        <p>{tc.text}</p>
      </div>
      <div className="complete-card__actions">
        <a className="btn btn--primary" href={href('oggi', { completa: '1' })}>
          {tc.open}
        </a>
        <button type="button" className="complete-card__later" onClick={later}>
          {tc.later}
        </button>
      </div>
    </section>
  )
}
