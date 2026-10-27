import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/global.css'
import { App } from './app/App'
import { applyDisk } from './app/disk'
import { DEFAULT_ENERGY } from './lib/energy'

applyDisk(DEFAULT_ENERGY)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
