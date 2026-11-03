/** Il nome di un file di mazzo: 'orbita-mazzo-<nome senza accenti e simboli>.<estensione>'. */
export function deckFileName(name: string, ext: 'json' | 'orbita'): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return `orbita-mazzo-${slug || 'senza-nome'}.${ext}`
}
