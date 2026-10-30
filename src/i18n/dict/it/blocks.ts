import type { BlockPreset } from '../../../modules/types'
import type { Format } from '../../format/types'

const presets: Record<BlockPreset, string> = {
  '25/5': '25 minuti, 5 di pausa',
  '45/10': '45 minuti, 10 di pausa',
  '50/10': '50 minuti, 10 di pausa',
  '90/15': '90 minuti, 15 di pausa',
}

export const blocks = {
  title: 'Blocchi di studio',
  lead: 'La durata dei blocchi del piano: ogni blocco è seguito da una pausa.',
  group: 'Blocco di studio',
  presets,
  lowHint: (p: { preset: string }) => `In energia bassa: ${p.preset}`,
  hintTitle: 'Suggerimento',
  hintOn: 'Suggerisci un blocco più lungo',
  hintLookback: 'Giorni da guardare',
  hintMinSessions: 'Sessioni minime',
  hintMinShare: 'Quota di sessioni lunghe (%)',
  hintOverrun: 'Sforamento minimo (%)',
  hint: (p: { from: string; to: string; over: number; total: number }, f: Format) =>
    `Hai superato il blocco ${p.from} in ${f.number(p.over)} sessioni su ${f.number(p.total)}: forse ti sta meglio ${p.to}.`,
  use: (p: { preset: string }) => `Usa ${p.preset}`,
}
