import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { importDemo, isoDate } from './helpers'
import { readTable } from './ics-helpers'
import {
  aliveCards,
  aWednesday,
  asOtherPerson,
  bigDeck,
  chooseDeck,
  downloadWith,
  importSection,
  MINI,
  openMazzi,
  openShare,
  readDeckJson,
  shareButton,
  writeDeckJson,
} from './mazzi-helpers'

// Mazzi da condividere: elenco, foglio di condivisione (file .json e .orbita, codice QR solo se ci sta),
// importazione con resoconto. Orologio fissato su un mercoledì; nessuna richiesta fuori dall'origine.

const wednesday = aWednesday()
const today = isoDate(wednesday)

test.use({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' })

interface DeckRow {
  id: string
  courseId: string
  name: string
  author: string
  origin?: { author: string; university: string }
}

test('elenco, file .json, importazione dello stesso file (nessun doppione) e di una copia di un’altra persona', async ({ page }, testInfo) => {
  const foreign: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!/^(data:|blob:)/.test(url) && new URL(url).origin !== 'http://localhost:4173') foreign.push(url)
  })
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today)

  // La voce «Mazzi» è nella barra, come le altre, e porta alla pagina.
  await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name: 'Mazzi' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mazzi' })).toBeVisible()
  await expect(page).toHaveURL(/#\/mazzi$/)

  // Ogni corso con schede è un mazzo: conteggi e origine.
  const demoCards = (await aliveCards(page, 'demo-c-1')).length
  const row = page.locator('.course', { hasText: 'Fisica Moderna' })
  await expect(row).toContainText(`${demoCards} schede`)
  await expect(row).toContainText('Creato qui')
  await expect(page.locator('.course')).toHaveCount(5)

  // Condividi: i metadati si scrivono nel foglio e viaggiano nel file.
  const sheet = await openShare(page, 'Fisica Moderna')
  await expect(sheet.getByLabel('Nome del mazzo')).toHaveValue('Fisica Moderna')
  await expect(sheet.getByLabel('Autore')).toHaveValue('')
  await sheet.getByLabel('Nome del mazzo').fill('Fisica Moderna, appunti')
  await sheet.getByLabel('Autore').fill('Ada Demo')
  await sheet.getByLabel('Ateneo').fill('Università di Prova')
  await sheet.getByLabel('Anno accademico').fill('2026/2027')
  await sheet.getByLabel('Licenza').fill('CC BY 4.0')
  await sheet.getByLabel('Note').fill('Fatto per prova.')
  await expect(sheet.getByText(/^\d+ schede: file \.json di/)).toBeVisible()
  const json = await downloadWith(page, testInfo, () => sheet.getByRole('button', { name: 'Scarica il file .json' }).click())
  expect(json.name).toBe('orbita-mazzo-fisica-moderna-appunti.json')
  await expect(sheet.locator('.mazzi-sheet__status')).toHaveText('Scaricato orbita-mazzo-fisica-moderna-appunti.json.')
  const deck = readDeckJson(json.path)
  expect(deck).toMatchObject({ app: 'orbita', tipo: 'mazzo', versione: 1 })
  expect(deck.mazzo).toMatchObject({ nome: 'Fisica Moderna, appunti', autore: 'Ada Demo', ateneo: 'Università di Prova', corso: 'Fisica Moderna', anno: '2026/2027', licenza: 'CC BY 4.0', note: 'Fatto per prova.' })
  expect(deck.schede).toHaveLength(demoCards)
  expect(JSON.stringify(deck)).not.toMatch(/userEdited|"box"|"due"/)
  // Il record dei metadati è stato salvato.
  const decks = await readTable<DeckRow>(page, 'decks')
  expect(decks).toHaveLength(1)
  expect(decks[0]).toMatchObject({ id: deck.mazzo.id, courseId: 'demo-c-1', name: 'Fisica Moderna, appunti' })
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(page.locator('.course', { hasText: 'Fisica Moderna, appunti' })).toBeVisible()

  // Importa lo stesso file: anteprima «tutte uguali», conferma, nessun doppione.
  const importing = importSection(page)
  await chooseDeck(page, json.path)
  const preview = importing.locator('.mazzi-preview')
  await expect(preview).toContainText('Anteprima: Fisica Moderna, appunti')
  await expect(preview).toContainText('Autore: Ada Demo')
  await expect(preview).toContainText('Licenza: CC BY 4.0')
  await expect(preview).toContainText('Il mazzo c’è già, con le stesse informazioni.')
  await expect(preview).toContainText('Le schede vanno nel corso Fisica Moderna.')
  await expect(preview.locator('.dati__status')).toHaveText(`Schede: 0 nuove, 0 aggiornate, ${demoCards} uguali, 0 saltate.`)
  const cardsBefore = (await readTable(page, 'cards')).length
  await importing.getByRole('button', { name: 'Importa il mazzo' }).click()
  await expect(importing.locator('.mazzi-import__status')).toHaveText(`Mazzo importato. Schede: 0 nuove, 0 aggiornate, ${demoCards} uguali, 0 saltate.`)
  expect((await readTable(page, 'cards')).length).toBe(cardsBefore)
  expect(await readTable(page, 'decks')).toHaveLength(1)
  await expect(importing.getByRole('link', { name: 'Vai al ripasso' })).toHaveAttribute('href', '#/ripasso?materia=demo-c-1')

  // Una copia di un'altra persona (id diversi): corso nuovo, origine, e di nuovo nessun doppione.
  const copy = asOtherPerson(deck, 'altra')
  const copyPath = writeDeckJson(testInfo, 'copia.json', copy)
  await chooseDeck(page, copyPath)
  await expect(preview).toContainText('Mazzo nuovo.')
  await expect(preview).toContainText('Verrà creato il corso Fisica Moderna.')
  await expect(preview.locator('.dati__status')).toHaveText(`Schede: ${demoCards} nuove, 0 aggiornate, 0 uguali, 0 saltate.`)
  await importing.getByRole('button', { name: 'Importa il mazzo' }).click()
  await expect(importing.locator('.mazzi-import__status')).toContainText(`${demoCards} nuove`)
  expect(await aliveCards(page, `deck:${copy.mazzo.id}`)).toHaveLength(demoCards)
  expect(await aliveCards(page, 'demo-c-1')).toHaveLength(demoCards)
  const after = await readTable<DeckRow>(page, 'decks')
  expect(after).toHaveLength(2)
  expect(after.find((d) => d.id === copy.mazzo.id)).toMatchObject({ courseId: `deck:${copy.mazzo.id}`, origin: { author: 'Ada Demo', university: 'Università di Prova' } })
  const imported = page.locator('.course', { hasText: 'Importato da Ada Demo, Università di Prova' })
  await expect(imported).toContainText(`${demoCards} schede`)

  await chooseDeck(page, copyPath)
  await expect(preview.locator('.dati__status')).toHaveText(`Schede: 0 nuove, 0 aggiornate, ${demoCards} uguali, 0 saltate.`)
  await importing.getByRole('button', { name: 'Importa il mazzo' }).click()
  await expect(importing.locator('.mazzi-import__status')).toContainText(`0 nuove, 0 aggiornate, ${demoCards} uguali`)
  expect((await aliveCards(page)).length).toBe(cardsBefore + demoCards)

  // La copia ha una scheda corretta più di recente e una nuova: «1 aggiornata», «1 nuova».
  const first = copy.schede[0]!
  const updated = {
    ...copy,
    mazzo: { ...copy.mazzo, note: 'Rivisto.', aggiornato: copy.mazzo.aggiornato + 1000 },
    schede: [
      { ...first, testo: 'Testo corretto dall’autore.', aggiornata: first.aggiornata + 1000 },
      ...copy.schede.slice(1),
      { id: 'altra-nuova', sezione: first.sezione, tipo: 'teorema', titolo: 'Aggiunta', testo: 'Una scheda in più.', chiave: '', aggiornata: 5 },
    ],
  }
  await chooseDeck(page, writeDeckJson(testInfo, 'copia-2.json', updated))
  await expect(preview).toContainText('Il mazzo c’è già: le sue informazioni vengono aggiornate.')
  await expect(preview.locator('.dati__status')).toHaveText(`Schede: 1 nuova, 1 aggiornata, ${demoCards - 1} uguali, 0 saltate.`)
  await importing.getByRole('button', { name: 'Importa il mazzo' }).click()
  await expect(importing.locator('.mazzi-import__status')).toContainText('1 nuova, 1 aggiornata')
  const cards = await readTable<{ id: string; text: string }>(page, 'cards')
  expect(cards.find((c) => c.id === first.id)!.text).toBe('Testo corretto dall’autore.')
  expect(cards.find((c) => c.id === 'altra-nuova')!.text).toBe('Una scheda in più.')

  expect(foreign).toEqual([])
})

test('le schede modificate da te non si sovrascrivono e restano nel resoconto come saltate', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today)
  await openMazzi(page)
  const sheet = await openShare(page, 'Fisica Moderna')
  const json = await downloadWith(page, testInfo, () => sheet.getByRole('button', { name: 'Scarica il file .json' }).click())
  const deck = readDeckJson(json.path)
  await page.keyboard.press('Escape')

  // Una copia in cui la prima scheda è cambiata e più recente; qui l'utente l'aveva modificata a mano.
  const target = deck.schede[0]!
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('orbita')
        open.onsuccess = () => {
          const tx = open.result.transaction('cards', 'readwrite')
          const store = tx.objectStore('cards')
          const get = store.get(id)
          get.onsuccess = () => store.put({ ...get.result, userEdited: true, text: 'Il mio testo.' })
          tx.oncomplete = () => {
            open.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    target.id,
  )
  const changed = { ...deck, schede: deck.schede.map((s) => (s.id === target.id ? { ...s, testo: 'Testo dell’autore.', aggiornata: Date.now() + 100_000 } : s)) }
  await page.reload()
  await chooseDeck(page, writeDeckJson(testInfo, 'cambiato.json', changed))
  const preview = importSection(page).locator('.mazzi-preview')
  await expect(preview.locator('.dati__status')).toHaveText(`Schede: 0 nuove, 0 aggiornate, ${deck.schede.length - 1} uguali, 1 saltata.`)
  await expect(preview).toContainText('Tra le saltate: 1 modificata da te.')
  await importSection(page).getByRole('button', { name: 'Importa il mazzo' }).click()
  await expect(importSection(page).locator('.mazzi-import__status')).toContainText('1 saltata')
  const cards = await readTable<{ id: string; text: string }>(page, 'cards')
  expect(cards.find((c) => c.id === target.id)!.text).toBe('Il mio testo.')
})

test('file .orbita compresso: stesso mazzo, più piccolo del JSON, si importa come il JSON', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today, bigDeckExtra())
  await openMazzi(page)
  const sheet = await openShare(page, 'Corso Grande')
  const json = await downloadWith(page, testInfo, () => sheet.getByRole('button', { name: 'Scarica il file .json' }).click())
  const orbita = await downloadWith(page, testInfo, () => sheet.getByRole('button', { name: 'Scarica il file .orbita' }).click())
  expect(orbita.name).toBe('orbita-mazzo-corso-grande.orbita')
  const bytes = readFileSync(orbita.path)
  expect([...bytes.subarray(0, 4)]).toEqual([0x4f, 0x52, 0x42, 1])
  expect(bytes.length).toBeLessThan(readFileSync(json.path).length)
  await page.keyboard.press('Escape')

  await chooseDeck(page, orbita.path)
  const preview = importSection(page).locator('.mazzi-preview')
  await expect(preview).toContainText('Anteprima: Corso Grande')
  await expect(preview.locator('.dati__status')).toHaveText('Schede: 0 nuove, 0 aggiornate, 30 uguali, 0 saltate.')
  // e in un'altra copia (id diversi) arriva intero, uguale al JSON
  const copy = asOtherPerson(readDeckJson(json.path), 'altra')
  await chooseDeck(page, writeDeckJson(testInfo, 'altra.json', copy))
  await expect(preview.locator('.dati__status')).toHaveText('Schede: 30 nuove, 0 aggiornate, 0 uguali, 0 saltate.')
})

test('file sbagliati: messaggio chiaro e nessun dato toccato', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today)
  await openMazzi(page)
  const importing = importSection(page)
  const status = importing.locator('.mazzi-import__status')
  const before = JSON.stringify(await readTable(page, 'cards'))

  const rotto = testInfo.outputPath('rotto.json')
  writeFileSync(rotto, '{non è json')
  await chooseDeck(page, rotto)
  await expect(status).toHaveText('rotto.json non è un file JSON valido.')

  await chooseDeck(page, writeDeckJson(testInfo, 'backup.json', { app: 'orbita', format: 2, tables: {} }))
  await expect(status).toHaveText('Il file non è un mazzo di Orbita.')

  await chooseDeck(page, writeDeckJson(testInfo, 'nuovo.json', { app: 'orbita', tipo: 'mazzo', versione: 99, mazzo: {}, schede: [] }))
  await expect(status).toHaveText('Questo mazzo viene da una versione più nuova di Orbita: aggiorna l’app e riprova.')

  await chooseDeck(page, writeDeckJson(testInfo, 'scheda.json', { app: 'orbita', tipo: 'mazzo', versione: 1, mazzo: { id: 'x', nome: 'X' }, schede: [{ id: 's1', sezione: 'a', tipo: 'b', titolo: 'c', chiave: '', aggiornata: 1 }] }))
  await expect(status).toHaveText('La scheda s1 del mazzo non ha il campo «testo» o non è valido.')

  const orbita = testInfo.outputPath('rovinato.orbita')
  writeFileSync(orbita, Buffer.from([0x4f, 0x52, 0x42, 1, 9, 9, 9, 9]))
  await chooseDeck(page, orbita)
  await expect(status).toHaveText('Il file del mazzo è danneggiato o incompleto: non si riesce a leggere.')

  await expect(importing.locator('.mazzi-preview')).toHaveCount(0)
  expect(JSON.stringify(await readTable(page, 'cards'))).toBe(before)
  expect(await readTable(page, 'decks')).toHaveLength(0)
})

function bigDeckExtra() {
  const big = bigDeck()
  return { courses: big.courses, cards: big.cards }
}

test('un mazzo piccolo ha il codice QR, con alternativa testuale', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today, MINI)
  await openMazzi(page)
  const sheet = await openShare(page, 'Mini Corso')
  const qrButton = sheet.getByRole('button', { name: 'Mostra il codice QR' })
  await expect(qrButton).toHaveAttribute('aria-expanded', 'false')
  await qrButton.click()
  const qr = sheet.getByRole('img', { name: /^Codice QR del mazzo Mini Corso: 2 schede, \d+ byte\. Se non riesci a leggerlo, scarica il file\.$/ })
  await expect(qr).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Nascondi il codice QR' })).toHaveAttribute('aria-expanded', 'true')
  await expect(sheet.locator('.mazzi-sheet__status')).toHaveText(/^Il mazzo ci sta nel codice QR: \d+ byte su 666 byte\.$/)
  await expect(sheet.locator('figcaption')).toContainText('non c’è ancora')
  // Un quadrato nero su bianco, con il bordo di silenzio; sta nel foglio.
  const viewBox = (await qr.getAttribute('viewBox'))!.split(' ').map(Number)
  expect(viewBox[2]).toBe(viewBox[3])
  expect((viewBox[2]! - 8 - 17) % 4).toBe(0)
  expect(viewBox[2]! - 8).toBeLessThanOrEqual(97)
  await expect(qr.locator('rect')).toHaveAttribute('fill', '#fff')
  expect(((await qr.locator('path').getAttribute('d')) ?? '').length).toBeGreaterThan(100)
  const box = (await qr.boundingBox())!
  const sheetBox = (await sheet.boundingBox())!
  expect(box.width).toBeGreaterThan(150)
  expect(box.x).toBeGreaterThanOrEqual(sheetBox.x)
  expect(box.x + box.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width)
  // Cambiare un campo spegne il codice (non corrisponde più); si richiede quando serve.
  await sheet.getByLabel('Note').fill('Una nota nuova.')
  await expect(qr).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Mostra il codice QR' }).click()
  await expect(qr).toBeVisible()
  await sheet.getByRole('button', { name: 'Nascondi il codice QR' }).click()
  await expect(qr).toHaveCount(0)
})

test('un mazzo grande non ha il QR: dice quanti KB sono, quanti ne regge il codice e propone il file', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today, bigDeckExtra())
  await openMazzi(page)
  const sheet = await openShare(page, 'Corso Grande')
  // Lo si sa già prima di provare: il peso del file e il limite del codice sono scritti nel foglio.
  await expect(sheet.getByText(/^30 schede: file \.json di [\d,]+ KB, compresso [\d,]+ KB\. Il codice QR regge al massimo 666 byte\.$/)).toBeVisible()
  await sheet.getByRole('button', { name: 'Mostra il codice QR' }).click()
  const status = sheet.locator('.mazzi-sheet__status')
  await expect(status).toHaveText(/^Il mazzo pesa [\d,]+ KB compresso, il codice QR ne regge al massimo 666 byte: scarica il file\.$/)
  await expect(sheet.getByRole('img')).toHaveCount(0)
  await expect(sheet.locator('svg.qr')).toHaveCount(0)
  // Il file è sempre l'alternativa, e funziona.
  const json = await downloadWith(page, testInfo, () => sheet.getByRole('button', { name: 'Scarica il file .json' }).click())
  expect(readDeckJson(json.path).schede).toHaveLength(30)
})

test('da tastiera: il pulsante Condividi apre il foglio, si compila, Esc lo chiude e il focus torna al pulsante', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today, MINI)
  await openMazzi(page)
  let button = shareButton(page, 'Mini Corso')
  await button.focus()
  await page.keyboard.press('Enter')
  const sheet = page.getByRole('dialog', { name: 'Condividi il mazzo' })
  await expect(sheet).toBeVisible()
  // Senza nome non si condivide, e il motivo è scritto.
  await sheet.getByLabel('Nome del mazzo').fill('')
  await expect(sheet.getByRole('button', { name: 'Scarica il file .json' })).toBeDisabled()
  await expect(sheet.getByText('Scrivi il nome del mazzo per condividerlo.')).toBeVisible()
  await sheet.getByLabel('Nome del mazzo').fill('Mini')
  await expect(sheet.getByRole('button', { name: 'Scarica il file .json' })).toBeEnabled()
  // Tab raggiunge pulsanti e campi dentro il foglio, e non esce.
  await sheet.getByLabel('Note').focus()
  await page.keyboard.press('Tab')
  await expect(sheet.getByRole('button', { name: 'Scarica il file .json' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(sheet.getByRole('button', { name: 'Scarica il file .orbita' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(sheet.getByRole('button', { name: 'Mostra il codice QR' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(sheet.getByRole('img', { name: /Codice QR/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  // Condividere ha salvato il nuovo nome: il pulsante ora si chiama così, e ha il focus.
  button = shareButton(page, 'Mini')
  await expect(button).toBeFocused()
})

test('senza schede la pagina spiega come avere un mazzo', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('orbita')
        open.onsuccess = () => {
          const tx = open.result.transaction('cards', 'readwrite')
          tx.objectStore('cards').clear()
          tx.oncomplete = () => {
            open.result.close()
            resolve()
          }
        }
      }),
  )
  await openMazzi(page)
  await page.reload()
  await expect(page.getByText('Non hai ancora mazzi')).toBeVisible()
  await expect(page.locator('.course')).toHaveCount(0)
  await expect(importSection(page).getByRole('button', { name: 'Scegli il file' })).toBeVisible()
})
