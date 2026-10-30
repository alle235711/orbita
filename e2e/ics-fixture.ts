// Orario inventato per le prove: corsi, ateneo e docente non esistono.
// È generato rispetto a `today` (non un file fisso) perché gli screenshot girano sulla data vera.

const pad = (n: number) => String(n).padStart(2, '0')
const day = (iso: string, plus: number): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + plus))
}
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
const at = (d: Date, hhmm: string) => `${ymd(d)}T${hhmm}00`
/** Lunedì della settimana che contiene `iso`. */
const monday = (iso: string): string => {
  const d = day(iso, 0)
  const shift = (d.getUTCDay() + 6) % 7
  const m = day(iso, -shift)
  return `${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}-${pad(m.getUTCDate())}`
}

export interface FixtureCourses {
  /** Nome di un corso demo: il titolo coincide. */
  fisica: string
  /** Nome di un corso demo: il titolo ha il nome più una nota tra parentesi. */
  calcolo: string
  /** Codice di un corso demo: compare nel titolo di un terzo evento. */
  codeCourse: string
}

const Z = 'TZID=Europe/Rome'

function vevent(lines: string[]): string[] {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT']
}

export function orarioIcs(today: string, courses: FixtureCourses): string {
  const base = monday(today)
  const M = (n: number) => day(base, n)
  const until = `${ymd(M(8 * 7))}T210000Z`
  const stamp = '20260901T000000Z'
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ateneo di Prova//Orario//IT',
    'CALSCALE:GREGORIAN',
    // Definizione di fuso inclusa come fanno gli esportatori veri: l'importazione la ignora.
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Rome',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...vevent([
      'UID:fisica-moderna@ateneo.fake.test',
      `DTSTAMP:${stamp}`,
      `SUMMARY:${courses.fisica}`,
      `DTSTART;${Z}:${at(M(0), '0900')}`,
      `DTEND;${Z}:${at(M(0), '1100')}`,
      `RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=${until}`,
      `EXDATE;${Z}:${at(M(9), '0900')}`,
      'LOCATION:Aula 1\\, Edificio Fittizio',
    ]),
    // Una lezione spostata (martedì della settimana dopo, altra aula).
    ...vevent([
      'UID:fisica-moderna@ateneo.fake.test',
      `DTSTAMP:${stamp}`,
      `RECURRENCE-ID;${Z}:${at(M(7), '0900')}`,
      `SUMMARY:${courses.fisica}`,
      `DTSTART;${Z}:${at(M(8), '1500')}`,
      `DTEND;${Z}:${at(M(8), '1700')}`,
      'LOCATION:Aula 7',
    ]),
    ...vevent([
      'UID:calcolo-numerico@ateneo.fake.test',
      `DTSTAMP:${stamp}`,
      `SUMMARY:${courses.calcolo} (Prof. Inventato)`,
      `DTSTART;${Z}:${at(M(1), '1400')}`,
      `DTEND;${Z}:${at(M(1), '1600')}`,
      `RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=${until}`,
    ]),
    ...vevent([
      'UID:laboratorio@ateneo.fake.test',
      `DTSTAMP:${stamp}`,
      `SUMMARY:${courses.codeCourse} Laboratorio`,
      `DTSTART;${Z}:${at(M(4), '1100')}`,
      `DTEND;${Z}:${at(M(4), '1300')}`,
      'RRULE:FREQ=WEEKLY;COUNT=8',
    ]),
    // Un seminario ogni giorno a partire da ieri: c'è sempre una lezione "oggi".
    ...vevent([
      'UID:seminario@ateneo.fake.test',
      `DTSTAMP:${stamp}`,
      'SUMMARY:Seminario Fittizio',
      `DTSTART;${Z}:${at(day(today, -1), '1600')}`,
      `DTEND;${Z}:${at(day(today, -1), '1700')}`,
      'RRULE:FREQ=DAILY;COUNT=60',
    ]),
    // Ricorrenza non supportata: finisce nel resoconto degli eventi ignorati.
    ...vevent([
      'UID:colloquio@ateneo.fake.test',
      `DTSTAMP:${stamp}`,
      'SUMMARY:Colloquio mensile',
      `DTSTART;${Z}:${at(M(0), '1700')}`,
      `DTEND;${Z}:${at(M(0), '1800')}`,
      'RRULE:FREQ=MONTHLY;BYDAY=1MO',
    ]),
    ...vevent([
      'UID:giornata@ateneo.fake.test',
      `DTSTAMP:${stamp}`,
      'SUMMARY:Giornata di Ateneo',
      `DTSTART;VALUE=DATE:${ymd(M(10))}`,
      `DTEND;VALUE=DATE:${ymd(M(11))}`,
    ]),
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}
