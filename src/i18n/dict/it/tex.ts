import type { Format } from '../../format/types'

// Importazione delle schede da file .tex.
export const tex = {
  open: 'Importa da file .tex',
  hint: 'Legge teoremi, definizioni, lemmi e simili da uno o più file .tex e li propone come schede, da controllare prima di importare.',
  back: 'Torna a Dati',
  title: 'Importa schede da file .tex',
  lead: 'Scegli uno o più file .tex: ogni teorema, definizione, lemma e simili diventa una scheda. I file si leggono sul dispositivo e non vanno da nessuna parte.',

  limits: {
    title: 'Cosa non viene letto',
    newcommand: 'Le macro definite da te con \\newcommand: restano scritte come nel file.',
    input: 'I file richiamati con \\input o \\include: scegli anche quelli, uno per uno.',
    bibliography: 'La bibliografia e le citazioni.',
    key: 'Il campo «chiave» non si ricava dal file e resta vuoto. In Completa, senza chiave, si nasconde l’ultima formula in display o, se non c’è, l’ultima frase.',
  },

  step1: 'File',
  choose: 'Scegli i file .tex',
  chooseOther: 'Scegli altri file',
  filesRead: (p: { n: number }, f: Format) => `${f.count(p.n, 'file letto', 'file letti')}.`,
  environments: 'Altri ambienti da importare',
  environmentsPlaceholder: 'per esempio esercizio, notazione',
  environmentsHint: (p: { list: string }) => `Sono già inclusi ${p.list} e quelli dichiarati con \\newtheorem. Separa i nomi con una virgola.`,

  step2: 'Schede trovate',
  found: (p: { n: number; files: number }, f: Format) => `${f.count(p.n, 'scheda trovata', 'schede trovate')} in ${f.count(p.files, 'file', 'file')}.`,
  foundNone: 'Nessuna scheda trovata nei file scelti.',
  problemsTitle: (p: { n: number }, f: Format) => `${f.count(p.n, 'problema', 'problemi')} nei file`,
  problemsRest: 'I blocchi con un problema non vengono importati; il resto sì.',
  tableCaption: 'Schede trovate nei file .tex, con la casella per importarle',
  colImport: 'Importa',
  colCard: 'Scheda',
  colText: 'Testo, come si vedrà',
  selectAll: 'Seleziona tutte',
  selected: (p: { n: number; total: number }) => `${p.n} di ${p.total} selezionate`,
  rowImport: (p: { title: string }) => `Importa «${p.title}»`,
  meta: (p: { kind: string; section: string; file: string; line: number }) => `${p.kind} · ${p.section} · ${p.file}, riga ${p.line}`,

  step3: 'Corso',
  course: 'Corso di destinazione',
  pickCourse: 'Scegli il corso',
  noCourses: 'Non ci sono ancora corsi: aggiungine uno nella sezione Esami di Dati, poi torna qui.',
  needCourse: 'Scegli il corso per poter importare.',
  needCards: 'Seleziona almeno una scheda.',
  action: (p: { n: number }, f: Format) => `Importa ${f.count(p.n, 'scheda', 'schede')}`,
  review: 'Vai al ripasso',
}
