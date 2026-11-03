import type { Format } from '../../format/types'

// Importing cards from .tex files.
export const tex = {
  open: 'Import from .tex files',
  hint: 'Reads theorems, definitions, lemmas and the like from one or more .tex files and offers them as cards, for you to check before importing.',
  back: 'Back to Data',
  title: 'Import cards from .tex files',
  lead: 'Choose one or more .tex files: every theorem, definition, lemma and the like becomes a card. Files are read on this device and go nowhere.',

  limits: {
    title: 'What is not read',
    newcommand: 'Macros you defined with \\newcommand: they stay written as in the file.',
    input: 'Files pulled in with \\input or \\include: choose those too, one by one.',
    bibliography: 'The bibliography and citations.',
    key: 'The “key” field cannot be worked out from the file and stays empty. In Fill-in mode, with no key, the last display formula is hidden or, if there is none, the last sentence.',
  },

  step1: 'Files',
  choose: 'Choose .tex files',
  chooseOther: 'Choose other files',
  filesRead: (p: { n: number }, f: Format) => `${f.count(p.n, 'file read', 'files read')}.`,
  environments: 'Other environments to import',
  environmentsPlaceholder: 'for example exercise, notation',
  environmentsHint: (p: { list: string }) => `Already included: ${p.list}, and those declared with \\newtheorem. Separate the names with a comma.`,

  step2: 'Cards found',
  found: (p: { n: number; files: number }, f: Format) => `${f.count(p.n, 'card found', 'cards found')} in ${f.count(p.files, 'file', 'files')}.`,
  foundNone: 'No cards found in the files you chose.',
  problemsTitle: (p: { n: number }, f: Format) => `${f.count(p.n, 'problem', 'problems')} in the files`,
  problemsRest: 'Blocks with a problem are not imported; the rest is.',
  tableCaption: 'Cards found in the .tex files, with a checkbox to import them',
  colImport: 'Import',
  colCard: 'Card',
  colText: 'Text, as it will look',
  selectAll: 'Select all',
  selected: (p: { n: number; total: number }) => `${p.n} of ${p.total} selected`,
  rowImport: (p: { title: string }) => `Import “${p.title}”`,
  meta: (p: { kind: string; section: string; file: string; line: number }) => `${p.kind} · ${p.section} · ${p.file}, line ${p.line}`,

  step3: 'Course',
  course: 'Destination course',
  pickCourse: 'Choose the course',
  noCourses: 'There are no courses yet: add one in the Exams section of Data, then come back.',
  needCourse: 'Choose the course to be able to import.',
  needCards: 'Select at least one card.',
  action: (p: { n: number }, f: Format) => `Import ${f.count(p.n, 'card', 'cards')}`,
  review: 'Go to review',
}
