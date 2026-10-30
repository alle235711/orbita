import type { BlockPreset } from '../../../modules/types'
import type { Format } from '../../format/types'

const presets: Record<BlockPreset, string> = {
  '25/5': '25 minutes, 5 break',
  '45/10': '45 minutes, 10 break',
  '50/10': '50 minutes, 10 break',
  '90/15': '90 minutes, 15 break',
}

export const blocks = {
  title: 'Study blocks',
  lead: 'The length of the plan’s blocks: each block is followed by a break.',
  group: 'Study block',
  presets,
  lowHint: (p: { preset: string }) => `On low energy: ${p.preset}`,
  hintTitle: 'Suggestion',
  hintOn: 'Suggest a longer block',
  hintLookback: 'Days to look at',
  hintMinSessions: 'Minimum sessions',
  hintMinShare: 'Share of long sessions (%)',
  hintOverrun: 'Minimum overrun (%)',
  hint: (p: { from: string; to: string; over: number; total: number }, f: Format) =>
    `You went past the ${p.from} block in ${f.number(p.over)} of ${f.number(p.total)} sessions: ${p.to} may suit you better.`,
  use: (p: { preset: string }) => `Use ${p.preset}`,
}
