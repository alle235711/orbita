import { lazy, Suspense, useEffect, useLayoutEffect, useRef, type ComponentType, type LazyExoticComponent } from 'react'
import { MotionConfig } from 'motion/react'
import { useDay, useModules } from '../db/hooks'
import { useOnboarding } from '../db/onboarding'
import { LangSync } from '../i18n/LangSync'
import { useLang, useT } from '../i18n/store'
import { DEFAULT_ENERGY } from '../lib/energy'
import { routeEnabled } from '../modules/registry'
import { applyDisk } from './disk'
import { Nav } from './Nav'
import { href, useRoute, type RouteId } from './router'
import { Toasts } from './Toasts'
import { UpdateToast } from './UpdateToast'
import { useToday } from './useToday'

const PAGES: Record<RouteId, LazyExoticComponent<ComponentType>> = {
  oggi: lazy(() => import('../features/oggi/OggiPage')),
  agenda: lazy(() => import('../features/agenda/AgendaPage')),
  briefing: lazy(() => import('../features/briefing/BriefingPage')),
  libretto: lazy(() => import('../features/libretto/LibrettoPage')),
  regole: lazy(() => import('../features/regole/RegolePage')),
  multiverso: lazy(() => import('../features/multiverso/MultiversoPage')),
  statistiche: lazy(() => import('../features/statistiche/StatistichePage')),
  ripasso: lazy(() => import('../features/ripasso/RipassoPage')),
  dattilografia: lazy(() => import('../features/dattilografia/DattilografiaPage')),
  mazzi: lazy(() => import('../features/mazzi/MazziPage')),
  dati: lazy(() => import('../features/dati/DatiPage')),
}

// Il percorso guidato non è una sezione: sostituisce tutta l'interfaccia finché serve.
const Benvenuto = lazy(() => import('../features/benvenuto/Benvenuto').then((m) => ({ default: m.Benvenuto })))

/** Ripasso e Dattilografia stanno sulla lavagna; il resto nello spazio. */
const SLATE: RouteId[] = ['ripasso', 'dattilografia']

export function App() {
  const route = useRoute()
  const t = useT()
  const lang = useLang()
  const Current = PAGES[route.id]
  const first = useRef(true)
  const today = useDay(useToday())
  const modules = useModules()
  const onboarding = useOnboarding()
  const reopen = route.query.get('completa') === '1'
  // Una sezione di un modulo spento non si apre: si torna a Oggi senza far vedere nulla.
  const blocked = !!modules && !routeEnabled(modules, route.id)

  // Il colore del disco segue l'energia scelta oggi, in tutta l'app.
  useEffect(() => applyDisk(today?.energy ?? DEFAULT_ENERGY), [today?.energy])

  useLayoutEffect(() => {
    document.documentElement.dataset.surface = SLATE.includes(route.id) ? 'slate' : 'space'
    document.title = route.id === 'oggi' ? 'Orbita' : `${t.app.titles[route.id]} · Orbita`
  }, [route.id, lang, t])

  useLayoutEffect(() => {
    if (blocked) window.location.replace(href('oggi'))
  }, [blocked])

  // Cambiando sezione si riparte dall'alto e il focus va al contenuto.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [route.id])

  const guide = onboarding === 'wizard' ? 'first' : reopen && onboarding !== 'loading' ? 'complete' : null

  return (
    <MotionConfig reducedMotion="user">
      <LangSync />
      {onboarding === 'loading' ? (
        // Finché non si sa se è un primo avvio non si mostra nulla: niente lampo del percorso.
        <div className="boot" />
      ) : guide ? (
        <Suspense fallback={<div className="boot" />}>
          <Benvenuto mode={guide} />
        </Suspense>
      ) : (
        <>
          <a className="skip-link" href="#main" onClick={(e) => {
            e.preventDefault()
            document.getElementById('main')?.focus()
          }}>
            {t.app.skip}
          </a>
          <Nav current={route.id} bordered={route.id !== 'oggi'} />
          <Suspense fallback={null}>{blocked ? null : <Current />}</Suspense>
        </>
      )}
      <Toasts />
      <UpdateToast />
    </MotionConfig>
  )
}
