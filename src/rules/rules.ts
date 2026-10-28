// Le nove regole della SPEC §4, ciascuna una funzione pura che legge il
// contesto e le proprie soglie e dice se scatta, con il perché.

import type { Course, RuleConfig, Session, Workout, WorkoutType } from '../db/schema'
import { addDays, diffDays, formatDate, isBetween, withDate, resolveDate, weekday, weekStart, type ISODate } from '../lib/dates'
import { ENERGY, type Energy } from '../lib/energy'
import { RULES, defaultThresholds } from './defaults'
import type { BriefingNote, HoursStatus, PlanItem, Priority, ResolvedRule, RuleContext, Rules, SportStatus, Tier } from './types'

// ——— configurazione ———

export function resolveRules(saved: RuleConfig[]): Rules {
  const byId = new Map(saved.filter((r) => !r.deletedAt).map((r) => [r.id, r]))
  return Object.fromEntries(
    RULES.map((def) => {
      const s = byId.get(def.id)
      return [def.id, { enabled: s?.enabled ?? true, t: { ...defaultThresholds(def.id), ...s?.thresholds } }]
    }),
  ) as Rules
}

// ——— aiuti ———

/** Ore che contano come "studio e lavoro" (regola 7 e statistiche). */
export const WORK_TYPES: Session['type'][] = ['studio', 'ripasso', 'lavoro']

export interface Exam {
  course: Course
  date: ISODate
  days: number
}

/** Esami da oggi in poi, dal più vicino. Le date con solo il mese valgono dal 1°. */
export function examsAhead(courses: Course[], today: ISODate): Exam[] {
  return courses
    .filter((c) => !c.deletedAt && c.examDate)
    .map((c) => ({ course: c, date: resolveDate(c.examDate!), days: diffDays(today, c.examDate!) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days || a.course.name.localeCompare(b.course.name, 'it'))
}

export function hoursInWindow(sessions: Session[], from: ISODate, to: ISODate): number {
  const minutes = sessions
    .filter((s) => !s.deletedAt && WORK_TYPES.includes(s.type) && isBetween(s.date, from, to))
    .reduce((sum, s) => sum + s.minutes, 0)
  return minutes / 60
}

function countThisWeek(workouts: Workout[], type: WorkoutType, today: ISODate): number {
  const start = weekStart(today)
  return workouts.filter((w) => !w.deletedAt && w.type === type && isBetween(w.date, start, today)).length
}

const didToday = (workouts: Workout[], type: WorkoutType, today: ISODate) =>
  workouts.some((w) => !w.deletedAt && w.type === type && w.date === today)

const NUMBERS = ['zero', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette']
const ORDINALS = ['', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima']
const num = (n: number) => NUMBERS[n] ?? String(n)
const ordinal = (n: number) => ORDINALS[n] ?? `${n}ª`
const WEEKDAY_NAMES = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

export const roundHalf = (h: number) => Math.round(h * 2) / 2

export function formatHours(h: number): string {
  return `${roundHalf(h).toLocaleString('it-IT')} h`
}

// ——— regola 9: tirocinio ———

export interface Profile {
  tirocinio: boolean
  hoursPerDay: number
  main: WorkoutType
  mainTarget: number
  deadline: number
  runsTarget: number
  note?: BriefingNote
}

export function ruleTirocinio(ctx: RuleContext, rules: Rules): Profile {
  const sport = rules.sport.t
  const base: Profile = {
    tirocinio: false,
    hoursPerDay: rules['ore-settimana'].t.hoursPerDay!,
    main: 'arrampicata',
    mainTarget: sport.climbs!,
    deadline: sport.deadline!,
    runsTarget: sport.runs!,
  }
  const r = rules.tirocinio
  const period = ctx.deadlines.find((d) => d.id === 'tirocinio' && !d.deletedAt)
  if (!r.enabled || !period?.date || !period.endDate || !isBetween(ctx.today, period.date, period.endDate)) return base
  return {
    tirocinio: true,
    hoursPerDay: r.t.hoursPerDay!,
    main: 'palestra',
    mainTarget: r.t.gym!,
    deadline: r.t.deadline!,
    runsTarget: r.t.runs!,
    note: {
      ruleId: 'tirocinio',
      title: 'Periodo di tirocinio',
      text: `Fino ${withDate('al', formatDate(period.endDate))}: obiettivo di ${formatHours(r.t.hoursPerDay!)} al giorno, palestra e corsa al posto dell’arrampicata.`,
      level: 'info',
    },
  }
}

// ——— regola 1: esame vicino ———

export function ruleExam(ctx: RuleContext, rule: ResolvedRule): { priority?: Priority; note?: BriefingNote } {
  const next = examsAhead(ctx.courses, ctx.today)[0]
  if (!rule.enabled || !next || next.days > rule.t.days!) return {}
  const when = next.days === 0 ? 'è oggi' : next.days === 1 ? 'è domani' : `è tra ${next.days} giorni`
  return {
    priority: { courseId: next.course.id, name: next.course.name, examDate: next.course.examDate!, days: next.days, fromRule: true },
    note: {
      ruleId: 'esame-vicino',
      title: `${next.course.name} è la priorità 1`,
      text: `L’esame ${when} (${formatDate(next.course.examDate!)}), entro la soglia di ${rule.t.days} giorni.`,
      level: next.days <= 7 ? 'avviso' : 'info',
    },
  }
}

// ——— regole 2, 3, 4: energia ———

export function ruleLowEnergy(energy: Energy, rule: ResolvedRule): BriefingNote | undefined {
  if (!rule.enabled || energy > rule.t.maxEnergy!) return undefined
  return {
    ruleId: 'energia-bassa',
    title: 'Niente teoria nuova',
    text: `Disco da ${ENERGY[energy].name}: blocchi da ${rule.t.block} minuti, ripasso attivo e schede.`,
    level: 'info',
  }
}

export function ruleMidEnergy(energy: Energy, rule: ResolvedRule, low: boolean, high: boolean): BriefingNote | undefined {
  if (!rule.enabled || low || high) return undefined
  return {
    ruleId: 'energia-media',
    title: 'L’esame più vicino per primo',
    text: `Disco da ${ENERGY[energy].name}: blocchi da ${rule.t.block} minuti con ${rule.t.pause} di pausa.`,
    level: 'info',
  }
}

export function ruleHighEnergy(energy: Energy, rule: ResolvedRule): BriefingNote | undefined {
  if (!rule.enabled || energy < rule.t.minEnergy!) return undefined
  return {
    ruleId: 'energia-alta',
    title: 'Teoria difficile nelle prime ore',
    text: `Disco da ${ENERGY[energy].name}: la teoria più impegnativa va al mattino, quando la testa regge.`,
    level: 'info',
  }
}

export function tierOf(energy: Energy, rules: Rules): Tier {
  if (ruleLowEnergy(energy, rules['energia-bassa'])) return 'low'
  if (ruleHighEnergy(energy, rules['energia-alta'])) return 'high'
  return 'mid'
}

// ——— regola 5: sport ———

export function ruleSport(ctx: RuleContext, rule: ResolvedRule, profile: Profile): { items: PlanItem[]; notes: BriefingNote[]; status: SportStatus } {
  const items: PlanItem[] = []
  const notes: BriefingNote[] = []
  const day = weekday(ctx.today)
  const mainDone = countThisWeek(ctx.workouts, profile.main, ctx.today)
  const runsDone = countThisWeek(ctx.workouts, 'corsa', ctx.today)
  const status: SportStatus = {
    main: profile.main,
    mainDone,
    mainTarget: profile.mainTarget,
    runsDone,
    runsTarget: profile.runsTarget,
    deadline: profile.deadline,
  }
  if (!rule.enabled) return { items, notes, status }

  const mainMissing = Math.max(0, profile.mainTarget - mainDone)
  const runsMissing = Math.max(0, profile.runsTarget - runsDone)
  const daysLeft = 8 - day // oggi compreso, fino a domenica
  const label = profile.main === 'arrampicata' ? 'Arrampicata' : 'Palestra'

  const fixed = (word: RegExp) =>
    ctx.events.find((e) => !e.deletedAt && e.date === ctx.today && e.type === 'sport' && word.test(e.title))

  let mainToday = false
  if (mainMissing > 0 && !didToday(ctx.workouts, profile.main, ctx.today)) {
    mainToday = true
    const event = fixed(profile.main === 'arrampicata' ? /arramp|boulder|falesia/i : /palestr|pesi/i)
    items.push({
      key: `sport:${profile.main}`,
      title: label,
      detail: `La ${ordinal(mainDone + 1)} delle ${num(profile.mainTarget)} di questa settimana.`,
      minutes: profile.main === 'arrampicata' ? 120 : 60,
      blocks: { count: 1, minutes: profile.main === 'arrampicata' ? 120 : 60, pause: 0 },
      at: event?.start,
      kind: profile.main,
      ruleId: profile.tirocinio ? 'tirocinio' : 'sport',
      evening: true,
    })
  }
  if (mainMissing > 0) {
    const late = day >= profile.deadline
    const by = day <= profile.deadline ? ` entro ${WEEKDAY_NAMES[profile.deadline]}` : ' questa settimana'
    notes.push({
      ruleId: 'sport',
      title: `${label}: ${mainDone} su ${profile.mainTarget}`,
      text: `Ne mancano ${mainMissing}${by}${mainToday ? ': una è nel piano di oggi' : ''}.`,
      level: late ? 'avviso' : 'info',
    })
  }

  if (runsMissing > 0 && !didToday(ctx.workouts, 'corsa', ctx.today)) {
    // Se oggi c'è già la sessione principale, la corsa aspetta finché c'è tempo.
    const crowded = mainToday && daysLeft > mainMissing + runsMissing - 1
    if (!crowded) {
      const event = fixed(/cors/i)
      items.push({
        key: 'sport:corsa',
        title: 'Corsa',
        detail: runsDone === 0 ? 'Nessuna corsa ancora questa settimana.' : `La ${ordinal(runsDone + 1)} corsa della settimana.`,
        minutes: rule.t.minutes!,
        blocks: { count: 1, minutes: rule.t.minutes!, pause: 0 },
        at: event?.start,
        kind: 'corsa',
        ruleId: 'sport',
        evening: true,
      })
    }
    notes.push({
      ruleId: 'sport',
      title: `Corsa: ${runsDone} su ${profile.runsTarget}`,
      text: crowded ? `Ne mancano ${runsMissing}: oggi c’è già ${label.toLowerCase()}, la corsa va nei prossimi giorni.` : `Ne mancano ${runsMissing}: una corsa da ${rule.t.minutes} minuti è nel piano.`,
      level: 'info',
    })
  }

  return { items, notes, status }
}

// ——— regola 6: Lean ———

export function leanGap(sessions: Session[], today: ISODate): number {
  const dates = sessions.filter((s) => !s.deletedAt && s.type === 'lean' && s.date <= today).map((s) => s.date)
  if (!dates.length) return Infinity
  return diffDays(dates.sort().at(-1)!, today)
}

export function ruleLean(ctx: RuleContext, rule: ResolvedRule): { today?: PlanItem; tomorrow?: PlanItem; note?: BriefingNote; gap: number } {
  const gap = leanGap(ctx.sessions, ctx.today)
  if (!rule.enabled || gap === 0) return { gap }
  const item = (days: number): PlanItem => ({
    key: 'lean',
    title: 'Lean 4',
    detail: Number.isFinite(days) ? `Fermo da ${days} giorni: esercizi del capitolo in corso.` : 'Riprendi dal capitolo in corso.',
    minutes: rule.t.minutes!,
    blocks: { count: 1, minutes: rule.t.minutes!, pause: 0 },
    kind: 'lean',
    ruleId: 'lean',
  })
  const out: { today?: PlanItem; tomorrow?: PlanItem; note?: BriefingNote; gap: number } = { gap }
  // Ieri era già oltre la soglia: la mezz'ora entra nel piano di oggi.
  if (gap - 1 > rule.t.days!) out.today = item(gap)
  if (gap > rule.t.days!) {
    out.tomorrow = item(gap + 1)
    out.note = {
      ruleId: 'lean',
      title: Number.isFinite(gap) ? `Lean fermo da ${gap} giorni` : 'Lean non ancora iniziato',
      text: `Oltre la soglia di ${rule.t.days}: ${rule.t.minutes} minuti nel piano di domani${out.today ? ' e già in quello di oggi' : ''}.`,
      level: out.today ? 'avviso' : 'info',
    }
  }
  return out
}

// ——— regola 7: ore della settimana ———

export function ruleHours(ctx: RuleContext, rule: ResolvedRule, hoursPerDay: number): { status: HoursStatus; note?: BriefingNote } {
  const last7 = hoursInWindow(ctx.sessions, addDays(ctx.today, -6), ctx.today)
  const target7 = hoursPerDay * 7
  const deficit = Math.max(0, target7 - last7)
  const status: HoursStatus = { last7, target7, hoursPerDay, tomorrow: hoursPerDay }
  if (!rule.enabled || deficit <= 0) return { status }
  // Il deficit si spalma sui sette giorni successivi.
  status.tomorrow = Math.min(rule.t.maxHours!, roundHalf(hoursPerDay + deficit / 7))
  return {
    status,
    note: {
      ruleId: 'ore-settimana',
      title: `${formatHours(last7)} su ${formatHours(target7)} negli ultimi 7 giorni`,
      text: `${formatHours(deficit)} sotto il ritmo di ${formatHours(hoursPerDay)} al giorno: l’obiettivo di domani sale a ${formatHours(status.tomorrow)}.`,
      level: deficit >= hoursPerDay ? 'avviso' : 'info',
    },
  }
}

// ——— regola 8: schede scadute ———

export function ruleCards(ctx: RuleContext, rule: ResolvedRule): { item?: PlanItem; note?: BriefingNote } {
  if (!rule.enabled) return {}
  const exams = examsAhead(ctx.courses, ctx.today)
  const rank = (id: string) => {
    const i = exams.findIndex((e) => e.course.id === id)
    return i < 0 ? exams.length : i
  }
  const names = new Map(ctx.courses.map((c) => [c.id, c.name]))
  const pick = (counts: Record<string, number>) =>
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => rank(a) - rank(b))
  const due = pick(ctx.cards.due)
  const fresh = pick(ctx.cards.fresh)
  const dueTotal = due.reduce((s, [, n]) => s + n, 0)
  const freshTotal = fresh.reduce((s, [, n]) => s + n, 0)
  if (!dueTotal && !freshTotal) return {}

  const minutes = Math.max(rule.t.minMinutes!, Math.min(rule.t.maxMinutes!, dueTotal + freshTotal))
  const first = (due[0] ?? fresh[0])![0]
  const detail = dueTotal
    ? `${dueTotal} ${dueTotal === 1 ? 'scheda scaduta' : 'schede scadute'}, prima ${names.get(first) ?? first}.`
    : `${freshTotal} schede nuove di ${names.get(first) ?? first}.`
  const item: PlanItem = {
    key: 'ripasso',
    title: 'Ripasso a 10 dita',
    detail,
    minutes,
    blocks: { count: 1, minutes, pause: 0 },
    kind: 'ripasso',
    courseId: first,
    ruleId: 'schede-scadute',
  }
  if (!dueTotal) return { item }
  return {
    item,
    note: {
      ruleId: 'schede-scadute',
      title: `${dueTotal} ${dueTotal === 1 ? 'scheda scaduta' : 'schede scadute'}`,
      text: `Nel piano ${minutes} minuti di ripasso a 10 dita, a partire da ${names.get(first) ?? first}.`,
      level: dueTotal > 40 ? 'avviso' : 'info',
    },
  }
}
