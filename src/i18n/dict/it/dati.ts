import type { Format } from '../../format/types'
import type { Lang } from '../../lang'

export const dati = {
  title: 'Dati',
  lead: 'Tutto resta su questo dispositivo e funziona senza rete. Esporta un backup ogni tanto.',

  courses: 'Esami',
  coursesHint:
    'Se conosci solo il mese, l’esame resta in arrivo fino a fine mese. La difficoltà della teoria decide cosa va nelle prime ore quando l’energia è alta.',
  secondSemester: 'Secondo semestre',
  cardsMeta: (p: { n: number }, f: Format) => f.count(p.n, 'scheda', 'schede'),
  exam: (p: { date: string }, f: Format) => `Esame, ${f.date(p.date, { year: true })}`,
  examTbd: 'Esame, data da fissare',
  difficultyGroup: (p: { name: string }) => `Difficoltà della teoria di ${p.name}`,
  difficulty: 'Difficoltà',
  levels: { 1: 'bassa', 2: 'media', 3: 'alta' } as Record<1 | 2 | 3, string>,

  backup: 'Backup',
  backupNone: 'Nessun backup finora.',
  lastBackup: (p: { days: number }, f: Format) => `Ultimo backup ${p.days === 0 ? 'oggi' : f.relativeDays(-p.days)}.`,
  persistedYes: 'Il browser non cancellerà questi dati.',
  persistedNo: 'Il browser potrebbe cancellare i dati se manca spazio: installa Orbita sulla schermata Home.',
  exportAll: 'Esporta tutti i dati',
  importBackup: 'Importa un backup',
  askPersist: 'Chiedi di conservarli',
  mergeHint: 'L’importazione fonde i dati: per ogni record resta la versione modificata più di recente.',
  backupSaved: 'Backup salvato. Tienilo anche fuori da questo dispositivo.',
  backupImported: (p: { added: number; updated: number; skipped: number }, f: Format) =>
    `Backup importato: ${f.count(p.added, 'record nuovo', 'record nuovi')}, ${f.count(p.updated, 'aggiornato', 'aggiornati')}, ${p.skipped} già al passo.`,

  cards: 'Schede di ripasso',
  cardsCount: (p: { total: number }, f: Format) => f.count(p.total, 'scheda', 'schede'),
  cardsLoading: 'Schede in caricamento',
  cardsNeedFix: (p: { n: number }) => `, ${p.n} da correggere`,
  newPerDay: 'Nuove schede al giorno per la materia più urgente',
  exportCards: 'Esporta le schede',
  importCards: 'Importa schede',
  overwrite: 'Sovrascrivi anche le schede che ho modificato',
  cardsExported: (p: { n: number }, f: Format) => `${f.plural(p.n, 'Esportata', 'Esportate')} ${f.count(p.n, 'scheda', 'schede')}.`,
  cardsImported: (p: { added: number; updated: number; unchanged: number; keptEdited: number }, f: Format) =>
    `Schede importate: ${f.count(p.added, 'nuova', 'nuove')}, ${f.count(p.updated, 'aggiornata', 'aggiornate')}, ${f.count(p.unchanged, 'uguale', 'uguali')}${p.keptEdited ? `, ${f.count(p.keptEdited, 'modificata da te lasciata com’è', 'modificate da te lasciate come sono')}` : ''}.`,
  language: {
    title: 'Lingua',
    base: 'Lingua di base',
    baseGroup: 'Lingua di base dell’interfaccia',
    otherDays: 'Giorni nell’altra lingua',
    otherDaysGroup: 'Giorni della settimana nell’altra lingua',
    otherDaysNone: 'Nessun giorno scelto: l’interfaccia resta sempre nella lingua di base.',
    otherDaysUsage: (p: { other: Lang }) => `In questi giorni l’interfaccia è in ${p.other === 'en' ? 'inglese' : 'italiano'}.`,
    otherDaysMax: 'Al massimo tre giorni: toglierne uno per sceglierne un altro.',
  },
}
