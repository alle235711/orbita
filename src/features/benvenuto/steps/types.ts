import type { WizardDraft } from '../wizard'

/** Le proprietà comuni di ogni passo: la bozza, come cambiarla e gli errori del passo. */
export interface StepProps {
  draft: WizardDraft
  change: (patch: Partial<WizardDraft>) => void
  errors: Record<string, string> | null
  mode: 'first' | 'complete'
}
