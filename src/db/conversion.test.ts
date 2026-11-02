import 'fake-indexeddb/auto'
import { afterAll, describe, expect, it } from 'vitest'
import { convertCard } from '../math/convert'
import { importCards, parseContentFile } from './cards-io'
import { db } from './db'
import { applyConversions } from './review-actions'

const file = () =>
  parseContentFile({
    versione: 2,
    aggiornato: '2026-11-02',
    corsi: [{ id: 'k', nome: 'Corso', sezioni: ['S'] }],
    schede: [{ id: 'k-1', corso: 'k', sezione: 'S', tipo: 'risultato', titolo: 'Lunghezza minima', testo: 'Vale lambda_min = hc / eV qui.', chiave: 'lambda_min' }],
  })

afterAll(async () => {
  await db.delete()
})

describe('conversione in LaTeX confermata', () => {
  it('scrive testo e chiave proposti, marca la scheda come modificata e le importazioni la lasciano stare', async () => {
    await importCards(db, file())
    const before = (await db.cards.get('k-1'))!
    expect(before).toMatchObject({ userEdited: false, updatedAt: 0 })

    const proposal = convertCard(before)
    // la proposta da sola non cambia nulla
    expect(await db.cards.get('k-1')).toEqual(before)

    await applyConversions([{ id: before.id, text: proposal.text, key: proposal.key }])
    const after = (await db.cards.get('k-1'))!
    expect(after).toMatchObject({ text: 'Vale $\\lambda_{min}$ = hc / eV qui.', key: '\\lambda_{min}', userEdited: true })
    expect(after.updatedAt).toBeGreaterThan(0)
    expect(after.text.includes(after.key)).toBe(true)

    const again = await importCards(db, file())
    expect(again.keptEdited).toBe(1)
    expect((await db.cards.get('k-1'))!.text).toBe(after.text)
  })
})
