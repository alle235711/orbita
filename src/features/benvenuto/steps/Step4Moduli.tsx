import { ModuleSwitches } from '../../../components/ModuleSwitches'
import type { StepProps } from './types'

/** I sette moduli, gli stessi interruttori di Dati; il peso parte spento. */
export function Step4Moduli({ draft, change }: StepProps) {
  return <ModuleSwitches modules={draft.modules} onChange={(modules) => change({ modules })} />
}
