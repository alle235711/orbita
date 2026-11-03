# Stato della fase 3

Aggiornato: 3 novembre 2026.

## Fette fatte, sul branch locale `feat/fase-3`
Ogni commit ha il trailer Co-Authored-By e passa da solo test unitari, tsc ed e2e Chromium.
- `feat: formule vere con KaTeX` (G; 557 test, e2e Chromium 105).
- `feat: battitura in LaTeX e terzo livello della tastiera` (H; 596 test, e2e Chromium 108 verdi su 110, vedi Problemi aperti). Questo file è nello stesso commit della fetta: l'hash si legge con `git log --oneline -1`.

## Punto esatto
Fetta H chiusa e committata. Niente push.
- Nuova modalità `latex` (`ReviewMode`, nessuna migrazione Dexie: `mode` non è indicizzato). `modeForCard(box, text)` in `review/leitner.ts`: scatola 2 + scheda con almeno una formula `$...$` o `$$...$$` ben chiusa = LaTeX al posto di Completa; le altre scatole e le schede senza formule non cambiano. Se la formula sparisce dalla scheda mentre la si ripassa (modifica), `RipassoPage` torna a Completa.
- Si batte il sorgente delle formule, non il testo intero: `latexSource(text)` (`review/latex.ts`) prende il sorgente di ogni formula, in ordine, senza i `$`, separate da uno spazio, con spazi e a capo ridotti a uno. Sopra resta la scheda intera resa da KaTeX (`MathText`), come riferimento. Il motore di battitura è lo stesso (`TypingExercise` con `mode='latex'`, `target` al posto di `text`); precisione minima, Leitner e statistiche come Copia e Completa; la revisione si salva con `mode: 'latex'`.
- `normalizeTyped(value, target)`: un carattere che sta nel testo di riferimento non viene "normalizzato" (in LaTeX l'accento grave è un carattere vero, non un apostrofo).
- Terzo livello: `src/review/layout-it.ts` è la tabella dei dati (48 tasti fisici x 4 livelli: base, Maiusc, Alt Gr, Alt Gr+Maiusc) da xkb `it(basic)` di Ubuntu, con `PREFERRED` per i caratteri che stanno in più posti. `keyboard.ts` ne ricava `strokeFor(char)` = tasto, livello, dito, Shift (mano opposta) e Alt Gr (pollice destro). `Keyboard.tsx` accende anche il tasto "alt gr" (come lo Shift) e `strokeHint` lo dice a parole: «{», mignolo destro con Alt Gr (pollice destro) e lo Shift sinistro.
- Verifica: `scripts/xkb-it.mjs` ricompila la mappa dal sistema e la salva in `src/test/xkb-it-basic.json` (keysym); `layout-it.test.ts` la confronta con la tabella carattere per carattere, controlla il piano della fetta, l'accordo con il disegno (`ROWS`) e l'inventario dei caratteri (`src/test/charset.ts`: titolo, testo e chiave delle 502 schede, proposte e sorgenti LaTeX del convertitore, lezioni). Risultato: 96 caratteri distinti, tutti con tasto e livello, nessuno irraggiungibile. `INVENTORY=1 npx vitest run src/review/layout-it.test.ts --reporter=verbose --silent=false` stampa l'inventario con i conteggi.
- Nelle schede e nelle proposte compaiono con Alt Gr solo `{` e `}` (248 volte ciascuno, tutte nelle proposte del convertitore; nessuna nelle schede così come sono; al quarto livello: Alt Gr + Maiusc + `è` e `+`). `[ ] @ # ~` e `` ` `` non compaiono mai nelle schede: la tabella li sa scrivere, ma nessun test dei mazzi li esercita.
- e2e: `e2e/layout.spec.ts` ha un test per i due formati (1180x820 e 390x844) con una scheda inventata in scatola 2 (`importDemo` accetta `cards` e `cardState`): modalità, resa, sorgente, suggerimento di `{`, tasti accesi (è, Maiusc sinistro, alt gr), nessuna sovrapposizione, revisione salvata come `latex` e scatola 3.

## Prossimo passo
Fetta I: importazione delle schede da file `.tex` (vedi SPEC-FASE-3.md e il piano). La modalità Completa senza chiave (fetta I) non toccherà la modalità LaTeX.

## Problemi aperti
- `e2e/migration.spec.ts` (2 test: «un database della fase 1 si aggiorna…» e «la scheda del profilo non sposta orbita…») è rosso, anche su HEAD senza la fetta H: non fissa l'orologio e la pagina si apre in inglese (il giorno di oggi, martedì, è un giorno "nell'altra lingua"), quindi non trova il titolo «Completa il profilo». Va sistemato nel test (`page.clock.setFixedTime` o la lingua), non nel codice. Non toccato in H.
- WebKit mai provato: `sudo npx playwright install-deps webkit`, poi `WEBKIT=1 npm run test:e2e`.
- Il convertitore non riconosce tutto: delle 502 schede ne propone 301; per 16 la chiave non si ritrova nella proposta (la vista lo segnala, la conversione in blocco le lascia da parte). Le "e" e "a" tra due pezzi di formula restano testo se accanto non c'è un operatore (`4 a c T^3` si spezza).
- La mappa del terzo livello è quella di xkb `it` per Ubuntu. Su tastiere italiane Apple (Mac, iPad con tastiera fisica) i livelli sono diversi: da `it(mac)`, `{` è Alt+4 e `[` Alt+Maiusc+4, `}` Alt+7 e `]` Alt+Maiusc+7, `|` Alt+AB09 e `\` Alt+Maiusc+AB09, `@` e `#` stanno sul tasto TLDE senza Alt, `~` solo come tasto morto. Non implementato, e non verificato su una tastiera Apple vera (il file xkb descrive Linux): il suggerimento su Mac/iPad può indicare il tasto sbagliato. Serve una seconda tabella e la scelta della tastiera nelle impostazioni.
- `<` e `>` stanno sul tasto ISO in basso a destra accanto ad Alt Gr, che il mockup disegna senza colore del dito: la tastiera disegnata non dice con quale dito si premono (il suggerimento dice solo «tasto in basso a destra accanto ad alt gr»). `>` compare 106 volte nel testo delle schede (le frecce `->`) e `<` 12. xkb li offre anche su Alt Gr+Maiusc+Z e +X (livello 4), ma non è il posto ovvio.
- xkb offre più vie anche per le graffe e le quadre: `{` anche su Alt Gr+7, `}` su Alt Gr+0, `[` su Alt Gr+8, `]` su Alt Gr+9, `@` su Alt Gr+Q. Il suggerimento segue il piano (`[ ] @` con Alt Gr su `è + ò`, `{ }` con Alt Gr+Maiusc su `è +`); `{ }` su Alt Gr+7 e +0 sono più comode (niente Maiusc): basta cambiare `PREFERRED` in `layout-it.ts`.
- In modalità LaTeX il campo di battitura è a una riga: se una scheda ha molte formule il sorgente da battere è lungo e va a capo nell'elenco dei caratteri; non c'è un indicatore di quale formula si sta battendo.
- Le maiuscole accentate (`È`, `À`...) non esistono sulla tastiera italiana di xkb (Maiusc+è dà `é`): `strokeFor` oggi dà null per loro, prima le trovava in modo sbagliato su Maiusc+è. Non compaiono nelle schede.
- Nella pagina Agenda le fasce orarie (`.timeline__hour`) stanno sotto i blocchi per scelta del mockup: il controllo delle coperture le esclude esplicitamente.
- Non esiste un'anteprima d'importazione delle schede (l'importazione da file è diretta): MathText ci andrà con l'importazione .tex della fetta I.
- I blocchi display che contengono un `$` (`$$ a $b$ c $$`) arrivano a KaTeX così come sono e si vedono come errore evidenziato.

## Decisioni prese con l'utente
- Niente screenshot da mostrare: le sovrapposizioni le controlla il test e2e automatico (`e2e/layout.spec.ts`). Gli screenshot si rigenerano comunque in `docs/screenshots/`.
- Modalità LaTeX (fetta H) = scatola 2 solo per le schede con `$...$`, al posto di Completa.
- Tastiera da xkb `it` di Ubuntu: `[ ] @ # ~` con AltGr, `{ }` con AltGr+Maiusc, `\ ^ _` senza AltGr.
- Un agente alla volta, un commit per fetta, `STATO-FASE-3.md` aggiornato nello stesso commit, pausa dopo J, nessun push.

## Decisioni prese in H
- La modalità LaTeX batte solo il sorgente delle formule (senza `$`, separate da uno spazio), non il testo intero: la spec dice "si batte il sorgente della formula", e il testo intero è già Copia. La resa KaTeX sopra è quella della scheda intera, per il contesto.
- Dove xkb ha più posti per un carattere vince quello del piano (`[ ] { }` sui tasti `è` e `+` come sulla tastiera Windows, `@` su `ò`); per gli altri il livello più basso. Il piano e xkb coincidono per tutti i caratteri della lista (`\ { } [ ] ^ _ ~ @ #`).
- Il tasto Alt Gr è già nel disegno (dito: pollice destro): si accende col colore dello Shift. Nessun carattere di terzo livello è stampato sui tasti: il mockup non lo mostra.
- `hint.altGr` (il tasto accanto ad Alt Gr, per `<` e `>`) si chiama ora `hint.rightOfAltGr`; `hint.finger` ha il parametro `altGr`.

## Decisioni prese in G
- Greche ambigue: `eta, nu, mu, pi, chi, xi, zeta, iota, gamma, delta, Gamma, Delta, Pi, Xi` diventano simboli solo in contesto di formula (pedice o apice attaccato, oppure una parola vicina che è numero, lettera, operatore o simbolo); le altre greche si convertono anche da sole. Sempre e solo parole intere ("pianeta" non si tocca).
- Le espressioni di più parole che sono operatori (`somma diretta`, `isomorfo a`, `proporzionale a`, `è circa`, `tensor`, `intersecato`, `cup`, `cap`, `x`) si convertono solo tra due pezzi di formula.
- Una sequenza diventa `$...$` solo se contiene un pezzo "forte" (pedice, apice, simbolo del dizionario): "J = 1" resta testo.
- Formule in linea con la regola di Pandoc (`$` che apre seguito da non-spazio, `$` che chiude preceduto da non-spazio e non seguito da cifra): "costa 5$" resta testo.
- Tre schede inventate con formule nei dati dimostrativi (`demo-card-1-f*`), già nella scatola 5 con scadenza lontana per non cambiare il piano del giorno.
