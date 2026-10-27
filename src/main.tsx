import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/global.css'
import { App } from './app/App'
import { applyDisk } from './app/disk'
import { db } from './db/db'
import { initDb, requestPersistence } from './db/init'
import { DEFAULT_ENERGY } from './lib/energy'

applyDisk(DEFAULT_ENERGY)
initDb(db).catch((error: unknown) => console.error('Inizializzazione dei dati non riuscita', error))
void requestPersistence()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
