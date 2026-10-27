// Compone il piano del giorno: titolo, regola applicata, attività ordinate
// e note del briefing, a partire dalle nove regole.

import type { Course } from '../db/schema'
import { DEFAULT_ENERGY, type Energy } from '../lib/energy'
import {
  examsAhead,
  resolveRules,
  ruleCards,
  ruleExam,
  ruleHighEnergy,
  ruleHours,
  ruleLean,
  ruleLowEnergy,
  ruleMidEnergy,
  ruleSport,
  ruleTirocinio,
  type Exam,
} from './rules'
import type { BriefingNote, DayPlan, PlanItem, RuleContext, Rules, Tier } from './types'

const HEADLINES: Record<Tier, [string, string]> = {
  low: ['Una giornata', 'per ricaricarsi'],
  mid: ['Una giornata', 'da esercizi'],
  high: ['Una giornata', 'da teoria nuova'],
}

function ruleSentence(tier: Tier, energy: Energy, rules: Rules, hasExam: boolean): string {
  switch (tier) {
    case 'low':
      return `Disco quasi spento: niente teoria nuova, blocchi da ${rules['energia-bassa'].t.block} minuti e tanto ripasso attivo.`
    case 'high':
      return `Regime da ${energy === 5 ? 'blazar' : 'quasar'}: la teoria più difficile nelle prime ore, quando la testa regge.`
    default:
      return hasExam
        ? `Accrescimento regolare: l’esame più vicino va per primo, in blocchi da ${rules['energia-media'].t.block} minuti.`
        : `Accrescimento regolare: blocchi da ${rules['energia-media'].t.block} minuti con ${rules['energia-media'].t.pause} di pausa.`
  }
}

const toExam = (days: number) => (days === 0 ? 'L’esame è oggi.' : days === 1 ? 'L’esame è domani.' : `${days} giorni all’esame.`)

/** La teoria più difficile: difficoltà più alta, a pari merito l'esame più vicino. */
export function hardestCourse(exams: Exam[]): Course | undefined {
  let best: Exam | undefined
  for (const e of exams) if (!best || e.course.difficulty > best.course.difficulty) best = e
  return best?.course
}

function block(count: number, minutes: number, pause: number) {
  return { count, minutes, pause }
}

function studyItems(tier: Tier, rules: Rules, exams: Exam[], priority: Exam | undefined): PlanItem[] {
  const fromRule1 = priority !== undefined
  const first = priority ?? exams[0]
  const others = exams.filter((e) => e.course.id !== first?.course.id)

  if (!first) {
    const minutes = tier === 'low' ? rules['energia-bassa'].t.block! : rules['energia-media'].t.block!
    return [
      {
        key: 'studio',
        title: 'Studio',
        detail: 'Nessun esame in calendario: scegli tu la materia.',
        minutes,
        blocks: block(1, minutes, 0),
        kind: 'studio',
        ruleId: tier === 'low' ? 'energia-bassa' : tier === 'high' ? 'energia-alta' : 'energia-media',
      },
    ]
  }

  if (tier === 'low') {
    const m = rules['energia-bassa'].t.block!
    return [
      {
        key: `studio:${first.course.id}:ripasso-attivo`,
        title: `Ripasso attivo di ${first.course.name}`,
        detail: 'Spiega a voce i risultati principali: niente teoria nuova.',
        minutes: m,
        blocks: block(1, m, 10),
        kind: 'studio',
        courseId: first.course.id,
        ruleId: 'energia-bassa',
      },
    ]
  }

  if (tier === 'mid') {
    const { block: m, pause } = rules['energia-media'].t
    const items: PlanItem[] = [
      {
        key: `studio:${first.course.id}:esercizi`,
        title: `Esercizi di ${first.course.name}`,
        detail: `Esercizi d’esame. ${toExam(first.days)}`,
        minutes: 2 * m!,
        blocks: block(2, m!, pause!),
        kind: 'studio',
        courseId: first.course.id,
        ruleId: fromRule1 ? 'esame-vicino' : 'energia-media',
      },
    ]
    const second = others[0]
    if (second) {
      items.push({
        key: `studio:${second.course.id}:esercizi`,
        title: `Esercizi di ${second.course.name}`,
        detail: 'Un esercizio completo, dall’inizio alla fine.',
        minutes: 60,
        blocks: block(1, 60, pause!),
        kind: 'studio',
        courseId: second.course.id,
        ruleId: 'energia-media',
      })
    }
    return items
  }

  // tier alto: con un esame entro la soglia la teoria è sua, altrimenti della più difficile
  const m = rules['energia-alta'].t.block!
  const theory = fromRule1 ? first.course : hardestCourse(exams)!
  const items: PlanItem[] = [
    {
      key: `studio:${theory.id}:teoria`,
      title: `Teoria nuova di ${theory.name}`,
      detail: 'Ricostruisci le dimostrazioni senza appunti.',
      minutes: 2 * m,
      blocks: block(2, m, 15),
      kind: 'studio',
      courseId: theory.id,
      ruleId: 'energia-alta',
      morning: true,
    },
  ]
  const next = fromRule1 ? others[0] : exams.find((e) => e.course.id !== theory.id)
  if (next) {
    items.push({
      key: `studio:${next.course.id}:esercizi`,
      title: `Esercizi di ${next.course.name}`,
      detail: toExam(next.days),
      minutes: m,
      blocks: block(1, m, 15),
      kind: 'studio',
      courseId: next.course.id,
      ruleId: 'energia-alta',
    })
  }
  return items
}

export function evaluate(ctx: RuleContext): DayPlan {
  const rules = resolveRules(ctx.rules)
  const energy = ctx.energy ?? DEFAULT_ENERGY
  const exams = examsAhead(ctx.courses, ctx.today)

  const profile = ruleTirocinio(ctx, rules)
  const exam = ruleExam(ctx, rules['esame-vicino'])
  const low = ruleLowEnergy(energy, rules['energia-bassa'])
  const high = low ? undefined : ruleHighEnergy(energy, rules['energia-alta'])
  const mid = ruleMidEnergy(energy, rules['energia-media'], !!low, !!high)
  const tier: Tier = low ? 'low' : high ? 'high' : 'mid'
  const sport = ruleSport(ctx, rules.sport, profile)
  const lean = ruleLean(ctx, rules.lean)
  const hours = ruleHours(ctx, rules['ore-settimana'], profile.hoursPerDay)
  const cards = ruleCards(ctx, rules['schede-scadute'])

  const priorityExam = exam.priority ? exams.find((e) => e.course.id === exam.priority!.courseId) : undefined
  const study = studyItems(tier, rules, exams, priorityExam)

  let sportItems = sport.items
  if (tier === 'low' && sportItems.some((i) => !i.at)) {
    // Con il disco quasi spento lo sport proposto diventa recupero attivo;
    // quello già fissato in agenda resta.
    const fixed = sportItems.filter((i) => i.at)
    sportItems = fixed.length
      ? fixed
      : [
          {
            key: 'camminata',
            title: 'Camminata',
            detail: 'Recupero attivo, lo sport aspetta.',
            minutes: 30,
            blocks: block(1, 30, 0),
            kind: 'camminata',
            ruleId: 'energia-bassa',
            evening: true,
          },
        ]
  }

  const extras = [cards.item, lean.today].filter((i): i is PlanItem => !!i)
  let items: PlanItem[]
  if (tier === 'high') items = [...study, ...(lean.today ? [lean.today] : []), ...(cards.item ? [cards.item] : []), ...sportItems]
  else items = [...study, ...extras, ...sportItems]

  if (tier === 'low' && items.length < 4) {
    items.push({
      key: 'lettura',
      title: 'Lettura',
      detail: 'Un capitolo, senza telefono.',
      minutes: 30,
      blocks: block(1, 30, 0),
      kind: 'lettura',
      ruleId: 'energia-bassa',
      evening: true,
    })
  }

  const notes = [profile.note, exam.note, low ?? mid ?? high, hours.note, cards.note, ...sport.notes, lean.note].filter(
    (n): n is BriefingNote => !!n,
  )

  return {
    tier,
    energy,
    headline: HEADLINES[tier],
    rule: ruleSentence(tier, energy, rules, exams.length > 0),
    items,
    tomorrow: lean.tomorrow ? [lean.tomorrow] : [],
    notes,
    priority: exam.priority,
    hours: hours.status,
    sport: sport.status,
    leanGap: lean.gap,
    tirocinio: profile.tirocinio,
  }
}

/** "2 × 90 min", "45 min" oppure l'orario fissato. */
export function itemDuration(item: PlanItem): string {
  if (item.at) return item.at
  if (item.blocks.count > 1) return `${item.blocks.count} × ${item.blocks.minutes} min`
  return `${item.minutes} min`
}
