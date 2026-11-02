# Stato della fase 3

Aggiornato: 2 novembre 2026.

## Fette fatte, sul branch locale `feat/fase-3`
Ogni commit ha il trailer Co-Authored-By e passa da solo test unitari, tsc ed e2e Chromium.
- `feat: formule vere con KaTeX` (G; 557 test, e2e Chromium 105). Questo file è nello stesso commit della fetta: l'hash si legge con `git log --oneline -1`.

## Punto esatto
Fetta G chiusa e committata. Niente push.
- KaTeX 0.19 self-hosted: CSS e 20 font woff2 nel precache; nessun font in `data:` URL (la CSP ha `font-src 'self'`, quindi `assetsInlineLimit` esclude i font). CSP invariata.
- `src/math/`: `delimiters.ts` (testo, `$...$`, `$$...$$`, `\$`), `render.ts` (htmlAndMathml, `trust: false`), `convert.ts` e `dictionary.ts` (convertitore assistito).
- `components/MathText.tsx`: usato nel ripasso (Indovina il nome; A memoria dopo il controllo; Copia sopra il testo da battere; Completa solo a scheda finita, per non svelare la chiave) e nell'editor della scheda (anteprima e campo "Lettura della formula").
- `Card.formulaReading` = la "letturaFormula" della spec: migrazione Dexie v5 (IndexedDB 50) in `src/db/migrations/v5.ts`, stessa normalizzazione nei backup; i file di schede la portano come `letturaFormula`.
- "Converti in LaTeX": Dati → Schede di ripasso → `#/dati?vista=latex`, filtro per corso e sezione, testo attuale e resa affiancati, sorgente della proposta modificabile, conferma per scheda o per sezione (doppio tocco), `userEdited: true`.
- `e2e/layout.spec.ts`: scorrimento orizzontale, controlli coperti (elementFromPoint al centro) e testo tagliato su ogni schermata a 1180×820 e 390×844, più un test che prova che il controllo trova davvero i tre problemi. La prova offline verifica che i font di KaTeX si carichino senza rete.

## Prossimo passo
Fetta H: battitura in LaTeX e terzo livello della tastiera (vedi SPEC-FASE-3.md e il piano).

## Problemi aperti
- WebKit mai provato: `sudo npx playwright install-deps webkit`, poi `WEBKIT=1 npm run test:e2e`.
- Il convertitore non riconosce tutto: delle 502 schede ne propone 301; per 16 la chiave non si ritrova nella proposta (la vista lo segnala, la conversione in blocco le lascia da parte). Le "e" e "a" tra due pezzi di formula restano testo se accanto non c'è un operatore (`4 a c T^3` si spezza).
- Nella pagina Agenda le fasce orarie (`.timeline__hour`) stanno sotto i blocchi per scelta del mockup: il controllo delle coperture le esclude esplicitamente.
- Non esiste un'anteprima d'importazione delle schede (l'importazione da file è diretta): MathText ci andrà con l'importazione .tex della fetta I.
- I blocchi display che contengono un `$` (`$$ a $b$ c $$`) arrivano a KaTeX così come sono e si vedono come errore evidenziato.

## Decisioni prese con l'utente
- Niente screenshot da mostrare: le sovrapposizioni le controlla il test e2e automatico (`e2e/layout.spec.ts`). Gli screenshot si rigenerano comunque in `docs/screenshots/`.
- Modalità LaTeX (fetta H) = scatola 2 solo per le schede con `$...$`, al posto di Completa.
- Tastiera da xkb `it` di Ubuntu: `[ ] @ # ~` con AltGr, `{ }` con AltGr+Maiusc, `\ ^ _` senza AltGr.
- Un agente alla volta, un commit per fetta, `STATO-FASE-3.md` aggiornato nello stesso commit, pausa dopo J, nessun push.

## Decisioni prese in G
- Greche ambigue: `eta, nu, mu, pi, chi, xi, zeta, iota, gamma, delta, Gamma, Delta, Pi, Xi` diventano simboli solo in contesto di formula (pedice o apice attaccato, oppure una parola vicina che è numero, lettera, operatore o simbolo); le altre greche si convertono anche da sole. Sempre e solo parole intere ("pianeta" non si tocca).
- Le espressioni di più parole che sono operatori (`somma diretta`, `isomorfo a`, `proporzionale a`, `è circa`, `tensor`, `intersecato`, `cup`, `cap`, `x`) si convertono solo tra due pezzi di formula.
- Una sequenza diventa `$...$` solo se contiene un pezzo "forte" (pedice, apice, simbolo del dizionario): "J = 1" resta testo.
- Formule in linea con la regola di Pandoc (`$` che apre seguito da non-spazio, `$` che chiude preceduto da non-spazio e non seguito da cifra): "costa 5$" resta testo.
- Tre schede inventate con formule nei dati dimostrativi (`demo-card-1-f*`), già nella scatola 5 con scadenza lontana per non cambiare il piano del giorno.
