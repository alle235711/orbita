// Il fuso del dispositivo: gli orari del file si mostrano nell'ora di chi li guarda.
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
