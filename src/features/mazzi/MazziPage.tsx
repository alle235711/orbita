import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Page } from '../../app/Page'
import { db } from '../../db/db'
import { entryName, listDeckEntries, type DeckEntry } from '../../db/decks'
import { useI18n } from '../../i18n/store'
import '../dati/DatiPage.css'
import { ImportDeck } from './ImportDeck'
import { ShareSheet } from './ShareSheet'
import './MazziPage.css'

export default function MazziPage() {
  const { t, f } = useI18n()
  const tm = t.mazzi
  // Si rilegge quando cambiano corsi, mazzi o schede.
  const entries = useLiveQuery(() => listDeckEntries(db), [])
  const [sharing, setSharing] = useState<DeckEntry | null>(null)

  return (
    <Page className="dati" labelledBy="titolo-mazzi">
      <header className="dati__head">
        <h1 id="titolo-mazzi" className="page__title">
          {tm.title}
        </h1>
        <p className="page__lead">{tm.lead}</p>
      </header>

      <div className="dati__grid">
        <section className="dati__section" aria-labelledby="h-mazzi-elenco">
          <h2 id="h-mazzi-elenco">{tm.list.title}</h2>
          {entries && !entries.length ? <p className="dati__hint">{tm.list.empty}</p> : null}
          <ul className="courses" role="list">
            {(entries ?? []).map((entry) => {
              const name = entryName(entry)
              const origin = entry.deck?.origin
              return (
                <li key={entry.course.id} className="course">
                  <div className="course__name">
                    <span className="course__title">{name}</span>
                    <span className="course__meta">{tm.list.counts({ cards: entry.cards, sections: entry.sections }, f)}</span>
                    <span className="course__meta">{origin ? tm.list.originFrom(origin) : tm.list.originHere}</span>
                  </div>
                  <div className="dati__actions">
                    <button type="button" className="btn" aria-label={tm.list.shareAria({ name })} onClick={() => setSharing(entry)}>
                      {tm.list.share}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <ImportDeck />
      </div>

      <ShareSheet entry={sharing} onClose={() => setSharing(null)} />
    </Page>
  )
}
