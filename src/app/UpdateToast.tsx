import { useRegisterSW } from 'virtual:pwa-register/react'
import { useT } from '../i18n/store'
import './UpdateToast.css'

// Con registerType 'prompt' la nuova versione aspetta il tuo via:
// così non si ricarica la pagina a metà di una scheda.
export function UpdateToast() {
  const t = useT().app.update
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
      <p>{needRefresh ? t.newVersion : t.offlineReady}</p>
      <div className="update-toast__actions">
        {needRefresh ? (
          <button type="button" className="btn btn--primary" onClick={() => void updateServiceWorker(true)}>
            {t.refresh}
          </button>
        ) : null}
        <button type="button" className="btn" onClick={close}>
          {needRefresh ? t.later : t.ok}
        </button>
      </div>
    </div>
  )
}
