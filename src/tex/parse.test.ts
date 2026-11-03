import { describe, expect, it } from 'vitest'
import { TEX_CHAPTER, TEX_GOOD, TEX_MALFORMED } from '../test/tex-fixtures'
import { bodyToText, convertMath } from './body'
import { collectTheorems, DEFAULT_ENVIRONMENTS, parseEnvList, parseTex, parseTexFiles, type TexCard } from './parse'
import { bracesBalanced, escapedAt, lineIndex, readGroup, stripComments } from './scan'

const lineOf = (src: string, marker: string) => src.slice(0, src.indexOf(marker)).split('\n').length
const byTitle = (cards: TexCard[], title: string) => cards.find((c) => c.title === title)!

describe('scan', () => {
  it('toglie i commenti ma non \\%, e tiene gli a capo', () => {
    expect(stripComments('a % b\nc')).toBe('a \nc')
    expect(stripComments('100\\% ok % no')).toBe('100\\% ok ')
    // \\% è un a capo di TeX seguito da un commento
    expect(stripComments('x \\\\% y\nz')).toBe('x \\\\\nz')
    expect(stripComments('% solo commento')).toBe('')
    expect(stripComments('a\r\n% b\r\nc')).toBe('a\r\n\r\nc')
  })

  it('graffe bilanciate: \\{ e \\} non contano, una chiusa prima dell’aperta no', () => {
    expect(bracesBalanced('a {b {c}} d')).toBe(true)
    expect(bracesBalanced('\\{ solo escapata')).toBe(true)
    expect(bracesBalanced('{ aperta')).toBe(false)
    expect(bracesBalanced('chiusa } prima { aperta')).toBe(false)
    expect(bracesBalanced('fine \\')).toBe(true)
  })

  it('legge un gruppo con graffe e parentesi quadre annidate, e dice null se non si chiude', () => {
    expect(readGroup('{a {b} c}x', 0, '{')).toEqual({ value: 'a {b} c', next: 9 })
    expect(readGroup('[Titolo {con ] dentro} fine]', 0, '[')).toEqual({ value: 'Titolo {con ] dentro} fine', next: 28 })
    expect(readGroup('{mai chiusa', 0, '{')).toBeNull()
    expect(readGroup('[mai chiusa', 0, '[')).toBeNull()
    expect(readGroup('niente', 0, '{')).toBeNull()
  })

  it('numeri di riga e backslash escapati', () => {
    const at = lineIndex('a\nbb\n\nc')
    expect([at(0), at(2), at(5), at(6)]).toEqual([1, 2, 3, 4])
    expect(escapedAt('\\\\begin', 2)).toBe(false)
    expect(escapedAt('\\\\\\begin', 3)).toBe(true)
  })
})

describe('corpo della scheda', () => {
  it('porta le formule di LaTeX puro nei delimitatori dell’app', () => {
    expect(convertMath('a \\[ x^2 \\] b')).toBe('a $$x^2$$ b')
    expect(convertMath('se \\( x \\) allora')).toBe('se $x$ allora')
    expect(convertMath('\\begin{equation} E = mc^2 \\end{equation}')).toBe('$$E = mc^2$$')
    expect(convertMath('\\begin{align*} a &= 1 \\\\ b &= 2 \\end{align*}')).toBe('$$\\begin{aligned}a &= 1 \\\\ b &= 2\\end{aligned}$$')
    expect(convertMath('\\begin{gather} a \\\\ b \\end{gather}')).toBe('$$\\begin{gathered}a \\\\ b\\end{gathered}$$')
  })

  it('lascia stare le formule già tra $ e \\%, \\$ fuori da esse', () => {
    expect(convertMath('$\\[x\\]$ e $$y \\% z$$')).toBe('$\\[x\\]$ e $$y \\% z$$')
    expect(convertMath('il 5\\% costa 3\\$')).toBe('il 5% costa 3\\$')
    expect(convertMath('\\[ non chiusa')).toBe('\\[ non chiusa')
    expect(convertMath('a \\\\[2pt] b')).toBe('a \\\\[2pt] b')
  })

  it('toglie \\label e riduce gli spazi', () => {
    expect(bodyToText('  Testo \\label{a:b}\n\n  su   più righe \\label{c}  ')).toBe('Testo su più righe')
  })
})

describe('elenco di ambienti scritto a mano', () => {
  it('separa per virgola e spazio, senza doppioni', () => {
    expect(parseEnvList('esercizio, notazione;  esercizio\nproblema')).toEqual(['esercizio', 'notazione', 'problema'])
    expect(parseEnvList('  ')).toEqual([])
    expect(parseEnvList('\\begin{esercizio}')).toEqual(['esercizio'])
  })

  it('il predefinito ha i sette italiani e gli equivalenti inglesi', () => {
    for (const n of ['definizione', 'teorema', 'lemma', 'proposizione', 'corollario', 'osservazione', 'esempio']) expect(DEFAULT_ENVIRONMENTS).toContain(n)
    for (const n of ['definition', 'theorem', 'proposition', 'corollary', 'remark', 'example']) expect(DEFAULT_ENVIRONMENTS).toContain(n)
  })
})

describe('\\newtheorem', () => {
  const defs = collectTheorems([{ name: 'a.tex', text: TEX_GOOD }])

  it('nelle quattro forme, e non nei commenti', () => {
    expect(defs.get('thm')).toBe('Teorema')
    expect(defs.get('lem')).toBe('Lemma') // con [contatore]
    expect(defs.get('prop')).toBe('Proposizione') // con [dentro]
    expect(defs.get('oss')).toBe('Osservazione') // con asterisco
    expect(defs.get('cor')).toBe('Corollario') // su più righe
    expect(defs.has('fantasma')).toBe(false)
  })

  it('non confonde \\newtheoremstyle e chiede aiuto per una forma storta', () => {
    expect(collectTheorems([{ name: 'x.tex', text: '\\newtheoremstyle{a}{b}' }]).size).toBe(0)
    const r = parseTex('\\newtheorem{storto}\n\\begin{teorema} ok \\end{teorema}', 'x.tex')
    expect(r.errors.map((e) => [e.code, e.line])).toEqual([['texBadNewtheorem', 1]])
    expect(r.cards).toHaveLength(1)
  })
})

describe('file buono: tutti i casi limite', () => {
  const result = parseTex(TEX_GOOD, 'analisi.tex')
  const cards = result.cards

  it('nessun errore tranne l’ambiente sconosciuto', () => {
    expect(result.errors.map((e) => [e.code, e.params.env])).toEqual([['texUnknownEnv', 'exercise']])
    expect(result.errors[0]!.line).toBe(lineOf(TEX_GOOD, '\\begin{exercise}'))
  })

  it('trova gli ambienti noti nell’ordine del file, senza proof, align, itemize', () => {
    expect(cards.map((c) => c.title)).toEqual([
      'Limite di una successione',
      'Unicità del limite di Cauchy',
      'Esterno',
      'Esempio 2',
      'Esempio 3',
      'Lemma 1',
      'Teorema 4',
      'Proposizione 1',
      'Osservazione 1',
      'Titolo con [parentesi] e graffe',
      'Elenco di serie',
    ])
  })

  it('il commento sparisce, \\% resta un percento, \\label sparisce', () => {
    const def = byTitle(cards, 'Limite di una successione')
    expect(def.text).not.toContain('commento')
    expect(def.text).not.toContain('\\label')
    expect(def.text).toContain('Vale il 100% dei casi.')
    expect(def.text).toBe(
      'Una successione $a_n$ tende a $L$ se per ogni $\\varepsilon > 0$ esiste $N$ tale che $|a_n - L| < \\varepsilon$ per $n > N$. Vale il 100% dei casi.',
    )
  })

  it('un \\end dentro un commento non chiude nulla; \\[ \\] diventa $$ $$; l’esempio annidato resta nel teorema', () => {
    const thm = byTitle(cards, 'Unicità del limite di Cauchy')
    expect(thm.text).toContain('$$\\lim_{n\\to\\infty} a_n = L.$$')
    expect(thm.text).toContain('un esempio annidato \\begin{esempio} caso $x_{n}$ \\end{esempio}')
    expect(thm.text).not.toContain('dentro un commento')
    // l'esempio annidato non è una scheda a parte: ma conta nel progressivo
    expect(cards.filter((c) => c.kind === 'esempio').map((c) => c.number)).toEqual([2, 3])
  })

  it('ambienti annidati dello stesso nome: una scheda sola, con dentro quella interna', () => {
    const outer = byTitle(cards, 'Esterno')
    expect(outer.text).toBe('Ambiente annidato dello stesso nome: \\begin{thm}[Interno] testo interno \\end{thm} e il testo dopo, che appartiene ancora all\'esterno.')
    expect(cards.some((c) => c.title === 'Interno')).toBe(false)
  })

  it('titolo numerato: nome dell’ambiente più progressivo per ambiente, nell’ordine del file', () => {
    const untitled = cards.filter((c) => !c.titleGiven).map((c) => [c.env, c.number, c.title])
    expect(untitled).toEqual([
      ['esempio', 2, 'Esempio 2'],
      ['esempio', 3, 'Esempio 3'],
      ['lem', 1, 'Lemma 1'],
      ['thm', 4, 'Teorema 4'], // teoremi: 1 e 2 con titolo, 3 interno (non è una scheda a parte)
      ['prop', 1, 'Proposizione 1'],
      ['oss', 1, 'Osservazione 1'],
    ])
  })

  it('titolo opzionale con graffe e parentesi quadre dentro', () => {
    expect(byTitle(cards, 'Titolo con [parentesi] e graffe').titleGiven).toBe(true)
    expect(byTitle(cards, 'Titolo con [parentesi] e graffe').text).toBe('Il corollario $f$ è continua.')
  })

  it('il titolo finisce alla prima ] fuori dalle graffe, come in LaTeX', () => {
    const r = parseTex('\\begin{teorema}[Primo [secondo] terzo] testo \\end{teorema}', 'f.tex')
    expect(r.cards[0]).toMatchObject({ title: 'Primo [secondo', text: 'terzo] testo' })
  })

  it('graffe escapate e annidate nel corpo non rompono nulla', () => {
    const ex = cards.find((c) => c.title === 'Esempio 3')!
    expect(ex.text).toBe('Graffe escapate \\{ così \\} e annidate {a {b}} con $a_{n}$')
  })

  it('formule in display di tipo equation diventano $$', () => {
    expect(byTitle(cards, 'Proposizione 1').text).toBe("$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}$$")
  })

  it('sezione: la \\section o \\subsection più vicina sopra, anche con la stella', () => {
    expect(byTitle(cards, 'Limite di una successione').section).toBe('Limiti')
    expect(byTitle(cards, 'Esterno').section).toBe('Limiti')
    expect(byTitle(cards, 'Esempio 2').section).toBe('Un po\' di esempi') // \subsection*
    expect(byTitle(cards, 'Lemma 1').section).toBe('Un po\' di esempi')
    expect(byTitle(cards, 'Proposizione 1').section).toBe('Derivate') // \section*
    expect(byTitle(cards, 'Elenco di serie').section).toBe('Derivate')
  })

  it('tipo e riga', () => {
    expect(cards.map((c) => c.kind)).toEqual(['definizione', 'teorema', 'teorema', 'esempio', 'esempio', 'lemma', 'teorema', 'proposizione', 'osservazione', 'corollario', 'theorem'])
    expect(byTitle(cards, 'Lemma 1').line).toBe(lineOf(TEX_GOOD, '\\begin{lem}'))
  })

  it('senza sezione sopra, la sezione è il nome del file senza estensione', () => {
    expect(parseTex('\\begin{teorema} T \\end{teorema}', 'dispense.v2.tex').cards[0]!.section).toBe('dispense.v2')
  })

  it('elenco di ambienti scritto a mano: l’ambiente sconosciuto diventa una scheda', () => {
    const withList = parseTex(TEX_GOOD, 'analisi.tex', { environments: ['exercise'] })
    expect(withList.errors).toEqual([])
    const ex = withList.cards.find((c) => c.env === 'exercise')!
    expect(ex).toMatchObject({ title: 'Exercise 1', kind: 'exercise', section: 'Derivate' })
  })

  it('la chiave non c’è fra i campi (resta vuota nell’importazione)', () => {
    expect(Object.keys(cards[0]!)).not.toContain('key')
  })
})

describe('più file', () => {
  it('i \\newtheorem di un file valgono per gli altri, e i progressivi sono per file', () => {
    const [main, chapter] = parseTexFiles([
      { name: 'main.tex', text: TEX_GOOD },
      { name: 'cap2.tex', text: TEX_CHAPTER },
    ])
    expect(main!.fileName).toBe('main.tex')
    expect(chapter!.errors).toEqual([])
    expect(chapter!.cards.map((c) => [c.title, c.kind, c.number, c.section])).toEqual([
      ['Teorema 1', 'teorema', 1, 'Capitolo due'],
      ['Lemma', 'lemma', 1, 'Capitolo due'],
    ])
  })
})

describe('file malformato: un errore chiaro per blocco, il resto si importa', () => {
  const result = parseTex(TEX_MALFORMED, 'rotto.tex')

  it('i blocchi buoni passano', () => {
    expect(result.cards.map((c) => [c.title, c.text])).toEqual([
      ['Buono', 'Il primo blocco è buono.'],
      ['Buona', 'Anche questa passa.'],
    ])
  })

  it('ogni difetto ha il suo errore, con la riga giusta', () => {
    const got = result.errors.map((e) => [e.code, e.line])
    expect(got).toEqual(
      expect.arrayContaining([
        ['texBraces', lineOf(TEX_MALFORMED, '\\begin{corollario}')],
        ['texMismatch', lineOf(TEX_MALFORMED, '\\end{osservazione}\n')],
        ['texStrayEnd', lineOf(TEX_MALFORMED, '\\end{lemma}')],
        ['texUnknownEnv', lineOf(TEX_MALFORMED, '\\begin{xyz}')],
        ['texBadTitle', lineOf(TEX_MALFORMED, '\\begin{proposizione}')],
        ['texEmpty', lineOf(TEX_MALFORMED, '\\begin{osservazione}\n\\end')],
        ['texBadNewtheorem', lineOf(TEX_MALFORMED, '\\newtheorem{storto}')],
        ['texUnclosedEnv', lineOf(TEX_MALFORMED, '\\begin{lemma}')],
      ]),
    )
    expect(got).toHaveLength(8)
    expect(got.map(([, line]) => line)).toEqual([...got.map(([, line]) => line as number)].sort((a, b) => a - b))
  })

  it('i parametri dicono quale ambiente e dove', () => {
    const mismatch = result.errors.find((e) => e.code === 'texMismatch')!
    expect(mismatch.params).toMatchObject({ end: 'osservazione', begin: 'esempio', beginLine: lineOf(TEX_MALFORMED, '\\begin{esempio}') })
    expect(result.errors.every((e) => e.params.line === e.line && e.fileName === 'rotto.tex')).toBe(true)
  })
})

describe('un difetto alla volta', () => {
  const codes = (src: string) => parseTex(src, 'f.tex').errors.map((e) => e.code)
  const titles = (src: string) => parseTex(src, 'f.tex').cards.map((c) => c.title)

  it('\\end mancante: il blocco cade, quelli chiusi bene dentro e dopo si salvano', () => {
    const src = '\\begin{teorema}[Aperto] mai chiuso\n\\begin{lemma}[Dentro] ok \\end{lemma}\n\\begin{esempio}[Dopo] ok \\end{esempio}\n'
    expect(codes(src)).toEqual(['texUnclosedEnv'])
    expect(titles(src)).toEqual(['Dentro', 'Dopo'])
  })

  it('\\begin senza chiusura dentro un ambiente chiuso: l’ambiente che lo contiene non si importa', () => {
    const src = '\\begin{document}\\begin{teorema}[T] \\begin{itemize} \\item x \\end{teorema} \\begin{esempio}[E] ok \\end{esempio}\\end{document}'
    expect(codes(src)).toEqual(['texUnclosedEnv'])
    expect(titles(src)).toEqual(['E'])
  })

  it('\\end che non corrisponde: errore, e il blocco dopo si importa', () => {
    const src = '\\begin{teorema}[T] x \\end{lemma}\n\\begin{esempio}[E] y \\end{esempio}'
    expect(codes(src)).toEqual(['texMismatch'])
    expect(titles(src)).toEqual(['E'])
  })

  it('\\end senza \\begin', () => {
    expect(codes('\\end{teorema} \\begin{lemma}[L] y \\end{lemma}')).toEqual(['texStrayEnd'])
  })

  it('graffe non bilanciate: nel corpo e nel titolo', () => {
    expect(codes('\\begin{teorema}[T] \\textbf{x \\end{teorema}')).toEqual(['texBraces'])
    expect(codes('\\begin{teorema}[T {x] y \\end{teorema}')).toEqual(['texBadTitle'])
    expect(codes('\\begin{teorema} x } y \\end{teorema}')).toEqual(['texBraces'])
  })

  it('titolo che non si chiude e blocco vuoto', () => {
    expect(codes('\\begin{teorema}[T senza fine \\end{teorema}')).toEqual(['texBadTitle'])
    expect(codes('\\begin{teorema}  % solo un commento\n\\end{teorema}')).toEqual(['texEmpty'])
  })

  it('una \\section che non si legge viene saltata, la scheda prende quella di prima', () => {
    const src = '\\section{Buona}\\begin{teorema}[A] x \\end{teorema}\\section{Rotta\n\\begin{teorema}[B] y \\end{teorema}'
    const r = parseTex(src, 'f.tex')
    expect(r.errors.map((e) => e.code)).toEqual(['texBadHeading'])
    expect(r.cards.map((c) => [c.title, c.section])).toEqual([
      ['A', 'Buona'],
      ['B', 'Buona'],
    ])
  })

  it('un \\begin con la backslash escapata (\\\\begin) non apre nulla', () => {
    expect(codes('riga\\\\begin{teorema} testo')).toEqual([])
  })

  it('mai eccezioni, su ingressi qualunque', () => {
    const pieces = ['\\begin{teorema}', '\\end{teorema}', '\\begin{', '\\end{lemma}', '{', '}', '[', ']', '%', '\\', '\\\\', '$', '$$', '\\section{', '\\newtheorem{', 'testo ', '\n', '\\[', '\\]', '\\label{', '\\begin{align}', '\\end{align}']
    let seed = 12345
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
    for (let n = 0; n < 400; n++) {
      let src = ''
      for (let k = 0, len = next() % 40; k < len; k++) src += pieces[next() % pieces.length]
      const r = parseTex(src, 'caso.tex')
      expect(r.errors.every((e) => e.code !== 'texInternal'), src).toBe(true)
      for (const c of r.cards) expect(c.text, src).not.toBe('')
    }
    expect(parseTex('', 'vuoto.tex')).toEqual({ fileName: 'vuoto.tex', cards: [], errors: [] })
  })
})
