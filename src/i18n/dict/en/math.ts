import type { Format } from '../../format/types'

export const math = {
  reading: 'Formula read aloud',
  withFormulas: 'The card with its formulas',

  converter: {
    open: 'Convert to LaTeX',
    hint: 'Suggests LaTeX formulas for cards written in plain text. Nothing changes until you confirm.',
    title: 'Convert to LaTeX',
    lead: 'The suggestion comes from a fixed dictionary: Greek letters, h-bar, arrows, subscripts and superscripts. Check how it looks and confirm one card at a time or a whole section. Converted cards count as edited by you.',
    back: 'Back to Data',
    course: 'Course',
    section: 'Section',
    allSections: 'All sections',
    count: (p: { n: number; total: number }, f: Format) => `${f.count(p.n, 'suggestion', 'suggestions')} out of ${f.count(p.total, 'card', 'cards')}.`,
    none: 'Nothing to suggest here: the cards are already in LaTeX or have no recognisable formulas.',
    noCards: 'There are no cards to convert yet.',
    source: 'Current text',
    rendered: 'Suggestion, as it will look',
    proposalSource: 'LaTeX source of the suggestion',
    keyLost: (p: { key: string }) => `The key “${p.key}” is not in the suggestion any more: after converting, fix it from the card editor.`,
    keyChanged: (p: { key: string }) => `The key becomes “${p.key}”.`,
    apply: 'Convert this card',
    applyAll: (p: { n: number }, f: Format) => `Convert the whole section, ${f.count(p.n, 'card', 'cards')}`,
    applyAllConfirm: (p: { n: number }, f: Format) => `Tap again to convert ${f.count(p.n, 'card', 'cards')}`,
    pickSection: 'Pick a section to convert it all at once.',
    converted: 'Card converted.',
    convertedAll: (p: { n: number; skipped: number }, f: Format) =>
      `${f.count(p.n, 'card converted', 'cards converted')}${p.skipped ? `; ${p.skipped} left aside because the key needs fixing by hand` : ''}.`,
    more: 'Show more cards',
  },
}
