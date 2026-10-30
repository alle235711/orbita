// Compone il piano del giorno: titolo, regola applicata, attività ordinate
// e note del briefing, a partire dalle nove regole.

import type { Course } from '../db/schema'
import type { Format } from '../i18n/format/types'
import { m as msg, type PlanMsg } from '../i18n/messages'
import { DEFAULT_ENERGY, type Energy } from '../lib/energy'
import { blocksFor } from './blocks'
import { resolveGroups, type Tuning } from './defaults'
import {
  examsAhead,
  resolveRules,
  ruleAbility,
  ruleCards,
  ruleExam,
  ruleHighEnergy,
  ruleHours,
  ruleLowEnergy,
  ruleMidEnergy,
  rulePeriod,
  ruleSport,
  type Exam,
} from './rules'
import type { BriefingNote, DayPlan, PlanItem, RuleContext, Tier } from './types'

const HEADLINES: Record<Tier, [PlanMsg, PlanMsg]> = {
  low: [msg('headlineLowA'), msg('headlineLowB')],
  mid: [msg('headlineMidA'), msg('headlineMidB')],
  high: [msg('headlineHighA'), msg('headlineHighB')],
}

interface BlockPair {
  block: number
  pause: number
}

function ruleSentence(tier: Tier, energy: Energy, bp: BlockPair, hasExam: boolean): PlanMsg {
  switch (tier) {
    case 'low':
      return msg('ruleLow', { block: bp.block })
    case 'high':
      return msg('ruleHigh', { energy })
    default:
      return hasExam ? msg('ruleMidExam', { block: bp.block }) : msg('ruleMid', { block: bp.block, pause: bp.pause })
  }
}

/** La teoria più difficile: difficoltà più alta, a pari merito l'esame più vicino. */
export function hardestCourse(exams: Exam[]): Course | undefined {
  let best: Exam | undefined
  for (const e of exams) if (!best || e.course.difficulty > best.course.difficulty) best = e
  return best?.course
}

function block(count: number, minutes: number, pause: number) {
  return { count, minutes, pause }
}

function studyItems(tier: Tier, bp: BlockPair, tuning: Tuning, exams: Exam[], priority: Exam | undefined): PlanItem[] {
  const fromRule1 = priority !== undefined
  const first = priority ?? exams[0]
  const others = exams.filter((e) => e.course.id !== first?.course.id)

  if (!first) {
    const minutes = bp.block
    return [
      {
        key: 'studio',
        title: msg('studyFreeTitle'),
        detail: msg('studyFreeDetail'),
        minutes,
        blocks: block(1, minutes, 0),
        kind: 'studio',
        ruleId: tier === 'low' ? 'energia-bassa' : tier === 'high' ? 'energia-alta' : 'energia-media',
      },
    ]
  }

  if (tier === 'low') {
    const m = bp.block
    return [
      {
        key: `studio:${first.course.id}:ripasso-attivo`,
        title: msg('activeReviewTitle', { course: first.course.name }),
        detail: msg('activeReviewDetail'),
        minutes: m,
        blocks: block(1, m, bp.pause),
        kind: 'studio',
        courseId: first.course.id,
        ruleId: 'energia-bassa',
      },
    ]
  }

  if (tier === 'mid') {
    const m = bp.block
    const pause = bp.pause
    const second = tuning.giornata.secondExerciseMinutes!
    const items: PlanItem[] = [
      {
        key: `studio:${first.course.id}:esercizi`,
        title: msg('exercisesTitle', { course: first.course.name }),
        detail: msg('exercisesFirstDetail', { days: first.days }),
        minutes: 2 * m,
        blocks: block(2, m, pause),
        kind: 'studio',
        courseId: first.course.id,
        ruleId: fromRule1 ? 'esame-vicino' : 'energia-media',
      },
    ]
    const other = others[0]
    if (other) {
      items.push({
        key: `studio:${other.course.id}:esercizi`,
        title: msg('exercisesTitle', { course: other.course.name }),
        detail: msg('exercisesSecondDetail'),
        minutes: second,
        blocks: block(1, second, pause),
        kind: 'studio',
        courseId: other.course.id,
        ruleId: 'energia-media',
      })
    }
    return items
  }

  // tier alto: con un esame entro la soglia la teoria è sua, altrimenti della più difficile
  const m = bp.block
  const theory = fromRule1 ? first.course : hardestCourse(exams)!
  const items: PlanItem[] = [
    {
      key: `studio:${theory.id}:teoria`,
      title: msg('theoryTitle', { course: theory.name }),
      detail: msg('theoryDetail'),
      minutes: 2 * m,
      blocks: block(2, m, bp.pause),
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
      title: msg('exercisesTitle', { course: next.course.name }),
      detail: msg('exercisesHighDetail', { days: next.days }),
      minutes: m,
      blocks: block(1, m, bp.pause),
      kind: 'studio',
      courseId: next.course.id,
      ruleId: 'energia-alta',
    })
  }
  return items
}

export function evaluate(ctx: RuleContext): DayPlan {
  const rules = resolveRules(ctx.rules)
  const tuning = resolveGroups(ctx.rules)
  const energy = ctx.energy ?? DEFAULT_ENERGY
  const exams = examsAhead(ctx.courses, ctx.today)

  const tier: Tier = rules['energia-bassa'].enabled && energy <= rules['energia-bassa'].t.maxEnergy! ? 'low' : rules['energia-alta'].enabled && energy >= rules['energia-alta'].t.minEnergy! ? 'high' : 'mid'
  const bp = blocksFor(ctx.studyBlock.preset, tier)
  const midBp = blocksFor(ctx.studyBlock.preset, 'mid')

  const profile = rulePeriod(ctx, rules)
  const exam = ruleExam(ctx, rules['esame-vicino'])
  const low = ruleLowEnergy(energy, rules['energia-bassa'], bp.block)
  const high = low ? undefined : ruleHighEnergy(energy, rules['energia-alta'])
  const mid = ruleMidEnergy(energy, rules['energia-media'], !!low, !!high, midBp.block, midBp.pause)
  const sport = ruleSport(ctx, rules.sport, profile)
  const ability = ruleAbility(ctx, rules.abilita)
  const hours = ruleHours(ctx, rules['ore-settimana'], profile.hoursPerDay)
  const cards = ruleCards(ctx, rules['schede-scadute'])

  const priorityExam = exam.priority ? exams.find((e) => e.course.id === exam.priority!.courseId) : undefined
  const study = studyItems(tier, bp, tuning, exams, priorityExam)

  let sportItems = sport.items
  if (tier === 'low' && sportItems.some((i) => !i.at)) {
    // Con il disco quasi spento lo sport proposto diventa recupero attivo;
    // quello già fissato in agenda resta.
    const fixed = sportItems.filter((i) => i.at)
    const walk = tuning.giornata.walkMinutes!
    sportItems = fixed.length
      ? fixed
      : [
          {
            key: 'camminata',
            title: msg('walkTitle'),
            detail: msg('walkDetail'),
            minutes: walk,
            blocks: block(1, walk, 0),
            kind: 'camminata',
            ruleId: 'energia-bassa',
            evening: true,
          },
        ]
  }

  const extras = [cards.item, ability.today].filter((i): i is PlanItem => !!i)
  let items: PlanItem[]
  if (tier === 'high') items = [...study, ...(ability.today ? [ability.today] : []), ...(cards.item ? [cards.item] : []), ...sportItems]
  else items = [...study, ...extras, ...sportItems]

  // La lettura riempie le giornate leggere, solo se il modulo è acceso.
  if (tier === 'low' && items.length < tuning.giornata.fillerBelow! && ctx.modules.lettura.enabled) {
    const reading = tuning.giornata.readingMinutes!
    items.push({
      key: 'lettura',
      title: msg('readingTitle'),
      detail: msg('readingDetail'),
      minutes: reading,
      blocks: block(1, reading, 0),
      kind: 'lettura',
      ruleId: 'energia-bassa',
      evening: true,
    })
  }

  const notes = [profile.note, exam.note, low ?? mid ?? high, hours.note, cards.note, ...sport.notes, ability.note].filter(
    (n): n is BriefingNote => !!n,
  )

  return {
    tier,
    energy,
    headline: HEADLINES[tier],
    rule: ruleSentence(tier, energy, tier === 'mid' ? midBp : bp, exams.length > 0),
    items,
    tomorrow: ability.tomorrow ? [ability.tomorrow] : [],
    notes,
    priority: exam.priority,
    hours: hours.status,
    sport: sport.status,
    abilityGap: ability.gap,
    period: profile.period,
  }
}

/** "2 × 90 min", "45 min" oppure l'orario fissato. */
export function itemDuration(item: Pick<PlanItem, 'at' | 'blocks' | 'minutes'>, _f: Format): string {
  if (item.at) return item.at
  if (item.blocks.count > 1) return `${item.blocks.count} × ${item.blocks.minutes} min`
  return `${item.minutes} min`
}
