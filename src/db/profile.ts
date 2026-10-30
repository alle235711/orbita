// Profilo dell'utente: tutto facoltativo tranne i numeri, che hanno un predefinito.

export interface Profile {
  name?: string
  university?: string
  degree?: string
  /** Crediti totali del corso di laurea, intero 1..600. */
  totalCfu: number
  /** Valore della lode, intero 30..40. */
  lodeValue: number
  /** Inizio dell'anno accademico, 'MM-DD'. */
  yearStart: string
  /** Laurea prevista: 'YYYY-MM-DD' o 'YYYY-MM'. */
  graduationTarget?: string
  /** ms: impostato quando il percorso guidato (o "Completa il profilo") finisce. */
  completedAt?: number
}

export const DEFAULT_PROFILE_FIELDS = { totalCfu: 180, lodeValue: 30, yearStart: '09-01' } as const

const MAX_TEXT = 120
const YEAR_START_RE = /^(\d{2})-(\d{2})$/
const TARGET_RE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/

const text = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, MAX_TEXT).trim()
  return s || undefined
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

function validYearStart(v: unknown): string {
  if (typeof v !== 'string') return DEFAULT_PROFILE_FIELDS.yearStart
  const m = YEAR_START_RE.exec(v)
  if (!m) return DEFAULT_PROFILE_FIELDS.yearStart
  const mo = Number(m[1])
  const d = Number(m[2])
  if (mo < 1 || mo > 12) return DEFAULT_PROFILE_FIELDS.yearStart
  // 2000 è bisestile: ammette il 29 febbraio.
  const last = new Date(Date.UTC(2000, mo, 0)).getUTCDate()
  return d >= 1 && d <= last ? v : DEFAULT_PROFILE_FIELDS.yearStart
}

/** null per i valori che non sono oggetti; limita o ripristina i numeri. Non lancia mai. */
export function normalizeProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const name = text(o.name)
  const university = text(o.university)
  const degree = text(o.degree)
  const graduationTarget = typeof o.graduationTarget === 'string' && TARGET_RE.test(o.graduationTarget) ? o.graduationTarget : undefined
  const completedAt = typeof o.completedAt === 'number' && Number.isFinite(o.completedAt) && o.completedAt > 0 ? o.completedAt : undefined
  return {
    ...(name ? { name } : {}),
    ...(university ? { university } : {}),
    ...(degree ? { degree } : {}),
    totalCfu: int(o.totalCfu, 1, 600, DEFAULT_PROFILE_FIELDS.totalCfu),
    lodeValue: int(o.lodeValue, 30, 40, DEFAULT_PROFILE_FIELDS.lodeValue),
    yearStart: validYearStart(o.yearStart),
    ...(graduationTarget ? { graduationTarget } : {}),
    ...(completedAt ? { completedAt } : {}),
  }
}
