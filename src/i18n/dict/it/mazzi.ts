import type { CardMergeSummary, DeckMergeStatus } from '../../../decks/merge'
import type { Format } from '../../format/types'

// Mazzi da condividere: elenco, foglio di condivisione (file o codice QR) e importazione.
export const mazzi = {
  title: 'Mazzi',
  lead: 'Un mazzo è un corso con le sue schede. Lo condividi come un solo file, oppure come codice QR se è abbastanza piccolo. Tutto resta su questo dispositivo.',

  list: {
    title: 'I tuoi mazzi',
    empty: 'Non hai ancora mazzi: un mazzo nasce da un corso che ha delle schede. Aggiungile da Dati, oppure importa un mazzo qui accanto.',
    counts: (p: { cards: number; sections: number }, f: Format) => `${f.count(p.cards, 'scheda', 'schede')}, ${f.count(p.sections, 'sezione', 'sezioni')}`,
    originHere: 'Creato qui',
    originFrom: (p: { author: string; university: string }) => `Importato da ${[p.author, p.university].filter(Boolean).join(', ') || 'un autore sconosciuto'}`,
    share: 'Condividi',
    shareAria: (p: { name: string }) => `Condividi il mazzo ${p.name}`,
  },

  sheet: {
    title: 'Condividi il mazzo',
    lead: 'Queste informazioni viaggiano nel file insieme alle schede. Il tuo stato di ripasso non viene condiviso.',
    name: 'Nome del mazzo',
    author: 'Autore',
    university: 'Ateneo',
    course: 'Corso',
    year: 'Anno accademico',
    yearPlaceholder: 'per esempio 2026/2027',
    license: 'Licenza',
    licensePlaceholder: 'per esempio CC BY 4.0',
    notes: 'Note',
    needName: 'Scrivi il nome del mazzo per condividerlo.',
    json: 'Scarica il file .json',
    orbita: 'Scarica il file .orbita',
    showQr: 'Mostra il codice QR',
    hideQr: 'Nascondi il codice QR',
    sizes: (p: { cards: number; json: string; packed: string | null; max: string }, f: Format) =>
      `${f.count(p.cards, 'scheda', 'schede')}: file .json di ${p.json}${p.packed ? `, compresso ${p.packed}` : ''}. Il codice QR regge al massimo ${p.max}.`,
    noCompression: 'Questo browser non sa comprimere i file: sono disponibili solo il file .json e, quindi, nessun codice QR.',
    saved: (p: { file: string }) => `Scaricato ${p.file}.`,
    qrLabel: (p: { name: string; cards: number; size: string }, f: Format) =>
      `Codice QR del mazzo ${p.name}: ${f.count(p.cards, 'scheda', 'schede')}, ${p.size}. Se non riesci a leggerlo, scarica il file.`,
    qrCaption: 'Il codice contiene il mazzo intero, compresso. La lettura con la fotocamera dentro Orbita non c’è ancora: per ora l’altra persona ha bisogno del file.',
    qrFits: (p: { size: string; max: string }) => `Il mazzo ci sta nel codice QR: ${p.size} su ${p.max}.`,
  },

  import: {
    title: 'Importa un mazzo',
    lead: 'Scegli un file .json o .orbita. Prima di importare vedi cosa cambierebbe; le schede che hai modificato tu non si toccano.',
    choose: 'Scegli il file',
    chooseOther: 'Scegli un altro file',
    previewTitle: 'Anteprima',
    cardsInDeck: (p: { n: number }, f: Format) => `${f.count(p.n, 'scheda nel mazzo', 'schede nel mazzo')}.`,
    summary: (p: CardMergeSummary, f: Format) =>
      `Schede: ${f.count(p.added, 'nuova', 'nuove')}, ${f.count(p.updated, 'aggiornata', 'aggiornate')}, ${f.count(p.unchanged, 'uguale', 'uguali')}, ${f.count(p.skipped, 'saltata', 'saltate')}.`,
    skippedWhy: (p: { keptEdited: number; elsewhere: number }, f: Format) =>
      `Tra le saltate: ${[
        p.keptEdited ? `${f.count(p.keptEdited, 'modificata da te', 'modificate da te')}` : '',
        p.elsewhere ? `${f.count(p.elsewhere, 'già in un altro corso', 'già in un altro corso')}` : '',
      ]
        .filter(Boolean)
        .join(', ')}.`,
    deckState: { new: 'Mazzo nuovo.', updated: 'Il mazzo c’è già: le sue informazioni vengono aggiornate.', unchanged: 'Il mazzo c’è già, con le stesse informazioni.', skipped: 'Il mazzo c’è già con informazioni più recenti: restano le tue.' } as Record<DeckMergeStatus, string>,
    intoNew: (p: { name: string }) => `Verrà creato il corso ${p.name}.`,
    intoExisting: (p: { name: string }) => `Le schede vanno nel corso ${p.name}.`,
    action: 'Importa il mazzo',
    cancel: 'Annulla',
    done: (p: CardMergeSummary, f: Format) =>
      `Mazzo importato. Schede: ${f.count(p.added, 'nuova', 'nuove')}, ${f.count(p.updated, 'aggiornata', 'aggiornate')}, ${f.count(p.unchanged, 'uguale', 'uguali')}, ${f.count(p.skipped, 'saltata', 'saltate')}.`,
    review: 'Vai al ripasso',
  },
}
