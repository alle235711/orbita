import { useRegisterSW } from 'virtual:pwa-register/react'
import './UpdateToast.css'

// Con registerType 'prompt' la nuova versione aspetta il tuo via:
// così non si ricarica la pagina a metà di una scheda.
export function UpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="update-toast" role="status">
      <p>{needRefresh ? 'C’è una nuova versione di Orbita.' : 'Orbita ora funziona anche senza rete.'}</p>
      <div className="update-toast__actions">
        {needRefresh ? (
          <button type="button" className="btn btn--primary" onClick={() => void updateServiceWorker(true)}>
            Aggiorna
          </button>
        ) : null}
        <button type="button" className="btn" onClick={close}>
          {needRefresh ? 'Più tardi' : 'Va bene'}
        </button>
      </div>
    </div>
  )
}
