import katex from 'katex'
import { describe, expect, it } from 'vitest'
import content from '../../content/schede-2026-27.json'
import { convertCard, convertText, fragmentTex, relocateKey } from './convert'
import { splitMath } from './delimiters'
import { GREEK, PHRASES } from './dictionary'

describe('convertText: pedici, apici e gruppi', () => {
  it('raccoglie in $...$ i tratti con _ e ^', () => {
    expect(convertText('il livello E_n e la carica Z^2')).toBe('il livello $E_n$ e la carica $Z^2$')
  })

  it('gli argomenti lunghi o tra parentesi diventano gruppi', () => {
    expect(convertText('va come T^(-7/2) nel nucleo')).toBe('va come $T^{-7/2}$ nel nucleo')
    expect(convertText('vale m^-1 e 10^-24')).toBe('vale $m^{-1}$ e $10^{-24}$')
    expect(convertText('la funzione psi_nlm')).toBe('la funzione $\\psi_{nlm}$')
    expect(convertText('le righe 3p_3/2')).toBe('le righe $3p_{3/2}$')
    expect(convertText('il gruppo H_(n-1)(X)')).toBe('il gruppo $H_{n-1}(X)$')
    expect(convertText('un politropo P = K rho^(1 + 1/n) qui')).toBe('un politropo $P = K \\rho^{1 + 1/n}$ qui')
  })

  it('le greche dentro un pedice o come base', () => {
    expect(convertText('il minimo lambda_min')).toBe('il minimo $\\lambda_{min}$')
    expect(convertText('il flusso F_nu')).toBe('il flusso $F_{\\nu}$')
  })

  it('una sequenza con almeno un pezzo forte diventa una formula sola, con operatori e numeri', () => {
    expect(convertText('Il raggio è a_0 = 4 pi eps_0 (h tagliato)^2 / (m_e e^2), circa 0,529 angstrom.')).toBe(
      'Il raggio è $a_0 = 4 \\pi \\varepsilon_0 \\hbar^2 / (m_e e^2)$, circa 0,529 angstrom.',
    )
  })

  it('senza un pezzo forte non nasce nessuna formula', () => {
    expect(convertText('con n = 1, 2, 3 e J = 1')).toBe('con n = 1, 2, 3 e J = 1')
    expect(convertText('a 656,3 nm nel rosso')).toBe('a 656,3 nm nel rosso')
  })

  it('la punteggiatura resta fuori, tranne dentro una parentesi aperta', () => {
    expect(convertText('vale E_n, poi')).toBe('vale $E_n$, poi')
    expect(convertText('si separa come psi_nlm(r, theta, phi) = R_nl(r): bene')).toBe('si separa come $\\psi_{nlm}(r, \\theta, \\phi) = R_{nl}(r)$: bene')
  })

  it('una parentesi spaiata resta fuori dalla formula', () => {
    expect(convertText('(cioè E_n)')).toBe('(cioè $E_n$)')
    expect(convertText('somma di (-1)^i (v_0 x)')).toBe('somma di $(-1)^i (v_0 x)$')
  })

  it('decimali con la virgola, unità di misura e sqrt', () => {
    expect(convertText('vale E_n = -Z^2 13,6 eV / n^2 qui')).toBe('vale $E_n = -Z^2 13{,}6\\,\\mathrm{eV} / n^2$ qui')
    expect(convertText('lo stato psi_100 = exp(-r/a_0) / sqrt(pi a_0^3); poi')).toBe('lo stato $\\psi_{100} = \\exp(-r/a_0) / \\sqrt{\\pi a_0^3}$; poi')
  })
})

describe('convertText: dizionario', () => {
  it('-> è una freccia, sempre', () => {
    expect(convertText('la successione 0 -> A -> B -> C -> 0 spezza')).toBe('la successione $0 \\to A \\to B \\to C \\to 0$ spezza')
    expect(convertText('la transizione 3 -> 2 di Balmer')).toBe('la transizione $3 \\to 2$ di Balmer')
    expect(convertText('sotto inversione r -> -r le')).toBe('sotto inversione $r \\to -r$ le')
  })

  it('h tagliato, con o senza parentesi', () => {
    expect(convertText('vale m h tagliato.')).toBe('vale $m \\hbar$.')
    expect(convertText('autovalore (h tagliato)^2 qui')).toBe('autovalore $\\hbar^2$ qui')
    expect(convertText('(1 / i h tagliato) per')).toBe('$(1 / i \\hbar)$ per')
  })

  it('somma diretta, isomorfo a, tensor e intersecato solo tra due pezzi di formula', () => {
    expect(convertText('spezza se B è isomorfo ad A somma diretta C in modo')).toBe('spezza se $B \\cong A \\oplus C$ in modo')
    expect(convertText('pi_n(S^n) è isomorfo a Z per ogni n')).toBe('$\\pi_n(S^n) \\cong Z$ per ogni n')
    expect(convertText('H_n(A intersecato B) -> H_n(A) somma diretta H_n(B)')).toBe('$H_n(A \\cap B) \\to H_n(A) \\oplus H_n(B)$')
    expect(convertText('Z/m tensor Z/n vale')).toBe('$Z/m \\otimes Z/n$ vale')
    // nel testo restano parole
    expect(convertText('allora H_n(X) è la somma diretta degli H_n(X_a).')).toBe('allora $H_n(X)$ è la somma diretta degli $H_n(X_a)$.')
    expect(convertText('per uno spazio connesso è isomorfo a Z.')).toBe('per uno spazio connesso è isomorfo a Z.')
  })

  it('proporzionale a diventa \\propto solo dentro una formula', () => {
    expect(convertText('allora g(E) proporzionale a sqrt(E).')).toBe('allora $g(E) \\propto \\sqrt{E}$.')
    expect(convertText('un potenziale proporzionale a 1/r gli')).toBe('un potenziale proporzionale a 1/r gli')
  })

  it('x è un prodotto tra due pezzi di formula', () => {
    expect(convertText('circa 1,097 x 10^7 m^-1;')).toBe('circa $1{,}097 \\times 10^7 m^{-1}$;')
    expect(convertText('ha H_1 isomorfo a Z x Z/2 e')).toBe('ha $H_1 \\cong Z \\times Z/2$ e')
  })

  it('è circa diventa \\approx tra due formule', () => {
    expect(convertText('assorbimento se omega è circa omega_fi, emissione')).toBe('assorbimento se $\\omega \\approx \\omega_{fi}$, emissione')
  })
})

describe('convertText: parole italiane e greche ambigue', () => {
  it('solo parole intere: eta, nu, mu, pi, chi dentro una parola non si toccano', () => {
    const prose = 'Il pianeta ruota, la tribù chiede pietà, il menù è chiuso, la zeta finale, nulla di speciale.'
    expect(convertText(prose)).toBe(prose)
  })

  it('le greche ambigue restano parole nel testo', () => {
    for (const s of ['chi studia impara', 'i raggi gamma e X', 'la funzione delta di Dirac', 'il pi greco', 'una eta qualunque', 'Delta del Po', 'il nu metallo', 'non cambia di uno iota']) {
      expect(convertText(s), s).toBe(s)
    }
  })

  it('le greche ambigue diventano simboli con un pedice o accanto a una formula', () => {
    expect(convertText('vale eta_0 = 3 qui')).toBe('vale $\\eta_0 = 3$ qui')
    expect(convertText('il test chi^2 di Pearson')).toBe('il test $\\chi^2$ di Pearson')
    expect(convertText('la massa ridotta mu = m_e M qui')).toBe('la massa ridotta $\\mu = m_e M$ qui')
    expect(convertText('vale 8 pi h nu^3 / c^3 e')).toBe('vale $8 \\pi h \\nu^3 / c^3$ e')
    expect(convertText('le regole Delta l = +1 o -1')).toBe('le regole $\\Delta l = +1$ o -1')
  })

  it('le greche non ambigue diventano simboli anche da sole', () => {
    expect(convertText('a frequenza omega induce')).toBe('a frequenza $\\omega$ induce')
    expect(convertText('vale circa alpha c.')).toBe('vale circa $\\alpha c$.')
  })

  it('e, a, i, o sono parole, tranne accanto a un operatore', () => {
    expect(convertText('valgono <T> = -E_n e <V> = 2 E_n:')).toBe('valgono $<T> = -E_n$ e $<V> = 2 E_n$:')
    expect(convertText('il magnetone mu_B = e h tagliato / (2 m_e), circa')).toBe('il magnetone $\\mu_B = e \\hbar / (2 m_e)$, circa')
  })

  it('parole con apostrofo o accento restano testo', () => {
    expect(convertText("dell'atomo l'energia è E_n")).toBe("dell'atomo l'energia è $E_n$")
  })
})

describe('convertText: casi limite', () => {
  it('un testo che ha già formule torna com’è', () => {
    const latex = 'Già fatta: $E_n = -13{,}6/n^2$ con lambda_min'
    expect(convertText(latex)).toBe(latex)
  })

  it('un dollaro nel testo diventa \\$, così non apre una formula', () => {
    expect(convertText('costa 5$ e vale E_n')).toBe('costa 5\\$ e vale $E_n$')
  })

  it('testo vuoto, spazi e a capo restano', () => {
    expect(convertText('')).toBe('')
    expect(convertText('  E_n  \n')).toBe('  $E_n$  \n')
    expect(convertText('E_n\nZ^2')).toBe('$E_n$\n$Z^2$')
  })

  it('è deterministico e idempotente', () => {
    const s = 'Il raggio è a_0 = 4 pi eps_0 (h tagliato)^2 / (m_e e^2), circa 0,529 angstrom.'
    expect(convertText(s)).toBe(convertText(s))
    expect(convertText(convertText(s))).toBe(convertText(s))
  })
})

describe('dizionario', () => {
  it('ogni lettera greca ha un comando LaTeX valido per KaTeX', () => {
    for (const [word, { tex }] of Object.entries(GREEK)) {
      expect(tex, word).toMatch(/^\\[A-Za-z]+$/)
      expect(() => katex.renderToString(tex, { throwOnError: true }), word).not.toThrow()
    }
  })

  it('le greche che sono anche parole italiane o nomi comuni sono marcate ambigue', () => {
    for (const word of ['eta', 'nu', 'mu', 'pi', 'chi', 'xi', 'zeta', 'iota', 'gamma', 'delta', 'Delta', 'Gamma']) expect(GREEK[word]?.ambiguous, word).toBe(true)
    for (const word of ['lambda', 'rho', 'kappa', 'beta', 'omega']) expect(GREEK[word]?.ambiguous, word).toBeUndefined()
  })

  it('ogni espressione del dizionario rende in KaTeX', () => {
    for (const p of PHRASES) expect(() => katex.renderToString(p.tex, { throwOnError: true }), p.words.join(' ')).not.toThrow()
  })
})

describe('convertCard', () => {
  it('propone testo e chiave senza applicarli', () => {
    const card = { text: 'degenerazione 2n^2 contando lo spin', key: '2n^2' }
    const before = structuredClone(card)
    expect(convertCard(card)).toEqual({ text: 'degenerazione $2n^2$ contando lo spin', key: '2n^2', changed: true, alreadyLatex: false, keyLost: false })
    expect(card).toEqual(before)
  })

  it('ritrova la chiave nella sua forma LaTeX', () => {
    const c = convertCard({ text: 'la lunghezza minima lambda_min = hc / eV', key: 'lambda_min' })
    expect(c.key).toBe('\\lambda_{min}')
    expect(c.text.includes(c.key)).toBe(true)
    expect(relocateKey('vale $54{,}4\\,\\mathrm{eV}$', '54,4 eV')).toEqual({ key: '54{,}4\\,\\mathrm{eV}', lost: false })
    expect(fragmentTex('Z x Z/2')).toBe('Z \\times Z/2')
  })

  it('segnala la chiave che non si ritrova', () => {
    const c = convertCard({ text: 'Delta l = +1 o -1 sempre', key: 'Delta l = +1 o -1' })
    expect(c.keyLost).toBe(true)
    expect(c.key).toBe('Delta l = +1 o -1')
  })

  it('schede già in LaTeX o senza formule: nessuna proposta', () => {
    expect(convertCard({ text: 'Già $E_n$', key: '' })).toMatchObject({ changed: false, alreadyLatex: true })
    expect(convertCard({ text: 'Solo parole.', key: 'parole' })).toMatchObject({ changed: false, alreadyLatex: false, keyLost: false })
  })
})

describe('le schede incluse', () => {
  const cards = content.schede

  it('ogni proposta si rende in KaTeX senza errori, anche in modo rigoroso', () => {
    const errors: string[] = []
    for (const s of cards) {
      for (const seg of splitMath(convertCard({ text: s.testo, key: s.chiave }).text)) {
        if (seg.type === 'text') continue
        try {
          katex.renderToString(seg.value, { throwOnError: true, strict: 'error', displayMode: seg.type === 'display' })
        } catch (e) {
          errors.push(`${s.id}: ${seg.value}: ${(e as Error).message}`)
        }
      }
    }
    expect(errors).toEqual([])
  })

  it('nessun testo resta con un dollaro che aprirebbe una formula', () => {
    for (const s of cards) {
      for (const seg of splitMath(convertCard({ text: s.testo, key: s.chiave }).text)) if (seg.type === 'text') expect(seg.value, s.id).not.toMatch(/(^|[^\\])\$/)
    }
  })

  it('la proposta tiene le parole del testo: togliendo le formule, il testo intorno è identico', () => {
    for (const s of cards.slice(0, 120)) {
      const proposal = convertCard({ text: s.testo, key: s.chiave }).text
      const prose = splitMath(proposal).filter((x) => x.type === 'text').map((x) => x.value)
      for (const piece of prose) {
        for (const word of piece.split(/\s+/).filter((w) => w.length > 3 && !/[$()]/.test(w))) expect(s.testo, `${s.id}: ${word}`).toContain(word)
      }
    }
  })

  it('converte più della metà delle schede con formule e perde poche chiavi', () => {
    const results = cards.map((s) => convertCard({ text: s.testo, key: s.chiave }))
    expect(results.filter((r) => r.changed).length).toBeGreaterThan(250)
    expect(results.filter((r) => r.keyLost).length).toBeLessThan(25)
  })
})
