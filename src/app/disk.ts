import { ENERGY, type Energy } from '../lib/energy'

/** Colora l'app col disco del giorno; la transizione è nei token. */
export function applyDisk(energy: Energy): void {
  document.documentElement.style.setProperty('--disk', ENERGY[energy].color)
}
