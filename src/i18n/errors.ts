import type { Dict } from './dict'
import type { Format } from './format/types'
import type { I18n } from './index'

export type ErrorCode = Exclude<keyof Dict['errors'], 'generic'>

/** Errore con un codice: il testo si ricava al momento di mostrarlo, nella lingua di allora. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code)
  }
}

export function renderError(e: unknown, i18n: Pick<I18n, 't' | 'f'>): string {
  const errors = i18n.t.errors as unknown as Record<string, (p: unknown, f: Format) => string>
  if (e instanceof AppError) return errors[e.code]!(e.params, i18n.f)
  return errors.generic!({}, i18n.f)
}
