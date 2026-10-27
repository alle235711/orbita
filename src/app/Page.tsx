import type { ReactNode } from 'react'
import './Page.css'

interface PageProps {
  className?: string
  labelledBy?: string
  children?: ReactNode
}

/** Contenitore di ogni schermata: lascia spazio alla barra in alto. */
export function Page({ className, labelledBy, children }: PageProps) {
  return (
    <main id="main" tabIndex={-1} className={`page${className ? ` ${className}` : ''}`} aria-labelledby={labelledBy}>
      {children}
    </main>
  )
}
