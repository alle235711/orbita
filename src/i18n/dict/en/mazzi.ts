import type { CardMergeSummary, DeckMergeStatus } from '../../../decks/merge'
import type { Format } from '../../format/types'

export const mazzi = {
  title: 'Decks',
  lead: 'A deck is a course with its cards. Share it as a single file, or as a QR code if it’s small enough. Everything stays on this device.',

  list: {
    title: 'Your decks',
    empty: 'You have no decks yet: a deck comes from a course that has cards. Add them in Data, or import a deck next to this list.',
    counts: (p: { cards: number; sections: number }, f: Format) => `${f.count(p.cards, 'card', 'cards')}, ${f.count(p.sections, 'section', 'sections')}`,
    originHere: 'Made here',
    originFrom: (p: { author: string; university: string }) => `Imported from ${[p.author, p.university].filter(Boolean).join(', ') || 'an unknown author'}`,
    share: 'Share',
    shareAria: (p: { name: string }) => `Share the deck ${p.name}`,
  },

  sheet: {
    title: 'Share the deck',
    lead: 'This information travels in the file along with the cards. Your review progress is not shared.',
    name: 'Deck name',
    author: 'Author',
    university: 'University',
    course: 'Course',
    year: 'Academic year',
    yearPlaceholder: 'for example 2026/2027',
    license: 'License',
    licensePlaceholder: 'for example CC BY 4.0',
    notes: 'Notes',
    needName: 'Enter the deck name to share it.',
    json: 'Download the .json file',
    orbita: 'Download the .orbita file',
    showQr: 'Show the QR code',
    hideQr: 'Hide the QR code',
    sizes: (p: { cards: number; json: string; packed: string | null; max: string }, f: Format) =>
      `${f.count(p.cards, 'card', 'cards')}: .json file of ${p.json}${p.packed ? `, compressed ${p.packed}` : ''}. The QR code holds at most ${p.max}.`,
    noCompression: 'This browser can’t compress files: only the .json file is available, so there is no QR code.',
    saved: (p: { file: string }) => `Downloaded ${p.file}.`,
    qrLabel: (p: { name: string; cards: number; size: string }, f: Format) =>
      `QR code of the deck ${p.name}: ${f.count(p.cards, 'card', 'cards')}, ${p.size}. If you can’t scan it, download the file.`,
    qrCaption: 'The code holds the whole deck, compressed. Scanning with the camera inside Orbita isn’t there yet: for now the other person needs the file.',
    qrFits: (p: { size: string; max: string }) => `The deck fits in the QR code: ${p.size} of ${p.max}.`,
  },

  import: {
    title: 'Import a deck',
    lead: 'Choose a .json or .orbita file. Before importing you see what would change; cards you edited yourself are left alone.',
    choose: 'Choose the file',
    chooseOther: 'Choose another file',
    previewTitle: 'Preview',
    cardsInDeck: (p: { n: number }, f: Format) => `${f.count(p.n, 'card in the deck', 'cards in the deck')}.`,
    summary: (p: CardMergeSummary) => `Cards: ${p.added} new, ${p.updated} updated, ${p.unchanged} unchanged, ${p.skipped} skipped.`,
    skippedWhy: (p: { keptEdited: number; elsewhere: number }) =>
      `Among the skipped: ${[p.keptEdited ? `${p.keptEdited} edited by you` : '', p.elsewhere ? `${p.elsewhere} already in another course` : ''].filter(Boolean).join(', ')}.`,
    deckState: { new: 'New deck.', updated: 'The deck is already here: its details are updated.', unchanged: 'The deck is already here, with the same details.', skipped: 'The deck is already here with more recent details: yours stay.' } as Record<DeckMergeStatus, string>,
    intoNew: (p: { name: string }) => `The course ${p.name} will be created.`,
    intoExisting: (p: { name: string }) => `The cards go into the course ${p.name}.`,
    action: 'Import the deck',
    cancel: 'Cancel',
    done: (p: CardMergeSummary) => `Deck imported. Cards: ${p.added} new, ${p.updated} updated, ${p.unchanged} unchanged, ${p.skipped} skipped.`,
    review: 'Go to review',
  },
}
