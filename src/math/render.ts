import katex from 'katex'

// Resa di una formula con KaTeX, tutta locale: niente \href, \url o
// \includegraphics (trust: false), niente eccezioni (una formula sbagliata
// si vede come sorgente evidenziato). L'uscita ha la parte HTML, nascosta ai
// lettori di schermo, e il MathML, che i lettori di schermo leggono.

const cache = new Map<string, string>()
const CACHE_SIZE = 600
const HIDDEN = 'class="katex-html" aria-hidden="true"'

export function renderTex(tex: string, display: boolean): string {
  const id = `${display ? 'D' : 'I'}${tex}`
  const hit = cache.get(id)
  if (hit !== undefined) return hit
  let html = katex.renderToString(tex, {
    displayMode: display,
    output: 'htmlAndMathml',
    throwOnError: false,
    strict: 'ignore',
    trust: false,
    errorColor: 'var(--error-text)',
  })
  // KaTeX nasconde già la parte HTML; se una versione futura non lo facesse, lo fa qui.
  if (!html.includes(HIDDEN)) html = html.replace('class="katex-html"', HIDDEN)
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!)
  cache.set(id, html)
  return html
}
