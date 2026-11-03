import { expect, test } from '@playwright/test'
import { importDemo, isoDate } from './helpers'
import { readTable } from './ics-helpers'
import { aWednesday, chooseTexFiles, openTexImport, writeTex } from './tex-helpers'

// Importare schede da file .tex (inventati nel test): anteprima a tabella con resa KaTeX e errori per
// blocco, caselle di spunta, scelta del corso, importazione, ripetizione senza doppioni, ripasso.
// Orologio fissato su un mercoledì; nessuna richiesta fuori dall'origine.

const wednesday = aWednesday()
const today = isoDate(wednesday)

const APPUNTI = String.raw`\newtheorem{thm}{Teorema}
\section{Sezione TeX}
\begin{definizione}[Funzione continua]\label{d:c}
Una funzione $f$ è continua in $a$ se $\lim_{x\to a} f(x) = f(a)$. % commento
\end{definizione}
\begin{thm}[Weierstrass]
Una funzione continua su un compatto ha massimo e minimo:
\[ \max_K f \ge f(x). \]
\end{thm}
\begin{lemma} Un lemma di prova. \end{lemma}
\begin{lemma}[Rotto]
Questo blocco non ha la fine.
`
const CAPITOLO = String.raw`\begin{teorema}[Secondo file] Il teorema del secondo file. \end{teorema}
`

interface Card {
  id: string
  courseId: string
  section: string
  kind: string
  title: string
  text: string
  key: string
  userEdited: boolean
  deletedAt?: number
}
const texCards = async (page: import('@playwright/test').Page) => (await readTable<Card>(page, 'cards')).filter((c) => c.id.startsWith('tex:'))

test.use({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' })

test('scegliere i file, controllare l’anteprima, importare, ripetere e ripassare', async ({ page }, testInfo) => {
  const foreign: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!/^(data:|blob:)/.test(url) && new URL(url).origin !== 'http://localhost:4173') foreign.push(url)
  })

  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today)
  const files = [writeTex(testInfo, 'appunti.tex', APPUNTI), writeTex(testInfo, 'cap2.tex', CAPITOLO)]

  await openTexImport(page)
  // Quello che non viene letto è dichiarato in pagina.
  const limits = page.locator('.tex__limits')
  await expect(limits).toContainText('\\newcommand')
  await expect(limits).toContainText('\\input')
  await expect(limits).toContainText('bibliografia')
  await expect(limits).toContainText('«chiave»')

  await chooseTexFiles(page, files)
  await expect(page.getByText('2 file letti.')).toBeVisible()
  await expect(page.getByText('4 schede trovate in 2 file.')).toBeVisible()

  // Tabella con intestazioni e una casella con etichetta per scheda; resa KaTeX con MathML leggibile.
  const table = page.getByRole('table', { name: /Schede trovate nei file .tex/ })
  await expect(table.getByRole('columnheader')).toHaveCount(3)
  await expect(table.getByRole('row')).toHaveCount(5)
  await expect(table.getByRole('rowheader', { name: /Funzione continua/ })).toContainText('definizione · Sezione TeX · appunti.tex, riga 3')
  await expect(table.getByRole('checkbox')).toHaveCount(4)
  await expect(table.getByRole('checkbox', { name: 'Importa «Weierstrass»' })).toBeChecked()
  const weierstrass = table.getByRole('row', { name: /Weierstrass/ })
  await expect(weierstrass.locator('.katex').first()).toBeVisible()
  await expect(weierstrass.locator('.katex-html').first()).toHaveAttribute('aria-hidden', 'true')
  await expect(weierstrass.locator('.katex-mathml math').first()).toBeAttached()
  await expect(table.getByRole('row', { name: /Funzione continua/ })).not.toContainText('commento')

  // L'errore del blocco rotto è ben visibile, e il resto c'è.
  const problems = page.locator('.tex__problems')
  await expect(problems).toBeVisible()
  await expect(problems).toContainText('1 problema nei file')
  await expect(problems).toContainText('appunti.tex Riga 11: l’ambiente «lemma» non è chiuso')

  // Selezione: tutte, nessuna, una tolta. Senza corso e senza schede non si importa.
  const importButton = page.getByRole('button', { name: /^Importa \d+ sched/ })
  await expect(page.getByText('4 di 4 selezionate')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Seleziona tutte' }).uncheck()
  await expect(page.getByText('0 di 4 selezionate')).toBeVisible()
  await expect(importButton).toBeDisabled()
  await expect(page.locator('#tex-why')).toHaveText('Seleziona almeno una scheda.')
  await page.getByRole('checkbox', { name: 'Seleziona tutte' }).check()
  await expect(page.getByText('4 di 4 selezionate')).toBeVisible()
  await table.getByRole('checkbox', { name: 'Importa «Lemma 1»' }).uncheck()
  await expect(page.getByText('3 di 4 selezionate')).toBeVisible()
  await expect(importButton).toHaveText('Importa 3 schede')
  await expect(importButton).toBeDisabled()
  await expect(page.locator('#tex-why')).toHaveText('Scegli il corso per poter importare.')
  expect(await texCards(page)).toHaveLength(0)

  // Corso, poi importa.
  await page.getByLabel('Corso di destinazione').selectOption('demo-c-1')
  await expect(importButton).toBeEnabled()
  await importButton.click()
  await expect(page.locator('.tex__status')).toHaveText('Schede importate: 3 nuove, 0 aggiornate, 0 uguali.')
  const first = await texCards(page)
  expect(first.map((c) => c.title).sort()).toEqual(['Funzione continua', 'Secondo file', 'Weierstrass'])
  expect(first.every((c) => c.courseId === 'demo-c-1' && c.key === '' && !c.userEdited && !c.deletedAt)).toBe(true)
  expect(first.find((c) => c.title === 'Weierstrass')).toMatchObject({ kind: 'teorema', section: 'Sezione TeX', text: 'Una funzione continua su un compatto ha massimo e minimo: $$\\max_K f \\ge f(x).$$' })
  expect(first.find((c) => c.title === 'Funzione continua')!.text).toBe('Una funzione $f$ è continua in $a$ se $\\lim_{x\\to a} f(x) = f(a)$.')

  // Ripetere: stessi file, stessa scelta, nessun doppione.
  await page.reload()
  await chooseTexFiles(page, files)
  await table.getByRole('checkbox', { name: 'Importa «Lemma 1»' }).uncheck()
  await page.getByLabel('Corso di destinazione').selectOption('demo-c-1')
  await importButton.click()
  await expect(page.locator('.tex__status')).toHaveText('Schede importate: 0 nuove, 0 aggiornate, 3 uguali.')
  expect((await texCards(page)).map((c) => c.id).sort()).toEqual(first.map((c) => c.id).sort())

  // Nel ripasso: le sezioni sono nell'elenco del corso (senza \section sopra, vale il nome del file) e le schede sono da ripassare.
  await page.getByRole('link', { name: 'Vai al ripasso' }).click()
  await page.getByLabel('Sezione').selectOption('Sezione TeX')
  await expect(page.locator('.ripasso__lead')).toContainText('scheda 1 di 2')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Funzione continua|Weierstrass/)
  await page.getByLabel('Sezione').selectOption('cap2')
  await expect(page.locator('.ripasso__lead')).toContainText('scheda 1 di 1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Secondo file')

  expect(foreign).toEqual([])
})

test('un elenco di ambienti scritto a mano e un file senza schede', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(wednesday)
  await importDemo(page, testInfo, today)
  const file = writeTex(testInfo, 'esercizi.tex', String.raw`\section{Serie}
\begin{esercizio}[Somma] Calcola $\sum_{n=1}^{\infty} 2^{-n}$. \end{esercizio}
`)
  await openTexImport(page)
  await page.locator('input[type=file]').setInputFiles(file)
  // l'ambiente non è nell'elenco di serie: nessuna scheda, ma un messaggio che spiega cosa fare
  await expect(page.getByText('Nessuna scheda trovata nei file scelti.')).toBeVisible()
  await expect(page.locator('.tex__problems')).toContainText('«esercizio» non è tra quelli da importare')
  await page.getByLabel('Altri ambienti da importare').fill('esercizio, notazione')
  await expect(page.getByText('1 scheda trovata in 1 file.')).toBeVisible()
  await expect(page.locator('.tex__problems')).toHaveCount(0)
  await expect(page.getByRole('rowheader', { name: /Somma/ })).toContainText('esercizio · Serie · esercizi.tex, riga 2')
})
