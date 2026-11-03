import { useEffect, useRef } from 'react'
import { useModules } from '../db/hooks'
import { useBaseLang, useLang, useT } from '../i18n/store'
import { routeEnabled } from '../modules/registry'
import { DEFAULT_MODULES } from '../modules/types'
import { href, type RouteId } from './router'
import { TimerChip } from './TimerChip'
import './Nav.css'

export const NAV_ITEMS: { id: RouteId }[] = [
  { id: 'oggi' },
  { id: 'agenda' },
  { id: 'briefing' },
  { id: 'libretto' },
  { id: 'statistiche' },
  { id: 'ripasso' },
  { id: 'dattilografia' },
  { id: 'mazzi' },
  { id: 'dati' },
]

// La schermata Regole si apre dal Briefing: in barra resta acceso Briefing.
const PARENT: Partial<Record<RouteId, RouteId>> = { regole: 'briefing', multiverso: 'libretto' }

interface NavProps {
  current: RouteId
  bordered: boolean
}

export function Nav({ current, bordered }: NavProps) {
  const t = useT()
  const lang = useLang()
  const base = useBaseLang()
  const modules = useModules() ?? DEFAULT_MODULES
  const active = PARENT[current] ?? current
  const items = NAV_ITEMS.filter((item) => routeEnabled(modules, item.id))
  const listRef = useRef<HTMLUListElement>(null)

  // Sul telefono la barra scorre: la voce attiva resta sempre visibile.
  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    link?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])

  return (
    <header className={`topbar${bordered ? ' topbar--bordered' : ''}`}>
      <nav className="topbar__nav" aria-label={t.nav.sections}>
        <div className="topbar__brand">
          <a className="topbar__mark" href={href('oggi')}>
            Orbita
          </a>
          {lang !== base ? (
            <span className="topbar__lang" role="img" aria-label={t.nav.langBadge[lang]}>
              {lang.toUpperCase()}
            </span>
          ) : null}
        </div>
        <ul className="topbar__list" role="list" ref={listRef}>
          {items.map((item) => (
            <li key={item.id}>
              <a
                className="topbar__link"
                href={href(item.id)}
                aria-current={item.id === active ? 'page' : undefined}
              >
                {t.nav.items[item.id]}
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
