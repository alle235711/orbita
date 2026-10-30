export const pad = (n: number): string => String(n).padStart(2, '0')

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
