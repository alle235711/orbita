import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { importDemo, isoDate } from './helpers'

// Screenshot di ogni schermata alle tre dimensioni di riferimento (SPEC §1),
// con i dati dimostrativi e l'ora fissata alle 10:20, per avere sempre
// l'orbita a metà mattina. Le immagini di Chromium vanno in docs/screenshots/.

const VIEWPORTS = [
  { name: '1180x820', width: 1180, height: 820, mobile: false },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '1280x800', width: 1280, height: 800, mobile: false },
]

const SCREENS: { name: string; hash: string; full?: boolean; type?: string }[] = [
  { name: 'oggi', hash: '#/oggi' },
  { name: 'agenda', hash: '#/agenda', full: true },
  { name: 'agenda-settimana', hash: '#/agenda?vista=settimana', full: true },
  { name: 'briefing', hash: '#/briefing', full: true },
  { name: 'regole', hash: '#/regole', full: true },
  { name: 'statistiche', hash: '#/statistiche', full: true },
  { name: 'ripasso', hash: '#/ripasso?materia=sdm', type: 'Il raggio di Bohr è a_0 = 4 pi ezs' },
  { name: 'dattilografia', hash: '#/dattilografia', full: true },
  { name: 'dati', hash: '#/dati', full: true },
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
        await importDemo(page, testInfo, today)
        await page.goto(`/${screen.hash}`)
        await page.reload()
        await page.waitForLoadState('networkidle')
        if (screen.type) {
          const typer = page.locator('#typer')
          if (await typer.isVisible()) await typer.pressSequentially(screen.type)
        }
        await page.waitForTimeout(800)
        const dir = testInfo.project.name === 'chromium' ? `docs/screenshots/${vp.name}` : testInfo.outputPath(vp.name)
        mkdirSync(dir, { recursive: true })
        await page.screenshot({ path: `${dir}/${screen.name}.png`, fullPage: !!screen.full })
      })
    }
  })
}
