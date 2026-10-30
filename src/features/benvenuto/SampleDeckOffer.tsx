import { useEffect, useMemo, useState } from 'react'
import type { ContentFile } from '../../db/cards-io'
import { listSampleDecks, loadSampleFile, matchSampleDecks } from '../../db/sample-decks'
import { useI18n } from '../../i18n/store'
import type { WizardDraft } from './wizard'

interface SampleDeckOfferProps {
  draft: WizardDraft
  change: (patch: Partial<WizardDraft>) => void
}

/**
 * Propone un mazzo d'esempio per gli esami che gli somigliano. Nulla è
 * scelto di partenza: l'utente conferma ogni mazzo con la sua casella.
 */
export function SampleDeckOffer({ draft, change }: SampleDeckOfferProps) {
  const { t, f } = useI18n()
  const to = t.benvenuto.offer
  const [file, setFile] = useState<ContentFile | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSampleFile().then(
      (loaded) => !cancelled && setFile(loaded),
      () => undefined, // senza il file non c'è nulla da proporre
    )
    return () => {
      cancelled = true
    }
  }, [])

  const named = useMemo(() => draft.exams.filter((e) => e.name.trim()).map((e) => ({ key: e.key, name: e.name.trim() })), [draft.exams])
  const proposals = useMemo(() => (file ? matchSampleDecks(file, named) : []), [file, named])
  const decks = useMemo(() => new Map((file ? listSampleDecks(file) : []).map((d) => [d.id, d])), [file])
  if (!proposals.length) return null

  const chosen = (p: { deckId: string; examKey: string }) => draft.sampleDecks.some((d) => d.deckId === p.deckId && d.examKey === p.examKey)
  const toggle = (p: { deckId: string; examKey: string }) =>
    change({
      sampleDecks: chosen(p)
        ? draft.sampleDecks.filter((d) => !(d.deckId === p.deckId && d.examKey === p.examKey))
        : [...draft.sampleDecks.filter((d) => d.deckId !== p.deckId && d.examKey !== p.examKey), { deckId: p.deckId, examKey: p.examKey }],
    })

  return (
    <section className="welcome__offer" aria-labelledby="w-offer">
      <h2 id="w-offer">{to.title}</h2>
      <p className="welcome__hint">{to.lead}</p>
      <ul role="list">
        {proposals.map((p) => {
          const deck = decks.get(p.deckId)!
          const exam = named.find((e) => e.key === p.examKey)!
          return (
            <li key={`${p.deckId}:${p.examKey}`}>
              <label className="welcome__check">
                <input type="checkbox" checked={chosen(p)} onChange={() => toggle(p)} />
                <span>
                  {to.item({ deck: deck.name, exam: exam.name })}
                  <small>{to.cards({ n: deck.cards }, f)}</small>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
