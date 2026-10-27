// Dati dimostrativi per screenshot e prove a mano: un backup di Orbita
// costruito intorno a `today`, deterministico. Si importa dalla pagina Dati;
// non viene mai caricato dall'app da solo.

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

export function demoBackup(today, { cards = [] } = {}) {
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
  const cardState = []
  const cardReviews = []
  const typingRuns = []

  const courses = ['sdm', 'calcolo', 'topalg', 'astrost', 'anelli']
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
      const courseId = courses[Math.floor(r() * (i < 20 ? 2.4 : 5))]
      sessions.push({ id: id('s'), date, start: `${Math.floor(start / 60)}:${pad(start % 60)}`, minutes, type: 'studio', courseId, updatedAt: stamp })
      start += minutes + 20
      left -= minutes
    }
    if (wd === 2 || wd === 4 || (wd === 6 && r() > 0.5)) {
      sessions.push({ id: id('s'), date, start: '14:30', minutes: 90, type: 'lavoro', notes: 'Ripetizioni', updatedAt: stamp })
    }
    if (r() > 0.25) {
      sessions.push({ id: id('s'), date, start: '8:15', minutes: 15, type: 'inglese', score: Math.round(62 + (45 - i) * 0.4 + r() * 6), notes: 'ELSA', updatedAt: stamp })
    }
    if (i > 3 && r() > 0.55) sessions.push({ id: id('s'), date, start: '21:00', minutes: 40, type: 'lean', updatedAt: stamp })
    if (r() > 0.6) sessions.push({ id: id('s'), date, start: '22:30', minutes: 30, type: 'lettura', updatedAt: stamp })
    if (r() > 0.5) sessions.push({ id: id('s'), date, start: '18:00', minutes: 20, type: 'ripasso', courseId: 'sdm', updatedAt: stamp })
    if ([1, 3, 5].includes(wd) && r() > 0.25) workouts.push({ id: id('w'), date, start: '18:30', type: 'arrampicata', minutes: 120, updatedAt: stamp })
    if ([2, 6].includes(wd) && r() > 0.35) workouts.push({ id: id('w'), date, start: '7:30', type: 'corsa', minutes: 40, updatedAt: stamp })
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
  sessions.push({ id: id('s'), date: today, start: '8:15', minutes: 15, type: 'inglese', score: 81, notes: 'ELSA', updatedAt: stamp })

  // agenda della settimana
  const week = []
  for (let k = -3; k <= 6; k++) week.push(shift(today, k))
  for (const date of week) {
    const wd = weekday(date)
    if (wd === 7) continue
    if (wd !== 6) {
      events.push({ id: id('e'), date, start: '9:00', end: '11:00', title: 'Astrofisica Stellare', type: 'lezione', suggested: false, confirmed: true, updatedAt: stamp })
      events.push({ id: id('e'), date, start: '11:00', end: '13:00', title: wd % 2 ? 'Topologia Algebrica' : 'Struttura della Materia', type: 'lezione', suggested: false, confirmed: true, updatedAt: stamp })
    }
    if (wd === 2 || wd === 4) events.push({ id: id('e'), date, start: '14:30', end: '16:00', title: 'Ripetizioni', type: 'lavoro', suggested: false, confirmed: true, updatedAt: stamp })
    if (wd === 3 || wd === 5 || date === today) events.push({ id: id('e'), date, start: '18:30', end: '20:30', title: 'Arrampicata', type: 'sport', suggested: false, confirmed: true, updatedAt: stamp })
  }

  tasks.push(
    { id: id('k'), title: 'Esercizio 3 del foglio di Struttura', due: today, done: true, doneAt: stamp, updatedAt: stamp },
    { id: id('k'), title: 'Preparare il materiale per le ripetizioni', due: today, done: false, updatedAt: stamp },
    { id: id('k'), title: 'Mail all’ufficio tirocini per le Maldive', due: shift(today, 1), done: false, updatedAt: stamp },
    { id: id('k'), title: 'Lean 4: esercizi del capitolo 3', due: today, done: false, updatedAt: stamp },
    { id: id('k'), title: 'Scegliere l’argomento della tesi', done: false, updatedAt: stamp },
  )

  // schede: le prime già in giro per le scatole, alcune scadute oggi
  cards.slice(0, 60).forEach((c, i) => {
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

  return {
    app: 'orbita',
    format: 1,
    exportedAt: new Date().toISOString(),
    tables: { days, sessions, workouts, weights, events, tasks, cardState, cardReviews, typingRuns },
  }
}
