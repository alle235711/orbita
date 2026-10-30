import { lazy, Suspense, useEffect, useLayoutEffect, useRef, type ComponentType, type LazyExoticComponent } from 'react'
import { MotionConfig } from 'motion/react'
import { useDay } from '../db/hooks'
import { LangSync } from '../i18n/LangSync'
import { useLang, useT } from '../i18n/store'
import { DEFAULT_ENERGY } from '../lib/energy'
import { applyDisk } from './disk'
import { Nav } from './Nav'
import { useRoute, type RouteId } from './router'
import { Toasts } from './Toasts'
import { UpdateToast } from './UpdateToast'
import { useToday } from './useToday'

const PAGES: Record<RouteId, LazyExoticComponent<ComponentType>> = {
  oggi: lazy(() => import('../features/oggi/OggiPage')),
  agenda: lazy(() => import('../features/agenda/AgendaPage')),
  briefing: lazy(() => import('../features/briefing/BriefingPage')),
  regole: lazy(() => import('../features/regole/RegolePage')),
  statistiche: lazy(() => import('../features/statistiche/StatistichePage')),
  ripasso: lazy(() => import('../features/ripasso/RipassoPage')),
  dattilografia: lazy(() => import('../features/dattilografia/DattilografiaPage')),
  dati: lazy(() => import('../features/dati/DatiPage')),
}

/** Ripasso e Dattilografia stanno sulla lavagna; il resto nello spazio. */
const SLATE: RouteId[] = ['ripasso', 'dattilografia']

export function App() {
  const route = useRoute()
  const t = useT()
  const lang = useLang()
  const Current = PAGES[route.id]
  const first = useRef(true)
  const today = useDay(useToday())

  // Il colore del disco segue l'energia scelta oggi, in tutta l'app.
  useEffect(() => applyDisk(today?.energy ?? DEFAULT_ENERGY), [today?.energy])

  useLayoutEffect(() => {
    document.documentElement.dataset.surface = SLATE.includes(route.id) ? 'slate' : 'space'
    document.title = route.id === 'oggi' ? 'Orbita' : `${t.app.titles[route.id]} · Orbita`
  }, [route.id, lang, t])

  // Cambiando sezione si riparte dall'alto e il focus va al contenuto.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [route.id])

  return (
    <MotionConfig reducedMotion="user">
      <LangSync />
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault()
        document.getElementById('main')?.focus()
      }}>
        {t.app.skip}
      </a>
      <Nav current={route.id} bordered={route.id !== 'oggi'} />
      <Suspense fallback={null}>
        <Current />
      </Suspense>
      <Toasts />
      <UpdateToast />
    </MotionConfig>
  )
}
