// Legge la mappa dei livelli del layout italiano dai file xkb di sistema
// (variante "basic", quella di Ubuntu) e la salva in src/test/xkb-it-basic.json.
// Il test di src/review/layout-it.test.ts confronta la tabella dei dati
// (src/review/layout-it.ts) con questo file, carattere per carattere.
//
//   node scripts/xkb-it.mjs
//
// Serve xkbcomp e setxkbmap (pacchetti x11-xkb-utils e xkb-data); non tocca la rete.

import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = mkdtempSync(join(tmpdir(), 'xkb-it-'))
const compiled = join(dir, 'it.xkb')

execSync(`setxkbmap -print -layout it | xkbcomp -xkb - ${compiled}`, { stdio: ['ignore', 'ignore', 'ignore'], shell: '/bin/bash' })
const text = readFileSync(compiled, 'utf8')

/** I tasti con lettere, cifre e punteggiatura: da TLDE alla fila di sotto, più il tasto ISO accanto a Z. */
const codes = [
  'TLDE',
  ...Array.from({ length: 12 }, (_, i) => `AE${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `AD${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 11 }, (_, i) => `AC${String(i + 1).padStart(2, '0')}`),
  'BKSL',
  ...Array.from({ length: 10 }, (_, i) => `AB${String(i + 1).padStart(2, '0')}`),
  'LSGT',
]

const keys = {}
for (const code of codes) {
  const m = new RegExp(`key <${code}> \\{\\s*type= "[A-Z_]+",\\s*symbols\\[Group1\\]= \\[([^\\]]*)\\]`).exec(text)
  if (!m) throw new Error(`Tasto ${code} non trovato nella mappa compilata`)
  keys[code] = m[1].split(',').map((s) => s.trim())
}

let version = 'sconosciuta'
try {
  version = execSync("dpkg-query -W -f='${Version}' xkb-data", { encoding: 'utf8', shell: '/bin/bash' }).trim()
} catch {
  // non è Debian/Ubuntu: la versione resta sconosciuta
}
const out = {
  fonte: `xkb-data ${version}: setxkbmap -print -layout it | xkbcomp (variante basic, livelli 1 base, 2 Maiusc, 3 Alt Gr, 4 Alt Gr+Maiusc)`,
  tasti: keys,
}
writeFileSync(join(root, 'src/test/xkb-it-basic.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`${codes.length} tasti scritti in src/test/xkb-it-basic.json`)
