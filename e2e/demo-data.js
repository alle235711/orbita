// Dati dimostrativi per screenshot e prove a mano: un backup di Orbita
// (formato 2) costruito intorno a `today`, deterministico e interamente
// inventato. Si importa dal primo passo del percorso guidato ("Ripristina un
// backup"); non viene mai caricato dall'app da solo.

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const shift = (s, n) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
const weekday = (s) => {
  const w = parse(s).getDay()
  return w === 0 ? 7 : w
}

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COURSE_NAMES = ['Fisica Moderna', 'Calcolo Numerico', 'Topologia Generale', 'Cosmologia Osservativa', 'Algebra Commutativa']
const CARD_TEXTS = [
  'Il periodo di un pendolo semplice dipende dalla lunghezza e non dalla massa.',
  'Un integrale definito misura l’area con segno sotto una funzione.',
  'Uno spazio topologico è compatto se ogni ricoprimento aperto ha un sottoricoprimento finito.',
  'La luminosità di una stella cresce con il quadrato del suo raggio.',
  'Un anello è commutativo se il prodotto non dipende dall’ordine dei fattori.',
]

/**
 * `options.deckIds`: gli id dei mazzi d'esempio, per collegare i primi corsi
 * (si leggono dal file incluso, così qui non ne compare nessuno).
 */
export function demoBackup(today, { deckIds = [] } = {}) {
  const r = rng(27)
  let n = 0
  const id = (p) => `demo-${p}-${++n}`
  const stamp = Date.now() - 60_000
  const days = []
  const sessions = []
  const workouts = []
  const weights = []
  const events = []
  const tasks = []
  const cards = []
  const cardState = []
  const cardReviews = []
  const typingRuns = []

  const courses = COURSE_NAMES.map((name, i) => ({
    id: `demo-c-${i + 1}`,
    name,
    cfu: [9, 6, 12, 9, 6][i],
    examDate: [shift(today, 17), shift(today, 21), shift(today, 70).slice(0, 7), shift(today, 71).slice(0, 7), shift(today, 72).slice(0, 7)][i],
    difficulty: [2, 3, 2, 1, 2][i],
    semester: 1,
    sections: ['Parte A', 'Parte B'],
    ...(deckIds[i] ? { sampleDeck: deckIds[i] } : {}),
    updatedAt: stamp,
  }))

  // Esami già superati (nomi inventati) e i loro voti, con date nel passato: il Libretto ha di che mostrare.
  const passed = [
    ['Analisi Fittizia', 9, 70, { grade: 27 }],
    ['Chimica Fittizia', 6, 55, { grade: 24 }],
    ['Algebra Lineare Fittizia', 12, 40, { grade: 30, lode: true }],
    ['Laboratorio Fittizio', 3, 30, {}],
    ['Statistica Fittizia', 9, 20, { grade: 28 }],
  ]
  const passedCourses = passed.map(([name, cfu, ago], i) => ({
    id: `demo-c-${COURSE_NAMES.length + i + 1}`,
    name,
    cfu,
    examDate: shift(today, -ago),
    difficulty: 2,
    semester: 1,
    sections: [],
    updatedAt: stamp,
  }))
  const results = [
    ...passed.map(([, , ago, extra], i) => ({
      id: `demo-res-${i + 1}`,
      courseId: passedCourses[i].id,
      date: shift(today, -ago),
      outcome: 'superato',
      ...extra,
      updatedAt: 1000 + i,
    })),
    { id: 'demo-res-6', courseId: courses[4].id, date: shift(today, -40), outcome: 'non-superato', updatedAt: 1010 },
    { id: 'demo-res-7', courseId: courses[4].id, date: shift(today, -12), outcome: 'rifiutato', updatedAt: 1011 },
  ]

  // un piccolo mazzo proprio per ogni corso, con gli id che cominciano per "demo-"
  courses.forEach((c, ci) => {
    for (let k = 0; k < 8; k++) {
      cards.push({
        id: `demo-card-${ci + 1}-${k + 1}`,
        courseId: c.id,
        section: k < 4 ? 'Parte A' : 'Parte B',
        kind: 'definizione',
        title: `Definizione ${k + 1}`,
        text: `${CARD_TEXTS[ci]} (${k + 1})`,
        key: CARD_TEXTS[ci].split(' ').slice(2, 5).join(' '),
        needsFix: false,
        userEdited: false,
        updatedAt: stamp,
      })
    }
  })

  for (let i = 45; i >= 1; i--) {
    const date = shift(today, -i)
    const energy = 1 + Math.floor(r() * 5)
    days.push({ id: date, date, energy, updatedAt: stamp })
    const wd = weekday(date)
    const studyHours = wd === 7 ? 2 + r() * 2 : 3 + energy * 0.7 + r() * 1.5
    let left = Math.round(studyHours * 60)
    let start = 9 * 60
    while (left > 20) {
      const minutes = Math.min(left, 60 + Math.floor(r() * 4) * 15)
      const courseId = courses[Math.floor(r() * (i < 20 ? 2.4 : 5))].id
      sessions.push({ id: id('s'), date, start: `${Math.floor(start / 60)}:${pad(start % 60)}`, minutes, type: 'studio', courseId, planned: 50, updatedAt: stamp })
      start += minutes + 20
      left -= minutes
    }
    if (wd === 2 || wd === 4 || (wd === 6 && r() > 0.5)) {
      sessions.push({ id: id('s'), date, start: '14:30', minutes: 90, type: 'lavoro', notes: 'Lezioni private', updatedAt: stamp })
    }
    if (r() > 0.25) {
      sessions.push({ id: id('s'), date, start: '8:15', minutes: 15, type: 'lingua', score: Math.round(62 + (45 - i) * 0.4 + r() * 6), notes: 'AppLingua', updatedAt: stamp })
    }
    if (i > 3 && r() > 0.55) sessions.push({ id: id('s'), date, start: '21:00', minutes: 40, type: 'abilita', updatedAt: stamp })
    if (r() > 0.6) sessions.push({ id: id('s'), date, start: '22:30', minutes: 30, type: 'lettura', updatedAt: stamp })
    if (r() > 0.5) sessions.push({ id: id('s'), date, start: '18:00', minutes: 20, type: 'ripasso', courseId: courses[0].id, updatedAt: stamp })
    if ([1, 3, 5].includes(wd) && r() > 0.25) workouts.push({ id: id('w'), date, start: '18:30', type: 'arrampicata', minutes: 120, updatedAt: stamp })
    if ([2, 6].includes(wd) && r() > 0.35) workouts.push({ id: id('w'), date, start: '7:30', type: 'corsa', minutes: 40, updatedAt: stamp })
    if (wd === 4 && r() > 0.4) workouts.push({ id: id('w'), date, start: '17:00', type: 'palestra', minutes: 60, updatedAt: stamp })
    if (i % 3 === 0) weights.push({ id: id('kg'), date, kg: Math.round((73.4 - (45 - i) * 0.035 + (r() - 0.5) * 0.6) * 10) / 10, updatedAt: stamp })
    if (i % 4 === 0) {
      const wpm = Math.round(28 + (45 - i) * 0.25 + r() * 3)
      typingRuns.push({
        id: id('t'),
        date,
        at: parse(date).getTime() + 19 * 3600_000,
        lesson: ['base', 'superiore', 'inferiore', 'accenti'][Math.floor(r() * 4)],
        wpm,
        accuracy: Math.round((0.9 + r() * 0.08) * 1000) / 1000,
        chars: 400,
        keyErrors: { à: 3, è: 4, ò: 2, ',': 1, p: 1 },
        keyHits: { à: 18, è: 20, ò: 12, ',': 30, p: 25, a: 60, e: 70 },
        updatedAt: stamp,
      })
    }
  }

  // oggi: energia ancora da scegliere, qualche sessione del mattino
  sessions.push({ id: id('s'), date: today, start: '8:15', minutes: 15, type: 'lingua', score: 81, notes: 'AppLingua', updatedAt: stamp })

  // agenda della settimana
  const week = []
  for (let k = -3; k <= 6; k++) week.push(shift(today, k))
  for (const date of week) {
    const wd = weekday(date)
    if (wd === 7) continue
    if (wd !== 6) {
      events.push({ id: id('e'), date, start: '9:00', end: '11:00', title: COURSE_NAMES[3], type: 'lezione', suggested: false, confirmed: true, updatedAt: stamp })
      events.push({ id: id('e'), date, start: '11:00', end: '13:00', title: wd % 2 ? COURSE_NAMES[2] : COURSE_NAMES[0], type: 'lezione', suggested: false, confirmed: true, updatedAt: stamp })
    }
    if (wd === 2 || wd === 4) events.push({ id: id('e'), date, start: '14:30', end: '16:00', title: 'Lezioni private', type: 'lavoro', suggested: false, confirmed: true, updatedAt: stamp })
    if (wd === 3 || wd === 5 || date === today) events.push({ id: id('e'), date, start: '18:30', end: '20:30', title: 'Arrampicata', type: 'sport', suggested: false, confirmed: true, updatedAt: stamp })
  }

  tasks.push(
    { id: id('k'), title: 'Esercizio 3 del primo foglio', due: today, done: true, doneAt: stamp, updatedAt: stamp },
    { id: id('k'), title: 'Preparare il materiale per le lezioni private', due: today, done: false, updatedAt: stamp },
    { id: id('k'), title: 'Scrivere all’ufficio per il periodo fuori sede', due: shift(today, 1), done: false, updatedAt: stamp },
    { id: id('k'), title: 'Esercizi del capitolo 3', due: today, done: false, updatedAt: stamp },
    { id: id('k'), title: 'Scegliere l’argomento della tesi', done: false, updatedAt: stamp },
  )

  // schede: le prime già in giro per le scatole, alcune scadute oggi
  cards.slice(0, 30).forEach((c, i) => {
    const box = 1 + (i % 5)
    const first = shift(today, -20 + (i % 10))
    const due = i % 3 === 0 ? shift(today, -(i % 4)) : shift(today, 1 + (i % 6))
    cardState.push({ id: c.id, box, due, firstReviewed: first, lastReviewed: shift(today, -1 - (i % 5)), updatedAt: stamp })
    for (let k = 0; k < Math.min(box, 3); k++) {
      const date = shift(first, k * 2)
      cardReviews.push({
        id: id('r'),
        cardId: c.id,
        date,
        at: parse(date).getTime() + 17 * 3600_000,
        mode: ['copia', 'completa', 'nome', 'memoria'][Math.min(3, k)],
        wpm: Math.round(26 + r() * 14),
        score: Math.round((0.9 + r() * 0.1) * 1000) / 1000,
        wrongChars: Math.floor(r() * 6),
        ok: r() > 0.2,
        boxAfter: Math.min(5, k + 2),
        early: false,
        updatedAt: stamp,
      })
    }
  })

  // un periodo speciale inventato, tra una decina di giorni
  const deadlines = [
    {
      id: 'demo-periodo-1',
      title: 'Periodo fuori sede',
      kind: 'periodo',
      date: shift(today, 10),
      endDate: shift(today, 35),
      hoursPerDay: 8,
      sport: { arrampicata: 0, palestra: 3, corsa: 2 },
      deadlineDay: 4,
      updatedAt: stamp,
    },
  ]

  const modules = {
    sport: {
      enabled: true,
      types: {
        arrampicata: { enabled: true, target: 3, minutes: 120 },
        palestra: { enabled: true, target: 2, minutes: 60 },
        corsa: { enabled: true, target: 2, minutes: 40 },
        nuoto: { enabled: false, target: 2, minutes: 45 },
        altro: { enabled: false, target: 1, minutes: 45 },
      },
    },
    dattilografia: { enabled: true },
    abilita: { enabled: true, name: 'Chitarra' },
    lingua: { enabled: true, appName: 'AppLingua' },
    lavoro: { enabled: true },
    lettura: { enabled: true },
    peso: { enabled: true },
  }
  const settings = [
    { id: 'seedVersion', value: 2, updatedAt: 0 },
    { id: 'profile', value: { name: 'Ada Demo', university: 'Università di Prova', degree: 'Laurea in Fisica', totalCfu: 180, lodeValue: 30, yearStart: '09-01', graduationTarget: shift(today, 300).slice(0, 7), completedAt: stamp }, updatedAt: stamp },
    { id: 'modules', value: modules, updatedAt: stamp },
    { id: 'studyBlock', value: { preset: '50/10', hint: { enabled: true, lookbackDays: 14, minSessions: 6, minShare: 0.5, overrunPct: 10 } }, updatedAt: stamp },
  ]

  return {
    app: 'orbita',
    format: 2,
    exportedAt: new Date().toISOString(),
    tables: { days, sessions, workouts, weights, events, tasks, courses: [...courses, ...passedCourses], results, deadlines, cards, cardState, cardReviews, typingRuns, settings },
  }
}
