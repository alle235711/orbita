// Righe di un file .ics (RFC 5545 §3.1): puro, nessuna rete.

export interface ContentLine {
  /** Maiuscolo. */
  name: string
  /** Chiavi maiuscole; valori separati sulle virgole fuori dalle virgolette, senza virgolette. */
  params: Record<string, string[]>
  value: string
}

/** Toglie il BOM, divide su CRLF/LF/CR e riunisce le righe piegate (una riga che inizia con spazio o tab continua la precedente). */
export function unfoldLines(text: string): string[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const out: string[] = []
  for (const phys of src.split(/\r\n|\n|\r/)) {
    if ((phys.startsWith(' ') || phys.startsWith('\t')) && out.length) out[out.length - 1] += phys.slice(1)
    else out.push(phys)
  }
  return out.filter((l) => l !== '')
}

/** Divide `s` su `sep` ignorando quello che sta tra virgolette. */
function splitOutsideQuotes(s: string, sep: string): string[] {
  const parts: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of s) {
    if (ch === '"') quoted = !quoted
    if (ch === sep && !quoted) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts
}

export function parseContentLine(line: string): ContentLine | null {
  let quoted = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') quoted = !quoted
    else if (ch === ':' && !quoted) {
      colon = i
      break
    }
  }
  if (colon < 0) return null
  const head = splitOutsideQuotes(line.slice(0, colon), ';')
  const name = head[0]!.trim().toUpperCase()
  if (!name) return null
  const params: Record<string, string[]> = {}
  for (const raw of head.slice(1)) {
    const eq = raw.indexOf('=')
    if (eq < 0) continue
    const key = raw.slice(0, eq).trim().toUpperCase()
    params[key] = splitOutsideQuotes(raw.slice(eq + 1), ',').map((v) => v.replace(/^"|"$/g, ''))
  }
  return { name, params, value: line.slice(colon + 1) }
}

export function unescapeText(s: string): string {
  return s.replace(/\\([\s\S])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
}

/** SUMMARY e LOCATION: titoli su una riga sola. */
export function unescapeLine(s: string): string {
  return unescapeText(s)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}
