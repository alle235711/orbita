import type { Format } from '../../format/types'

// Formule (KaTeX) e convertitore assistito in LaTeX.
export const math = {
  reading: 'Lettura della formula',
  withFormulas: 'La scheda con le formule',

  converter: {
    open: 'Converti in LaTeX',
    hint: 'Propone le formule in LaTeX per le schede scritte in testo semplice. Nulla cambia finché non confermi.',
    title: 'Converti in LaTeX',
    lead: 'La proposta viene da un dizionario fisso: lettere greche, h tagliato, frecce, pedici e apici. Controlla la resa e conferma una scheda alla volta o una sezione intera. Le schede convertite contano come modificate da te.',
    back: 'Torna a Dati',
    course: 'Corso',
    section: 'Sezione',
    allSections: 'Tutte le sezioni',
    count: (p: { n: number; total: number }, f: Format) => `${f.count(p.n, 'proposta', 'proposte')} su ${f.count(p.total, 'scheda', 'schede')}.`,
    none: 'Niente da proporre qui: le schede sono già in LaTeX o non hanno formule riconoscibili.',
    noCards: 'Non ci sono ancora schede da convertire.',
    source: 'Testo attuale',
    rendered: 'Proposta, come si vedrà',
    proposalSource: 'Sorgente LaTeX della proposta',
    keyLost: (p: { key: string }) => `La chiave «${p.key}» non si ritrova nella proposta: dopo la conversione sistemala dall’editor della scheda.`,
    keyChanged: (p: { key: string }) => `La chiave diventa «${p.key}».`,
    apply: 'Converti questa scheda',
    applyAll: (p: { n: number }, f: Format) => `Converti tutta la sezione, ${f.count(p.n, 'scheda', 'schede')}`,
    applyAllConfirm: (p: { n: number }, f: Format) => `Tocca ancora per convertire ${f.count(p.n, 'scheda', 'schede')}`,
    pickSection: 'Per convertire in blocco scegli una sezione.',
    converted: 'Scheda convertita.',
    convertedAll: (p: { n: number; skipped: number }, f: Format) =>
      `${f.count(p.n, 'scheda convertita', 'schede convertite')}${p.skipped ? `; ${f.count(p.skipped, 'lasciata', 'lasciate')} da parte perché la chiave va sistemata a mano` : ''}.`,
    more: 'Mostra altre schede',
  },
}
