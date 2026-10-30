import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { importDemo, isoDate, isoWeekday, seedV1Database, setLanguage, walkWizard } from './helpers'

// Screenshot di ogni schermata alle tre dimensioni di riferimento (SPEC §1),
// con i dati dimostrativi e l'ora fissata alle 10:20, per avere sempre
// l'orbita a metà mattina. Le immagini di Chromium vanno in docs/screenshots/.
// Il percorso guidato si fotografa su un database nuovo, la copertina con
// "Completa il profilo" su un database della fase 1 aggiornato.

const VIEWPORTS = [
  { name: '1180x820', width: 1180, height: 820, mobile: false },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '1280x800', width: 1280, height: 800, mobile: false },
]

type Setup = 'demo' | 'wizard' | 'migrated'
interface Screen {
  name: string
  hash?: string
  setup?: Setup
  step?: 1 | 2 | 3 | 4 | 5
  full?: boolean
  type?: string
  otherLanguage?: boolean
  /** Dopo il caricamento, preme il primo pulsante con questo nome (per fotografare un pannello aperto). */
  click?: RegExp
}

const SCREENS: Screen[] = [
  { name: 'oggi', hash: '#/oggi' },
  { name: 'agenda', hash: '#/agenda', full: true },
  { name: 'agenda-settimana', hash: '#/agenda?vista=settimana', full: true },
  { name: 'briefing', hash: '#/briefing', full: true },
  { name: 'libretto', hash: '#/libretto', full: true },
  { name: 'libretto-voto', hash: '#/libretto', click: /registra un voto|record a result/i },
  { name: 'regole', hash: '#/regole', full: true },
  { name: 'statistiche', hash: '#/statistiche', full: true },
  { name: 'ripasso', hash: '#/ripasso?materia=demo-c-1', type: 'Il periodo di un pendolo semplice dipende dalla lunghezza' },
  { name: 'dattilografia', hash: '#/dattilografia', full: true },
  { name: 'dati', hash: '#/dati', full: true },
  // Giorno nell'altra lingua: il giorno della settimana di oggi è tra quelli in inglese.
  { name: 'oggi-en', hash: '#/oggi', otherLanguage: true },
  { name: 'briefing-en', hash: '#/briefing', full: true, otherLanguage: true },
  // Il percorso guidato, passo per passo, a movimento ridotto: il buco nero è già composto.
  ...([1, 2, 3, 4, 5] as const).map((step): Screen => ({ name: `benvenuto-${step}`, setup: 'wizard', step })),
  // Chi arriva dalla fase 1: la copertina invita a completare il profilo.
  { name: 'completa-profilo', setup: 'migrated', hash: '#/oggi' },
]

const now = new Date()
now.setHours(10, 20, 0, 0)
const today = isoDate(now)

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.mobile,
      isMobile: vp.mobile,
      deviceScaleFactor: vp.mobile ? 2 : 1,
      reducedMotion: 'reduce',
    })

    for (const screen of SCREENS) {
      test(screen.name, async ({ page }, testInfo) => {
        await page.clock.setFixedTime(now)
        const setup = screen.setup ?? 'demo'
        if (setup === 'wizard') await walkWizard(page, screen.step!)
        else if (setup === 'migrated') await seedV1Database(page)
        else await importDemo(page, testInfo, today)
        if (screen.otherLanguage) await setLanguage(page, { base: 'it', otherDays: [isoWeekday(now)] })
        if (setup !== 'wizard') {
          await page.goto(`/${screen.hash}`)
          await page.reload()
        }
        await page.waitForLoadState('networkidle')
        if (screen.type) {
          const typer = page.locator('#typer')
          if (await typer.isVisible()) await typer.pressSequentially(screen.type)
        }
        // L'avviso "funziona anche senza rete" non fa parte della schermata.
        const notice = page.locator('.update-toast button')
        await notice.first().waitFor({ timeout: 3000 }).catch(() => undefined)
        if (await notice.count()) await notice.first().click()
        if (setup === 'wizard') await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
        await page.waitForTimeout(800)
        if (screen.click) {
          await page.getByRole('button', { name: screen.click }).first().click()
          // Il pannello è fotografato a entrata finita.
          await page.waitForFunction(() => {
            const d = document.querySelector('dialog[open]')
            return !!d && getComputedStyle(d).opacity === '1' && getComputedStyle(d).transform === 'none'
          })
          await page.waitForTimeout(500)
        }
        const dir = testInfo.project.name === 'chromium' ? `docs/screenshots/${vp.name}` : testInfo.outputPath(vp.name)
        mkdirSync(dir, { recursive: true })
        await page.screenshot({ path: `${dir}/${screen.name}.png`, fullPage: !!screen.full })
      })
    }
  })
}
