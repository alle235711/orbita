import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Mette i comandi di una schermata (es. "Registra") a destra nella barra. */
export function TopbarActions({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => setTarget(document.getElementById('topbar-slot')), [])
  return target ? createPortal(children, target) : null
}
