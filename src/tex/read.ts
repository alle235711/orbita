// Lettura del file scelto dall'utente: solo l'API File, niente rete.

import { AppError } from '../i18n/errors'

export const MAX_TEX_BYTES = 5 * 1024 * 1024

export async function readTexFile(file: File): Promise<string> {
  if (file.size > MAX_TEX_BYTES) throw new AppError('texTooLarge', { mb: MAX_TEX_BYTES / (1024 * 1024) })
  try {
    return await file.text()
  } catch {
    throw new AppError('texReadFailed', { name: file.name })
  }
}
