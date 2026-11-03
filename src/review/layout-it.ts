// Tabella dei livelli della tastiera italiana, in dati puri da modificare a
// mano se serve (SPEC fase 3, fetta H).
//
// FONTE: xkb, layout `it`, variante "basic", cioè il layout italiano di
// Ubuntu: /usr/share/X11/xkb/symbols/it con gli include `latin(type4)` e
// `level3(ralt_switch)`, compilato con
//   setxkbmap -print -layout it | xkbcomp
// (lo fa `node scripts/xkb-it.mjs`, che salva il risultato in
// src/test/xkb-it-basic.json: il test layout-it.test.ts confronta questa
// tabella con quel file, carattere per carattere).
//
// I quattro livelli di ogni tasto fisico:
//   1 base · 2 Maiusc · 3 Alt Gr · 4 Alt Gr + Maiusc
// Una stringa vuota è un livello senza carattere o con un tasto morto
// (accenti da comporre), che qui non si usano.
//
// `code` è il nome xkb del tasto fisico; `key` è l'id del tasto nel disegno
// (ROWS in keyboard.ts): da lì vengono dito e mano, così la mappa delle dita
// resta una sola, quella del mockup.
//
// ATTENZIONE: vale per Linux (Ubuntu). Su tastiere italiane Apple (Mac e
// iPad con tastiera fisica) i livelli sono diversi. La variante xkb `it(mac)`
// ha `{` su Alt+4 e `[` su Alt+Maiusc+4 (tasto AE04), `}` su Alt+7 e `]` su
// Alt+Maiusc+7 (AE07), `|` su Alt+AB09 e `\` su Alt+Maiusc+AB09, `@` e `#`
// sul tasto TLDE senza Alt, `~` solo come tasto morto (Alt+N). Non è
// implementata: va verificata sulla tastiera vera prima di scriverla qui.

export type Level = 1 | 2 | 3 | 4

export interface LayoutKey {
  code: string
  key: string
  levels: readonly [string, string, string, string]
}

export const LAYOUT_IT: readonly LayoutKey[] = [
  { code: 'TLDE', key: '\\', levels: ['\\', '|', '¬', '¦'] },
  { code: 'AE01', key: '1', levels: ['1', '!', '¹', '¡'] },
  { code: 'AE02', key: '2', levels: ['2', '"', '²', ''] },
  { code: 'AE03', key: '3', levels: ['3', '£', '³', ''] },
  { code: 'AE04', key: '4', levels: ['4', '$', '¼', '⅛'] },
  { code: 'AE05', key: '5', levels: ['5', '%', '½', '⅜'] },
  { code: 'AE06', key: '6', levels: ['6', '&', '¬', '⅝'] },
  { code: 'AE07', key: '7', levels: ['7', '/', '{', '⅞'] },
  { code: 'AE08', key: '8', levels: ['8', '(', '[', '™'] },
  { code: 'AE09', key: '9', levels: ['9', ')', ']', '±'] },
  { code: 'AE10', key: '0', levels: ['0', '=', '}', ''] },
  { code: 'AE11', key: "'", levels: ["'", '?', '`', '¿'] },
  { code: 'AE12', key: 'ì', levels: ['ì', '^', '~', ''] },
  { code: 'AD01', key: 'q', levels: ['q', 'Q', '@', 'Ω'] },
  { code: 'AD02', key: 'w', levels: ['w', 'W', 'ſ', '§'] },
  { code: 'AD03', key: 'e', levels: ['e', 'E', '€', '¢'] },
  { code: 'AD04', key: 'r', levels: ['r', 'R', '¶', '®'] },
  { code: 'AD05', key: 't', levels: ['t', 'T', 'ŧ', 'Ŧ'] },
  { code: 'AD06', key: 'y', levels: ['y', 'Y', '←', '¥'] },
  { code: 'AD07', key: 'u', levels: ['u', 'U', '↓', '↑'] },
  { code: 'AD08', key: 'i', levels: ['i', 'I', '→', 'ı'] },
  { code: 'AD09', key: 'o', levels: ['o', 'O', 'ø', 'Ø'] },
  { code: 'AD10', key: 'p', levels: ['p', 'P', 'þ', 'Þ'] },
  { code: 'AD11', key: 'è', levels: ['è', 'é', '[', '{'] },
  { code: 'AD12', key: '+', levels: ['+', '*', ']', '}'] },
  { code: 'AC01', key: 'a', levels: ['a', 'A', 'æ', 'Æ'] },
  { code: 'AC02', key: 's', levels: ['s', 'S', 'ß', 'ẞ'] },
  { code: 'AC03', key: 'd', levels: ['d', 'D', 'ð', 'Ð'] },
  { code: 'AC04', key: 'f', levels: ['f', 'F', 'đ', 'ª'] },
  { code: 'AC05', key: 'g', levels: ['g', 'G', 'ŋ', 'Ŋ'] },
  { code: 'AC06', key: 'h', levels: ['h', 'H', 'ħ', 'Ħ'] },
  { code: 'AC07', key: 'j', levels: ['j', 'J', '', ''] },
  { code: 'AC08', key: 'k', levels: ['k', 'K', 'ĸ', '&'] },
  { code: 'AC09', key: 'l', levels: ['l', 'L', 'ł', 'Ł'] },
  { code: 'AC10', key: 'ò', levels: ['ò', 'ç', '@', ''] },
  { code: 'AC11', key: 'à', levels: ['à', '°', '#', ''] },
  { code: 'BKSL', key: 'ù', levels: ['ù', '§', '', ''] },
  { code: 'AB01', key: 'z', levels: ['z', 'Z', '«', '<'] },
  { code: 'AB02', key: 'x', levels: ['x', 'X', '»', '>'] },
  { code: 'AB03', key: 'c', levels: ['c', 'C', '¢', '©'] },
  { code: 'AB04', key: 'v', levels: ['v', 'V', '“', '‘'] },
  { code: 'AB05', key: 'b', levels: ['b', 'B', '”', '’'] },
  { code: 'AB06', key: 'n', levels: ['n', 'N', 'ñ', 'Ñ'] },
  { code: 'AB07', key: 'm', levels: ['m', 'M', 'µ', 'º'] },
  { code: 'AB08', key: ',', levels: [',', ';', '', '×'] },
  { code: 'AB09', key: '.', levels: ['.', ':', '·', ''] },
  { code: 'AB10', key: '-', levels: ['-', '_', '', '÷'] },
  { code: 'LSGT', key: '<', levels: ['<', '>', '«', '»'] },
]

/**
 * Alcuni caratteri stanno in più posti (xkb offre `{` anche su Alt Gr+7, `}`
 * su Alt Gr+0, `@` anche su Alt Gr+Q): qui si sceglie quello da suggerire,
 * "codice:livello". Per gli altri vince il livello più basso, a parità
 * l'ordine della tabella.
 *
 * `[ ] { }` stanno sulle stessi due tasti di `è` e `+`, come sulla tastiera
 * italiana di Windows e come dice il piano della fetta H; `@` su `ò`.
 */
export const PREFERRED: Readonly<Record<string, string>> = {
  '[': 'AD11:3',
  ']': 'AD12:3',
  '{': 'AD11:4',
  '}': 'AD12:4',
  '@': 'AC10:3',
}

export interface Position {
  code: string
  /** L'id del tasto nel disegno. */
  key: string
  level: Level
}

/** Tutti i posti dove la tastiera produce il carattere, in ordine di tabella. */
export function positionsOf(char: string): Position[] {
  const out: Position[] = []
  for (const entry of LAYOUT_IT) {
    entry.levels.forEach((c, i) => {
      if (c === char) out.push({ code: entry.code, key: entry.key, level: (i + 1) as Level })
    })
  }
  return out
}

/** Il posto da suggerire per un carattere, o null se la tastiera non lo produce. */
export function positionFor(char: string): Position | null {
  const all = positionsOf(char)
  if (!all.length) return null
  const wanted = PREFERRED[char]
  if (wanted) {
    const hit = all.find((p) => `${p.code}:${p.level}` === wanted)
    if (hit) return hit
  }
  return all.reduce((best, p) => (p.level < best.level ? p : best))
}
