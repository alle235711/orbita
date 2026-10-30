// Blocchi di studio: preset (blocco + pausa) e scelta del preset più vicino.

import type { Session } from '../db/schema'
import { addDays, type ISODate } from '../lib/dates'
import { DEFAULT_STUDY_BLOCK, type BlockPreset, type StudyBlockSettings } from '../modules/types'
import type { Tier } from './types'

export const BLOCK_PRESETS: readonly { id: BlockPreset; block: number; pause: number }[] = [
  { id: '25/5', block: 25, pause: 5 },
  { id: '45/10', block: 45, pause: 10 },
  { id: '50/10', block: 50, pause: 10 },
  { id: '90/15', block: 90, pause: 15 },
]

export const DEFAULT_PRESET: BlockPreset = DEFAULT_STUDY_BLOCK.preset

/** Il preset con il blocco più vicino a `minutes`; a pari distanza vince il blocco più lungo. */
export function presetFromBlock(minutes: number): BlockPreset {
  if (!Number.isFinite(minutes)) return DEFAULT_PRESET
  let best = BLOCK_PRESETS[0]
  for (const p of BLOCK_PRESETS) {
    const d = Math.abs(p.block - minutes)
    const bd = Math.abs(best.block - minutes)
    if (d < bd || (d === bd && p.block > best.block)) best = p
  }
  return best.id
}

/** Il preset subito più corto (il 25/5 resta se stesso). */
function shorter(preset: BlockPreset): BlockPreset {
  const i = BLOCK_PRESETS.findIndex((p) => p.id === preset)
  return BLOCK_PRESETS[Math.max(0, i - 1)]!.id
}

/** Blocco di studio per fascia: medio e alto il preset stesso, basso il preset più corto. */
export function blocksFor(preset: BlockPreset, tier: Tier): { preset: BlockPreset; block: number; pause: number } {
  const id = tier === 'low' ? shorter(preset) : preset
  const p = BLOCK_PRESETS.find((b) => b.id === id)!
  return { preset: id, block: p.block, pause: p.pause }
}

export interface BlockHint {
  from: BlockPreset
  to: BlockPreset
  sessions: number
  over: number
  share: number
}

/**
 * Suggerisce un preset più lungo se le sessioni di studio partite dal timer del
 * piano sforano spesso il blocco previsto. Non scrive nulla: lo applica solo il
 * pulsante del briefing.
 */
export function blockHint(sessions: Session[], today: ISODate, studyBlock: StudyBlockSettings): BlockHint | null {
  const { preset, hint } = studyBlock
  if (!hint.enabled) return null
  const i = BLOCK_PRESETS.findIndex((p) => p.id === preset)
  const next = BLOCK_PRESETS[i + 1]
  if (!next) return null
  const base = BLOCK_PRESETS[i]!.block
  const from = addDays(today, -(hint.lookbackDays - 1))
  const pool = sessions.filter((s) => !s.deletedAt && s.type === 'studio' && s.planned === base && s.date >= from && s.date <= today)
  const over = pool.filter((s) => s.minutes >= base * (1 + hint.overrunPct / 100) - 1e-9).length
  if (pool.length < hint.minSessions || over / pool.length < hint.minShare) return null
  return { from: preset, to: next.id, sessions: pool.length, over, share: over / pool.length }
}
