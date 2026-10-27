import { useSyncExternalStore } from 'react'

// Router a hash: funziona sotto /orbita/ su GitHub Pages e offline,
// senza bisogno di riscrivere gli URL sul server.

export const ROUTES = [
  'oggi',
  'agenda',
  'briefing',
  'statistiche',
  'ripasso',
  'dattilografia',
  'dati',
  'regole',
] as const

export type RouteId = (typeof ROUTES)[number]

export interface Route {
  id: RouteId
  query: URLSearchParams
}

export const DEFAULT_ROUTE: RouteId = 'oggi'

function isRouteId(value: string): value is RouteId {
  return (ROUTES as readonly string[]).includes(value)
}

/** `#/agenda?giorno=2026-10-27` → { id: 'agenda', query: giorno=… } */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const [path = '', search = ''] = raw.split('?', 2)
  const id = path.split('/')[0]?.toLowerCase() ?? ''
  return { id: isRouteId(id) ? id : DEFAULT_ROUTE, query: new URLSearchParams(search) }
}

export function href(id: RouteId, query?: Record<string, string>): string {
  const search = query ? new URLSearchParams(query).toString() : ''
  return `#/${id}${search ? `?${search}` : ''}`
}

export function navigate(id: RouteId, query?: Record<string, string>): void {
  window.location.hash = href(id, query)
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const getHash = () => window.location.hash

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '')
  return parseHash(hash)
}
