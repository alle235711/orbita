import { useEffect, useRef } from 'react'
import { href, type RouteId } from './router'
import { TimerChip } from './TimerChip'
import './Nav.css'

export const NAV_ITEMS: { id: RouteId; label: string }[] = [
  { id: 'oggi', label: 'Oggi' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'statistiche', label: 'Statistiche' },
  { id: 'ripasso', label: 'Ripasso' },
  { id: 'dattilografia', label: 'Dattilografia' },
  { id: 'dati', label: 'Dati' },
]

// La schermata Regole si apre dal Briefing: in barra resta acceso Briefing.
const PARENT: Partial<Record<RouteId, RouteId>> = { regole: 'briefing' }

interface NavProps {
  current: RouteId
  bordered: boolean
}

export function Nav({ current, bordered }: NavProps) {
  const active = PARENT[current] ?? current
  const listRef = useRef<HTMLUListElement>(null)

  // Sul telefono la barra scorre: la voce attiva resta sempre visibile.
  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    link?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])

  return (
    <header className={`topbar${bordered ? ' topbar--bordered' : ''}`}>
      <nav className="topbar__nav" aria-label="Sezioni">
        <a className="topbar__mark" href={href('oggi')}>
          Orbita
        </a>
        <ul className="topbar__list" role="list" ref={listRef}>
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <a
                className="topbar__link"
                href={href(item.id)}
                aria-current={item.id === active ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="topbar__actions">
        <TimerChip />
        <div id="topbar-slot" className="topbar__actions" />
      </div>
    </header>
  )
}
