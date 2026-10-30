import { expect, test, type Page } from '@playwright/test'
import { importDemo, isoDate } from './helpers'
import { importIcs, openIcsPreview, readTable } from './ics-helpers'

// Importare l'orario da un file .ics (inventato): niente si scrive prima della conferma,
// una seconda importazione non cambia nulla, la modifica dell'utente resta, le lezioni di un
// corso si nascondono da Agenda e copertina. Orologio fissato; nessuna richiesta fuori dall'origine.

const now = new Date()
now.setHours(10, 20, 0, 0)
const today = isoDate(now)

interface Row {
  id: string
  title: string
  source?: string
  courseId?: string
  deletedAt?: number
  userEdited?: boolean
  date: string
}
const icsRows = async (page: Page) => (await readTable<Row>(page, 'events')).filter((e) => e.source === 'ics')

test.use({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' })

test('importazione, ripetizione, modifica e lezioni nascoste', async ({ page }, testInfo) => {
  const foreign: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!/^(data:|blob:)/.test(url) && new URL(url).origin !== 'http://localhost:4173') foreign.push(url)
  })

  await page.clock.setFixedTime(now)
  await importDemo(page, testInfo, today)

  // Anteprima: proposte già scelte, ma niente è scritto.
  await openIcsPreview(page, testInfo, today)
  expect(await icsRows(page)).toHaveLength(0)
  const fisica = page.getByRole('combobox', { name: 'Corso per «Fisica Moderna»' })
  await expect(fisica).toHaveValue('course:demo-c-1')
  await expect(page.getByRole('combobox', { name: /Calcolo Numerico \(Prof\. Inventato\)/ })).toHaveValue('course:demo-c-2')
  await expect(page.getByRole('combobox', { name: /ALC-301 Laboratorio/ })).toHaveValue('course:demo-c-5')
  await expect(page.locator('.ics-group__tag')).toContainText(['Proposto dal nome', 'Proposto dal nome', 'Proposto dal codice'])
  await expect(page.getByRole('combobox', { name: /Seminario Fittizio/ })).toHaveValue('none')
  await expect(page.locator('.ics__notes')).toContainText('ricorrenza non supportata')
  await expect(page.locator('.ics__notes')).toContainText('tutto il giorno')
  // Cambiando scelta, il cartellino della proposta sparisce.
  await page.getByRole('combobox', { name: /Seminario Fittizio/ }).selectOption({ label: 'Topologia Generale' })
  await page.getByRole('button', { name: 'Annulla' }).click()
  expect(await icsRows(page)).toHaveLength(0)

  // Conferma.
  await importIcs(page, testInfo, today, { 'Seminario Fittizio': 'Topologia Generale' })
  const first = await icsRows(page)
  expect(first.length).toBeGreaterThan(40)
  expect(first.every((r) => !r.deletedAt)).toBe(true)
  await page.goto('/#/agenda')
  await expect(page.locator('.block__title', { hasText: 'Seminario Fittizio' })).toBeVisible()

  // Seconda importazione: niente da cambiare, nessun doppione.
  await openIcsPreview(page, testInfo, today)
  await expect(page.getByRole('combobox', { name: /Seminario Fittizio/ })).toHaveValue('course:demo-c-3')
  await expect(page.locator('.ics__summary')).toHaveText('Niente da cambiare: l’agenda è già aggiornata.')
  await page.getByRole('button', { name: 'Annulla' }).click()
  expect(await icsRows(page)).toHaveLength(first.length)

  // Una modifica dell'utente resta anche dopo una nuova importazione.
  await page.locator('.block__button', { hasText: 'Seminario Fittizio' }).first().click()
  await expect(page.locator('.form-hint')).toContainText('Importata dall’orario')
  await page.getByLabel('Titolo').fill('Seminario mio')
  await page.getByRole('button', { name: 'Salva' }).click()
  await openIcsPreview(page, testInfo, today)
  await expect(page.locator('.ics__summary')).toContainText('modificata da te, lasciata com’è')
  await page.getByRole('button', { name: 'Annulla' }).click()
  const edited = (await icsRows(page)).filter((r) => r.title === 'Seminario mio')
  expect(edited).toHaveLength(1)
  expect(edited[0]!.userEdited).toBe(true)

  // Nascondere le lezioni di Topologia Generale: via da Agenda e copertina, restano nel database.
  await page.goto('/#/oggi')
  await expect(page.locator('.sr-only li', { hasText: 'Seminario' }).first()).toBeAttached()
  await page.goto('/#/dati')
  const hide = page.getByRole('switch', { name: 'Nascondi le lezioni di Topologia Generale' })
  await expect(hide).toHaveAttribute('aria-checked', 'false')
  await hide.click()
  await expect(hide).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Nascoste da agenda, copertina e pianificazione.')).toBeVisible()
  await page.goto('/#/agenda')
  await expect(page.locator('.block__title', { hasText: 'Seminario' })).toHaveCount(0)
  await expect(page.locator('.timeline__hidden')).toContainText('lezione nascosta')
  await page.goto('/#/oggi')
  await expect(page.locator('.sr-only li', { hasText: 'Seminario' })).toHaveCount(0)
  expect((await icsRows(page)).length).toBe(first.length)

  // Nessuna richiesta fuori dall'origine dell'app.
  expect(foreign).toEqual([])
})

// I blocchi brevi restano leggibili: nel giorno nessuna coppia di testi si sovrappone e il testo sta nel suo blocco.
for (const size of [
  { name: '1180x820', width: 1180, height: 820 },
  { name: '390x844', width: 390, height: 844 },
]) {
  test(`blocchi dell'Agenda senza testi sovrapposti, ${size.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.clock.setFixedTime(now)
    await importDemo(page, testInfo, today)
    await importIcs(page, testInfo, today, { 'Seminario Fittizio': 'Topologia Generale' })
    await page.goto('/#/agenda')
    await expect(page.locator('.timeline__items .block').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const problems = await page.evaluate(() => {
      const boxes: { block: number; name: string; r: DOMRect; b: DOMRect }[] = []
      document.querySelectorAll('.timeline__items .block').forEach((block, i) => {
        const b = block.getBoundingClientRect()
        block.querySelectorAll('.block__title, .block__meta').forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none') boxes.push({ block: i, name: el.textContent ?? '', r, b })
        })
      })
      const out: string[] = []
      const tol = 0.5
      for (const x of boxes) {
        if (x.r.bottom > x.b.bottom + tol || x.r.right > x.b.right + tol || x.r.top < x.b.top - tol) out.push(`fuori dal blocco: ${x.name}`)
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!.r
          const c = boxes[j]!.r
          if (boxes[i]!.block === boxes[j]!.block) continue
          if (a.left < c.right - tol && c.left < a.right - tol && a.top < c.bottom - tol && c.top < a.bottom - tol) out.push(`${boxes[i]!.name} / ${boxes[j]!.name} ${JSON.stringify(a)} ${JSON.stringify(c)}`)
        }
      }
      return out
    })
    expect(problems).toEqual([])
  })
}
