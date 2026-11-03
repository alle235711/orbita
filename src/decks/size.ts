import type { Format } from '../i18n/format/types'

/** 'byte' sotto i mille, altrimenti KB (1 KB = 1000 byte) con un decimale: lo stesso testo in ogni lingua. */
export function formatSize(bytes: number, f: Pick<Format, 'number'>): string {
  return bytes < 1000 ? `${f.number(bytes)} byte` : `${f.number(bytes / 1000, 1)} KB`
}
