// Lettura del file scelto dall'utente: solo l'API File, niente rete.

import { AppError } from '../i18n/errors'

export const MAX_ICS_BYTES = 5 * 1024 * 1024

export async function readIcsFile(file: File): Promise<string> {
  if (file.size > MAX_ICS_BYTES) throw new AppError('icsTooLarge', { mb: MAX_ICS_BYTES / (1024 * 1024) })
  try {
    return await file.text()
  } catch {
    throw new AppError('icsReadFailed', { name: file.name })
  }
}
