// Le nove regole della SPEC §4, ciascuna una funzione pura che legge il
// contesto e le proprie soglie e dice se scatta, con il perché.

import type { Course, RuleConfig, Session, SessionType, Workout, WorkoutType } from '../db/schema'
import { WORKOUT_ORDER } from '../db/schema'
import { m } from '../i18n/messages'
import { addDays, diffDays, isBetween, isMonthOnly, lastDayOfMonth, resolveDate, weekday, weekStart, type ISODate } from '../lib/dates'
import type { Energy } from '../lib/energy'
import { workSessionTypes, workoutTypeEnabled } from '../modules/registry'
import { RULES, defaultThresholds } from './defaults'
import type { ActivePeriod, BriefingNote, HoursStatus, PlanItem, Priority, ResolvedRule, RuleContext, Rules, SportStatus, Tier } from './types'

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

/**
 * Esami da oggi in poi, dal più vicino. Un esame con il solo mese resta in
 * arrivo fino all'ultimo giorno di quel mese: conta dal 1° finché non è
 * passato, poi dall'ultimo giorno.
 */
export function examsAhead(courses: Course[], today: ISODate): Exam[] {
  const out: Exam[] = []
  for (const c of courses) {
    if (c.deletedAt || !c.examDate) continue
    let date = resolveDate(c.examDate)
    if (isMonthOnly(c.examDate) && date < today) date = lastDayOfMonth(c.examDate)
    const days = diffDays(today, date)
    if (days >= 0) out.push({ course: c, date, days })
  }
  return out.sort((a, b) => a.days - b.days || a.course.name.localeCompare(b.course.name, 'it'))
}

/** Ore di studio e lavoro nella finestra; `types` sono i tipi che contano (di base studio, ripasso, lavoro). */
export function hoursInWindow(sessions: Session[], from: ISODate, to: ISODate, types: readonly SessionType[] = WORK_TYPES): number {
  const minutes = sessions
    .filter((s) => !s.deletedAt && types.includes(s.type) && isBetween(s.date, from, to))
    .reduce((sum, s) => sum + s.minutes, 0)
  return minutes / 60
}

function countThisWeek(workouts: Workout[], type: WorkoutType, today: ISODate): number {
  const start = weekStart(today)
  return workouts.filter((w) => !w.deletedAt && w.type === type && isBetween(w.date, start, today)).length
}

const didToday = (workouts: Workout[], type: WorkoutType, today: ISODate) =>
  workouts.some((w) => !w.deletedAt && w.type === type && w.date === today)

export const roundHalf = (h: number) => Math.round(h * 2) / 2

// ——— regola 9: periodo speciale ———

export interface DayProfile {
  period?: ActivePeriod
  hoursPerDay: number
  /** Obiettivo settimanale effettivo per tipo (0 per i tipi spenti o con lo sport spento). */
  sportTargets: Record<WorkoutType, number>
  /** Giorno ISO entro cui chiudere gli obiettivi di sport. */
  sportDeadline: number
  note?: BriefingNote
}

export function rulePeriod(ctx: RuleContext, rules: Rules): DayProfile {
  const sportTargets = {} as Record<WorkoutType, number>
  for (const t of WORKOUT_ORDER) sportTargets[t] = workoutTypeEnabled(ctx.modules, t) ? ctx.modules.sport.types[t].target : 0
  const base: DayProfile = { hoursPerDay: rules['ore-settimana'].t.hoursPerDay!, sportTargets, sportDeadline: rules.sport.t.deadline! }
  if (!rules.periodo.enabled) return base

  // Più periodi attivi: vince quello che è iniziato per ultimo (a pari data, l'id più basso).
  const active = ctx.deadlines
    .filter((d) => d.kind === 'periodo' && !d.deletedAt && !!d.date && !!d.endDate && isBetween(ctx.today, d.date, d.endDate))
    .sort((a, b) => b.date!.localeCompare(a.date!) || a.id.localeCompare(b.id))[0]
  if (!active) return base

  const targets = { ...sportTargets }
  for (const t of WORKOUT_ORDER) {
    const o = active.sport?.[t]
    if (typeof o === 'number' && workoutTypeEnabled(ctx.modules, t)) targets[t] = o
  }
  return {
    period: { id: active.id, name: active.title, start: active.date!, end: active.endDate! },
    hoursPerDay: active.hoursPerDay ?? base.hoursPerDay,
    sportTargets: targets,
    sportDeadline: active.deadlineDay ?? base.sportDeadline,
    note: {
      ruleId: 'periodo',
      title: m('periodTitle', { period: active.title }),
      text: m('periodText', { end: active.endDate!, hoursPerDay: active.hoursPerDay ?? null, sport: !!active.sport }),
      level: 'info',
    },
  }
}

// ——— regola 1: esame vicino ———

export function ruleExam(ctx: RuleContext, rule: ResolvedRule): { priority?: Priority; note?: BriefingNote } {
  const next = examsAhead(ctx.courses, ctx.today)[0]
  if (!rule.enabled || !next || next.days > rule.t.days!) return {}
  return {
    priority: { courseId: next.course.id, name: next.course.name, examDate: next.course.examDate!, days: next.days, fromRule: true },
    note: {
      ruleId: 'esame-vicino',
      title: m('examTitle', { name: next.course.name }),
      text: m('examText', { days: next.days, date: next.course.examDate!, threshold: rule.t.days! }),
      level: next.days <= rule.t.warnDays! ? 'avviso' : 'info',
    },
  }
}

// ——— regole 2, 3, 4: energia ———

export function ruleLowEnergy(energy: Energy, rule: ResolvedRule, block: number): BriefingNote | undefined {
  if (!rule.enabled || energy > rule.t.maxEnergy!) return undefined
  return {
    ruleId: 'energia-bassa',
    title: m('lowTitle'),
    text: m('lowText', { energy, block }),
    level: 'info',
  }
}

export function ruleMidEnergy(energy: Energy, rule: ResolvedRule, low: boolean, high: boolean, block: number, pause: number): BriefingNote | undefined {
  if (!rule.enabled || low || high) return undefined
  return {
    ruleId: 'energia-media',
    title: m('midTitle'),
    text: m('midText', { energy, block, pause }),
    level: 'info',
  }
}

export function ruleHighEnergy(energy: Energy, rule: ResolvedRule): BriefingNote | undefined {
  if (!rule.enabled || energy < rule.t.minEnergy!) return undefined
  return {
    ruleId: 'energia-alta',
    title: m('highTitle'),
    text: m('highText', { energy }),
    level: 'info',
  }
}

export function tierOf(energy: Energy, rules: Rules): Tier {
  if (ruleLowEnergy(energy, rules['energia-bassa'], 0)) return 'low'
  if (ruleHighEnergy(energy, rules['energia-alta'])) return 'high'
  return 'mid'
}

// ——— regola 5: sport ———

/** Parole che, nel titolo di un impegno di sport, lo riconducono a un tipo. */
export const SPORT_KEYWORDS: Record<WorkoutType, readonly string[]> = {
  arrampicata: ['arramp', 'boulder', 'falesia'],
  palestra: ['palestr', 'pesi'],
  corsa: ['cors'],
  nuoto: ['nuot', 'piscin'],
  altro: [],
}

export function ruleSport(ctx: RuleContext, rule: ResolvedRule, profile: DayProfile): { items: PlanItem[]; notes: BriefingNote[]; status: SportStatus } {
  const items: PlanItem[] = []
  const notes: BriefingNote[] = []
  const day = weekday(ctx.today)
  const types = WORKOUT_ORDER.filter((t) => workoutTypeEnabled(ctx.modules, t))
  const doneCount = Object.fromEntries(types.map((t) => [t, countThisWeek(ctx.workouts, t, ctx.today)])) as Record<WorkoutType, number>
  const status: SportStatus = {
    types: types.map((type) => ({ type, done: doneCount[type], target: profile.sportTargets[type] })),
    deadline: profile.sportDeadline,
  }
  if (!rule.enabled || !types.length) return { items, notes, status }

  const missingOf = (t: WorkoutType) => Math.max(0, profile.sportTargets[t] - doneCount[t])
  const totalMissing = types.filter((t) => profile.sportTargets[t] > 0).reduce((n, t) => n + missingOf(t), 0)
  const daysLeft = 8 - day // oggi compreso, fino a domenica
  const late = day >= profile.sportDeadline
  const proposed: WorkoutType[] = []

  const fixed = (t: WorkoutType) =>
    SPORT_KEYWORDS[t].length
      ? ctx.events.find((e) => !e.deletedAt && e.date === ctx.today && e.type === 'sport' && SPORT_KEYWORDS[t].some((w) => e.title.toLowerCase().includes(w)))
      : undefined

  for (const t of types) {
    const missing = missingOf(t)
    if (profile.sportTargets[t] <= 0 || missing <= 0) continue
    const minutes = ctx.modules.sport.types[t].minutes
    const done = doneCount[t]
    // Se oggi c'è già un altro sport, questo aspetta finché c'è tempo.
    const crowded = proposed.length > 0 && daysLeft > totalMissing - 1
    const planned = !didToday(ctx.workouts, t, ctx.today) && !crowded
    const other = proposed[0]
    if (planned) {
      items.push({
        key: `sport:${t}`,
        title: m('sportTitle', { sport: t }),
        detail: t === 'corsa' ? (done === 0 ? m('runDetailFirst') : m('runDetailNth', { n: done + 1 })) : m('sportMainDetail', { n: done + 1, total: profile.sportTargets[t] }),
        minutes,
        blocks: { count: 1, minutes, pause: 0 },
        at: fixed(t)?.start,
        kind: t,
        ruleId: profile.period ? 'periodo' : 'sport',
        evening: true,
      })
      proposed.push(t)
    }
    const byDay = day <= profile.sportDeadline ? profile.sportDeadline : null
    let text: BriefingNote['text']
    if (t === 'corsa' && other && crowded) text = m('runsCrowded', { missing, sport: other })
    else if (t === 'corsa' && planned) text = m('runsPlanned', { missing, minutes })
    else if (t !== 'corsa' && other && crowded) text = m('sportCrowded', { missing, sport: t, other })
    else if (t !== 'corsa' && planned && proposed.length > 1) text = m('sportPlanned', { missing, sport: t, minutes })
    else text = m('sportMissing', { missing, byDay, inPlanToday: planned })
    notes.push({ ruleId: 'sport', title: m('sportProgress', { sport: t, done, target: profile.sportTargets[t] }), text, level: late ? 'avviso' : 'info' })
  }

  return { items, notes, status }
}

// ——— regola 6: abilità personale ———

export function abilityGap(sessions: Session[], today: ISODate): number {
  const dates = sessions.filter((s) => !s.deletedAt && s.type === 'abilita' && s.date <= today).map((s) => s.date)
  if (!dates.length) return Infinity
  return diffDays(dates.sort().at(-1)!, today)
}

export function ruleAbility(ctx: RuleContext, rule: ResolvedRule): { today?: PlanItem; tomorrow?: PlanItem; note?: BriefingNote; gap: number } {
  const gap = abilityGap(ctx.sessions, ctx.today)
  if (!rule.enabled || !ctx.modules.abilita.enabled || gap === 0) return { gap }
  const name = ctx.modules.abilita.name ?? null
  const item = (days: number): PlanItem => ({
    key: 'abilita',
    title: m('abilityItemTitle', { name }),
    detail: Number.isFinite(days) ? m('abilityItemDetail', { days }) : m('abilityItemDetailNever'),
    minutes: rule.t.minutes!,
    blocks: { count: 1, minutes: rule.t.minutes!, pause: 0 },
    kind: 'abilita',
    ruleId: 'abilita',
  })
  const out: { today?: PlanItem; tomorrow?: PlanItem; note?: BriefingNote; gap: number } = { gap }
  // Ieri era già oltre la soglia: i minuti entrano nel piano di oggi.
  if (gap - 1 > rule.t.days!) out.today = item(gap)
  if (gap > rule.t.days!) {
    out.tomorrow = item(gap + 1)
    out.note = {
      ruleId: 'abilita',
      title: Number.isFinite(gap) ? m('abilityIdleTitle', { name, days: gap }) : m('abilityNeverTitle', { name }),
      text: m('abilityText', { threshold: rule.t.days!, minutes: rule.t.minutes!, alsoToday: !!out.today }),
      level: out.today ? 'avviso' : 'info',
    }
  }
  return out
}

// ——— regola 7: ore della settimana ———

export function ruleHours(ctx: RuleContext, rule: ResolvedRule, hoursPerDay: number): { status: HoursStatus; note?: BriefingNote } {
  const last7 = hoursInWindow(ctx.sessions, addDays(ctx.today, -6), ctx.today, workSessionTypes(ctx.modules))
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
      title: m('hoursTitle', { last7, target7 }),
      text: m('hoursText', { deficit, perDay: hoursPerDay, tomorrow: status.tomorrow }),
      level: deficit >= rule.t.warnDeficitDays! * hoursPerDay ? 'avviso' : 'info',
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
  const course = names.get(first) ?? first
  const detail = dueTotal ? m('cardsDueDetail', { due: dueTotal, course }) : m('cardsFreshDetail', { fresh: freshTotal, course })
  const item: PlanItem = {
    key: 'ripasso',
    title: m('cardsItemTitle'),
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
      title: m('cardsNoteTitle', { due: dueTotal }),
      text: m('cardsNoteText', { minutes, course }),
      level: dueTotal > rule.t.warnDue! ? 'avviso' : 'info',
    },
  }
}
