// Dizionario del convertitore assistito: solo dati, nessuna logica. Ogni voce
// si riconosce come parola intera (mai dentro un'altra parola: "eta" non si
// tocca in "pianeta"), con le maiuscole così come sono scritte.

/**
 * Lettere greche. Quelle `ambiguous` sono anche parole italiane o nomi
 * comuni nel testo ("chi", "delta di Dirac", "raggi gamma", "pi greco",
 * "la zeta", "neanche uno iota", "Delta" a inizio frase): diventano simboli
 * solo in un contesto di formula, cioè con un pedice o un apice attaccato
 * oppure accanto a un altro pezzo di formula (numero, lettera, operatore,
 * simbolo). Le altre si convertono anche da sole nel testo.
 */
export const GREEK: Readonly<Record<string, { tex: string; ambiguous?: true }>> = {
  alpha: { tex: '\\alpha' },
  beta: { tex: '\\beta' },
  gamma: { tex: '\\gamma', ambiguous: true },
  delta: { tex: '\\delta', ambiguous: true },
  epsilon: { tex: '\\epsilon' },
  eps: { tex: '\\varepsilon' },
  zeta: { tex: '\\zeta', ambiguous: true },
  eta: { tex: '\\eta', ambiguous: true },
  theta: { tex: '\\theta' },
  iota: { tex: '\\iota', ambiguous: true },
  kappa: { tex: '\\kappa' },
  lambda: { tex: '\\lambda' },
  mu: { tex: '\\mu', ambiguous: true },
  nu: { tex: '\\nu', ambiguous: true },
  xi: { tex: '\\xi', ambiguous: true },
  pi: { tex: '\\pi', ambiguous: true },
  rho: { tex: '\\rho' },
  sigma: { tex: '\\sigma' },
  tau: { tex: '\\tau' },
  upsilon: { tex: '\\upsilon' },
  phi: { tex: '\\phi' },
  chi: { tex: '\\chi', ambiguous: true },
  psi: { tex: '\\psi' },
  omega: { tex: '\\omega' },
  Gamma: { tex: '\\Gamma', ambiguous: true },
  Delta: { tex: '\\Delta', ambiguous: true },
  Theta: { tex: '\\Theta' },
  Lambda: { tex: '\\Lambda' },
  Xi: { tex: '\\Xi', ambiguous: true },
  Pi: { tex: '\\Pi', ambiguous: true },
  Sigma: { tex: '\\Sigma' },
  Upsilon: { tex: '\\Upsilon' },
  Phi: { tex: '\\Phi' },
  Psi: { tex: '\\Psi' },
  Omega: { tex: '\\Omega' },
  nabla: { tex: '\\nabla' },
}

/** Funzioni con il loro comando: dentro una formula si scrivono dritte. `sqrt(...)` diventa `\sqrt{...}`. */
export const FUNCTIONS: Readonly<Record<string, string>> = {
  exp: '\\exp',
  log: '\\log',
  ln: '\\ln',
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  sinh: '\\sinh',
  cosh: '\\cosh',
  tanh: '\\tanh',
  det: '\\det',
  ker: '\\ker',
  dim: '\\dim',
  deg: '\\deg',
  sqrt: '\\sqrt',
}

/** Nomi di operatori senza un comando proprio: si scrivono con \operatorname. */
export const OPERATOR_NAMES: readonly string[] = ['Hom', 'Tor', 'Ext', 'mcd', 'coker', 'im', 'Im', 'rk']

/** Unità di misura: dentro una formula si scrivono dritte, staccate dal numero. */
export const UNITS: readonly string[] = [
  'eV', 'meV', 'keV', 'MeV', 'GeV', 'nm', 'pm', 'fm', 'mm', 'cm', 'km', 'Hz', 'kHz', 'MHz', 'GHz', 'ns', 'ms', 'kg', 'J/T', 'eV/T', 'km/s', 'm/s',
]

/** Segni scritti con caratteri ASCII. Valgono come simbolo intero o dentro un pezzo di formula. */
export const ASCII_OPERATORS: Readonly<Record<string, string>> = {
  '<->': '\\leftrightarrow',
  '<=>': '\\iff',
  '->': '\\to',
  '<-': '\\leftarrow',
  '=>': '\\Rightarrow',
  '<=': '\\le',
  '>=': '\\ge',
  '!=': '\\neq',
  '+/-': '\\pm',
  '+-': '\\pm',
  '...': '\\ldots',
}

/**
 * Espressioni di più parole (o parole che sono anche italiane). `symbol` è un
 * simbolo, che vale sempre; `binary` è un operatore tra due termini e si
 * converte solo se a sinistra e a destra c'è un pezzo di formula ("A somma
 * diretta B" sì, "la somma diretta degli spazi" no). Se la condizione non
 * vale, l'espressione resta testo; una parola sola come "x" torna al suo tipo.
 */
export interface Phrase {
  words: readonly string[]
  tex: string
  kind: 'symbol' | 'binary'
}

export const PHRASES: readonly Phrase[] = [
  { words: ['h', 'tagliato'], tex: '\\hbar', kind: 'symbol' },
  { words: ['somma', 'diretta'], tex: '\\oplus', kind: 'binary' },
  { words: ['è', 'isomorfo', 'a'], tex: '\\cong', kind: 'binary' },
  { words: ['è', 'isomorfo', 'ad'], tex: '\\cong', kind: 'binary' },
  { words: ['è', 'isomorfa', 'a'], tex: '\\cong', kind: 'binary' },
  { words: ['è', 'isomorfa', 'ad'], tex: '\\cong', kind: 'binary' },
  { words: ['isomorfo', 'a'], tex: '\\cong', kind: 'binary' },
  { words: ['isomorfo', 'ad'], tex: '\\cong', kind: 'binary' },
  { words: ['isomorfa', 'a'], tex: '\\cong', kind: 'binary' },
  { words: ['isomorfa', 'ad'], tex: '\\cong', kind: 'binary' },
  { words: ['è', 'proporzionale', 'a'], tex: '\\propto', kind: 'binary' },
  { words: ['proporzionale', 'a'], tex: '\\propto', kind: 'binary' },
  { words: ['è', 'circa'], tex: '\\approx', kind: 'binary' },
  { words: ['circa', 'uguale', 'a'], tex: '\\approx', kind: 'binary' },
  { words: ['tensor'], tex: '\\otimes', kind: 'binary' },
  { words: ['intersecato'], tex: '\\cap', kind: 'binary' },
  { words: ['cup'], tex: '\\smile', kind: 'binary' },
  { words: ['cap'], tex: '\\frown', kind: 'binary' },
  { words: ['x'], tex: '\\times', kind: 'binary' },
]
