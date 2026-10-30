import { expect, test, type Page } from '@playwright/test'
import { importDemo, isoDate } from './helpers'

// Comete e lune sulla copertina, con i dati dimostrativi: gli elenchi per i
// lettori di schermo, la cattura che si anima una sola volta, il movimento
// ridotto, la voce scaduta e l'assenza di id duplicati.

const today = isoDate(new Date())
// La luna con lode dei dati dimostrativi: corso demo-c-8, voto demo-res-3.
const CAPTURE = { resultId: 'demo-res-3', courseId: 'demo-c-8' }

const pendingOf = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('orbita')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const req = open.result.transaction('settings').objectStore('settings').get('pendingCaptures')
          req.onsuccess = () => {
            open.result.close()
            resolve((req.result as { value: unknown } | undefined)?.value)
          }
        }
      }),
  )


/** Le caselle di testo della copertina contro quelle di teste di cometa e lune. */
function clashes(page: Page) {
  return page.evaluate(() => {
    type R = { x: number; y: number; w: number; h: number; what: string }
    const rect = (r: DOMRect, what: string): R => ({ x: r.left, y: r.top, w: r.width, h: r.height, what })
    const lines = (el: Element | null, what: string): R[] => {
      if (!el) return []
      const range = document.createRange()
      range.selectNodeContents(el)
      return [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2).map((r) => rect(r, what))
    }
    const text: R[] = [
      ...lines(document.querySelector('.cover__title-text'), 'titolo'),
      ...lines(document.querySelector('.cover__rule'), 'frase'),
      ...lines(document.querySelector('.cover__energy h2'), 'domanda'),
      ...[...document.querySelectorAll('.energy__option')].map((e) => rect(e.getBoundingClientRect(), 'pulsante')),
      ...[...document.querySelectorAll('.orbit--planets text')].map((e) => rect(e.getBoundingClientRect(), `etichetta ${e.textContent}`)),
      ...[...document.querySelectorAll('.topbar a, .topbar button, nav a, nav button')].map((e) => rect(e.getBoundingClientRect(), 'barra')),
    ]
    const bodies: R[] = [
      ...[...document.querySelectorAll('[data-comet] > circle:not(.cosmos__hit)')].map((e, i) => rect(e.getBoundingClientRect(), `cometa ${i}`)),
      // l'ultima circonferenza è l'anello della lode o il corpo; il bagliore trasparente non conta
      ...[...document.querySelectorAll('[data-moon]')].map((e) => rect([...e.querySelectorAll('circle')].at(-1)!.getBoundingClientRect(), `luna ${e.getAttribute('data-moon')}`)),
    ]
    const clash: string[] = []
    for (const b of bodies)
      for (const t of text) if (b.x < t.x + t.w && b.x + b.w > t.x && b.y < t.y + t.h && b.y + b.h > t.y) clash.push(`${b.what} su ${t.what}`)
    const outside = bodies.filter((b) => b.x < 0 || b.x + b.w > window.innerWidth || b.y < 0).map((b) => b.what)
    return { clash, outside, bodies: bodies.length, text: text.length }
  })
}

const withPending = (entries: { resultId: string; courseId: string }[]) => ({ settings: [{ id: 'pendingCaptures', value: entries, updatedAt: Date.now() }] })

test.use({ viewport: { width: 1180, height: 820 } })

test('gli elenchi per i lettori di schermo ci sono tutti', async ({ page }, testInfo) => {
  await importDemo(page, testInfo, today)
  await page.goto('/#/oggi')
  const section = page.locator('section[aria-labelledby="cosmos-h"]')
  await expect(section.getByRole('heading', { name: 'Comete e lune' })).toBeAttached()
  await expect(section.getByRole('heading', { name: 'Esami in arrivo' })).toBeAttached()
  await expect(section.getByRole('heading', { name: 'Esami superati' })).toBeAttached()
  await expect(section.locator('li', { hasText: 'Fisica Moderna, tra 9 giorni' })).toBeAttached()
  await expect(section.locator('li', { hasText: /Algebra Commutativa, rifiutato; prossimo appello/ })).toBeAttached()
  await expect(section.locator('li', { hasText: 'Algebra Lineare Fittizia, 30 e lode' })).toBeAttached()
  await expect(section.locator('li', { hasText: 'Analisi Fittizia, 27' })).toBeAttached()
  // le comete sono collegamenti, le lune no
  await expect(section.locator('a')).toHaveCount(5)
  // sul cielo: 4 comete, 1 periodica, 4 lune (l'idoneità non è una luna)
  await expect(page.locator('[data-comet]')).toHaveCount(5)
  await expect(page.locator('[data-comet][data-periodic="true"]')).toHaveCount(1)
  await expect(page.locator('[data-moon]')).toHaveCount(4)
  await expect(page.locator('[data-moon][data-lode="true"]')).toHaveCount(1)
})

test('toccare una cometa porta al libretto (per ora), con un\'area di almeno 44 px', async ({ page }, testInfo) => {
  await importDemo(page, testInfo, today)
  await page.goto('/#/oggi')
  const hit = page.locator('[data-comet] .cosmos__hit').first()
  await expect(hit).toBeAttached()
  // l'ingresso della copertina scala il buco nero: si misura a entrata finita
  await expect.poll(async () => (await hit.boundingBox())?.width ?? 0, { timeout: 5000 }).toBeGreaterThanOrEqual(43.5)
  await hit.dispatchEvent('click')
  await expect(page).toHaveURL(/#\/libretto/)
})

test('la cattura si anima una volta sola e poi la voce sparisce', async ({ page }, testInfo) => {
  await importDemo(page, testInfo, today, withPending([CAPTURE]))
  await page.goto('/#/oggi')
  await expect(page.locator(`[data-capture="${CAPTURE.resultId}"]`)).toBeAttached({ timeout: 5000 })
  await expect(page.locator(`[data-moon="${CAPTURE.courseId}"]`)).toHaveAttribute('data-pending', 'true')
  await expect(page.locator('.sr-only [role=status]')).toContainText('esame superato con 30 e lode')
  await expect(page.locator(`[data-capture="${CAPTURE.resultId}"]`)).toHaveCount(0, { timeout: 8000 })
  await expect(page.locator(`[data-moon="${CAPTURE.courseId}"]`)).not.toHaveAttribute('data-pending', 'true')
  await expect(page.locator(`[data-moon="${CAPTURE.courseId}"]`)).not.toHaveAttribute('opacity', '0')
  expect(await pendingOf(page)).toEqual([])
  await page.reload()
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-capture]')).toHaveCount(0)
})

test('con il movimento ridotto la luna compare con una dissolvenza, senza cattura', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await importDemo(page, testInfo, today, withPending([CAPTURE]))
  await page.goto('/#/oggi')
  await expect(page.locator('[data-capture]')).toHaveCount(0)
  await expect.poll(() => pendingOf(page), { timeout: 5000 }).toEqual([])
  const moon = page.locator(`[data-moon="${CAPTURE.courseId}"]`)
  await expect(moon).not.toHaveAttribute('data-pending', 'true')
  await expect(moon).toBeAttached()
  await expect(page.locator('[data-capture]')).toHaveCount(0)
})

test('una voce scaduta si toglie senza animare', async ({ page }, testInfo) => {
  await importDemo(page, testInfo, today, withPending([{ resultId: 'non-esiste', courseId: 'demo-c-1' }]))
  await page.goto('/#/oggi')
  await expect.poll(() => pendingOf(page), { timeout: 5000 }).toEqual([])
  await expect(page.locator('[data-capture]')).toHaveCount(0)
})

test('nessun id duplicato su Oggi e Statistiche', async ({ page }, testInfo) => {
  await importDemo(page, testInfo, today)
  for (const hash of ['#/oggi', '#/statistiche']) {
    await page.goto(`/${hash}`)
    await page.waitForTimeout(800)
    const dup = await page.evaluate(() => {
      const seen = new Map<string, number>()
      for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) ?? 0) + 1)
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id)
    })
    expect(dup, hash).toEqual([])
  }
})

// Nessuna testa di cometa e nessuna luna sopra il testo della copertina.
for (const vp of [
  { name: '1180x820', width: 1180, height: 820, mobile: false },
  { name: '390x844', width: 390, height: 844, mobile: true },
]) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.mobile, isMobile: vp.mobile, reducedMotion: 'reduce' })

    test('comete e lune non coprono titolo, frase, domanda, pulsanti ed etichette', async ({ page }, testInfo) => {
      await importDemo(page, testInfo, today)
      await page.goto('/#/oggi')
      await page.waitForTimeout(1500)
      const hits = await clashes(page)
      expect(hits.bodies).toBeGreaterThan(0)
      expect(hits.text).toBeGreaterThan(5)
      expect(hits.clash).toEqual([])
    })

    test('con 24 esami superati si vedono tutte le lune e nessuna sta su testo o fuori schermo', async ({ page }, testInfo) => {
      const courses = Array.from({ length: 20 }, (_, i) => ({ id: `many-c-${i}`, name: `Esame Fittizio ${i + 1}`, cfu: 6, difficulty: 2, semester: 1, sections: [], updatedAt: Date.now() }))
      const results = courses.map((c, i) => ({
        id: `many-r-${i}`,
        courseId: c.id,
        date: `2026-0${1 + (i % 9)}-${String(1 + i).padStart(2, '0')}`,
        outcome: 'superato',
        grade: 18 + ((i * 5) % 13),
        ...(i % 6 === 0 ? { grade: 30, lode: true } : {}),
        updatedAt: Date.now(),
      }))
      await importDemo(page, testInfo, today, { courses, results })
      await page.goto('/#/oggi')
      await page.waitForTimeout(1500)
      await expect(page.locator('[data-moon]')).toHaveCount(24)
      await page.screenshot({ path: testInfo.outputPath('many-moons.png') })
      const hits = await clashes(page)
      expect(hits.clash).toEqual([])
      expect(hits.outside).toEqual([])
    })

    test('le etichette dell’orbita non si sovrappongono', async ({ page }, testInfo) => {
      await importDemo(page, testInfo, today)
      await page.goto('/#/oggi')
      await page.waitForTimeout(1500)
      const overlaps = await page.evaluate(() => {
        const els = [...document.querySelectorAll('.orbit--planets text')].map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() }))
        const out: string[] = []
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++) {
            const a = els[i]!.r
            const b = els[j]!.r
            if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) out.push(`${els[i]!.t} / ${els[j]!.t}`)
          }
        return out
      })
      expect(overlaps).toEqual([])
    })
  })
}
