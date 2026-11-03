# Stato della fase 3

Aggiornato: 3 novembre 2026.

## Fette fatte, sul branch locale `feat/fase-3`
Ogni commit ha il trailer Co-Authored-By e passa da solo test unitari, tsc ed e2e Chromium.
- `feat: formule vere con KaTeX` (G; 557 test, e2e Chromium 105).
- `feat: battitura in LaTeX e terzo livello della tastiera` (H; 596 test, e2e Chromium 108 su 110: i due rossi erano `migration.spec.ts`, sistemato sotto).
- `test: migration.spec.ts non dipende più dal giorno della settimana` (a5945b6): fissa un mercoledì.
- `fix: < e > con il mignolo destro, sul tasto a destra di Alt Gr` (16d2ac2).
- `feat: importazione delle schede da file .tex` (I; 655 test, build ok, e2e Chromium 114 su 114, numeri rilanciati dal leader). Questo file è nello stesso commit della fetta: l'hash si legge con `git log --oneline -1`.

## Punto esatto
Fetta I chiusa e committata. Niente push. Le fette G e H sono descritte più sotto («Decisioni prese in G / dopo H / in H»).

### Fetta I: importazione da `.tex`
- Vista `#/dati?vista=tex` (pulsante «Importa da file .tex» nella sezione Schede di Dati): `src/features/dati/TexImport.tsx`. Più file insieme (`file.text()`, limite 5 MB), anteprima a tabella (ruoli ARIA, sotto 760 px si impila a blocchi) con caselle di spunta, tutte/nessuna, resa KaTeX (`MathText`), errori per blocco, scelta del corso (importazione disabilitata finché non lo scegli, con il motivo scritto), poi «Vai al ripasso». Nell'interfaccia sono dichiarati i limiti: `\newcommand`, `\input`, bibliografia.
- Parser puro in `src/tex/`: `scan.ts` (commenti `%` non preceduto da `\`, graffe bilanciate, gruppi `{}` e `[]`, righe), `body.ts` (dal corpo dell'ambiente al testo della scheda), `parse.ts`, `plan.ts` (id, anteprima), `read.ts`. Scrittura in `src/db/tex-import.ts` via `importCards`. `src/math/delimiters.ts` ha in più `scanMath` (posizioni nel sorgente); `splitMath` ne deriva ed è invariato.
- Ambienti: i `\newtheorem` (anche `*`, `[counter]`) di tutti i file scelti valgono per tutti; l'elenco scritto a mano si somma al predefinito (definizione, teorema, lemma, proposizione, corollario, osservazione, esempio e gli equivalenti inglesi). Un ambiente non in elenco e non standard dà l'errore «ambiente sconosciuto»; `proof`, `itemize`, `align`... si saltano in silenzio.
- Titolo: dall'argomento opzionale (finisce alla prima `]` fuori dalle graffe), altrimenti «Nome + progressivo» (per ambiente, conta ogni `\begin`, anche annidati o in errore, così gli id sono stabili). Sezione: la `\section` o `\subsection` più vicina (anche con `*`), altrimenti il nome del file senza estensione. Una scheda annidata resta nel testo di quella esterna. Corpo su una riga: `\label` tolti, `\%` → `%`, `\[..\]`, `\(..\)`, `equation`, `align`/`gather`/`multline` diventano `$$..$$` o `$..$`.
- Errori per blocco (12 codici `tex*` in `errors.ts`): un blocco con `\begin` senza `\end` non si importa, le schede chiuse bene prima o dopo sì; un file malformato non lancia e non fa perdere gli altri.
- Id `tex:<corso>:<file>:<ambiente>:<progressivo>` (`#2` per due file omonimi nello stesso lotto): reimportare dà «0 nuove, 0 aggiornate, N uguali», le schede modificate nell'app restano. Nessun `cardState` creato, come per le altre schede importate. Le sezioni nuove entrano una volta sola in `Course.sections`.
- Chiave vuota: `review/mask.ts` ha `hiddenRanges`, `lastDisplayRange`, `lastSentenceRange`. In Completa senza chiave si nasconde il corpo dell'ultima `$$..$$` (i `$$` restano), altrimenti l'ultima frase (fino a `.`, `;`, `!`, `?` seguiti da spazio o fine, fuori dalle formule). Con la chiave il comportamento è identico; la modalità LaTeX non è toccata.
- Test: `src/tex/parse.test.ts`, `plan.test.ts`, `src/db/tex-import.test.ts`, `src/review/mask.test.ts`, fixture `src/test/tex-fixtures.ts` (`TEX_GOOD`, `TEX_CHAPTER`, `TEX_MALFORMED`); e2e `e2e/tex.spec.ts` (+ `tex-helpers.ts`: scelta file, anteprima, spunta tolta, corso, importazione, ripetizione senza doppioni, ripasso) e in `e2e/layout.spec.ts` la vista vuota e quella con anteprima ed errori a 1180x820 e 390x844.
- Gli screenshot in `docs/screenshots/` sono rigenerati dall'e2e e stanno nel commit.

### Fetta H (riassunto)
- Modalità `latex` (scatola 2, schede con `$...$`), si batte il sorgente delle formule; `src/review/layout-it.ts` = tabella 48 tasti x 4 livelli da xkb `it(basic)`, controllata da `layout-it.test.ts` contro `src/test/xkb-it-basic.json` (rigenerabile con `scripts/xkb-it.mjs`); `strokeFor(char)` dà tasto, livello, dito, Shift (mano opposta) e Alt Gr (pollice destro). `INVENTORY=1 npx vitest run src/review/layout-it.test.ts --reporter=verbose --silent=false` stampa l'inventario dei 96 caratteri.

## Prossimo passo
Fetta J: mazzi da condividere (vedi SPEC-FASE-3.md e il piano). **Dopo la fetta J fermarsi e dirlo all'utente** (pausa: pubblica lui e si riprende dopo il 17 novembre).

## Problemi aperti
- WebKit mai provato: `sudo npx playwright install-deps webkit`, poi `WEBKIT=1 npm run test:e2e`.
- Il convertitore non riconosce tutto: delle 502 schede ne propone 301; per 16 la chiave non si ritrova nella proposta (la vista lo segnala, la conversione in blocco le lascia da parte). Le "e" e "a" tra due pezzi di formula restano testo se accanto non c'è un operatore (`4 a c T^3` si spezza).
- La mappa del terzo livello è quella di xkb `it` per Ubuntu. Su tastiere italiane Apple (Mac, iPad con tastiera fisica) i livelli sono diversi: da `it(mac)`, `{` è Alt+4 e `[` Alt+Maiusc+4, `}` Alt+7 e `]` Alt+Maiusc+7, `|` Alt+AB09 e `\` Alt+Maiusc+AB09, `@` e `#` stanno sul tasto TLDE senza Alt, `~` solo come tasto morto. Non implementato, e non verificato su una tastiera Apple vera (il file xkb descrive Linux): il suggerimento su Mac/iPad può indicare il tasto sbagliato. Serve una seconda tabella e la scelta della tastiera nelle impostazioni.
- xkb offre più vie anche per le graffe e le quadre: `{` anche su Alt Gr+7, `}` su Alt Gr+0, `[` su Alt Gr+8, `]` su Alt Gr+9, `@` su Alt Gr+Q. Il suggerimento segue il piano (`[ ] @` con Alt Gr su `è + ò`, `{ }` con Alt Gr+Maiusc su `è +`); `{ }` su Alt Gr+7 e +0 sono più comode (niente Maiusc): basta cambiare `PREFERRED` in `layout-it.ts`.
- In modalità LaTeX il campo di battitura è a una riga: se una scheda ha molte formule il sorgente da battere è lungo e va a capo nell'elenco dei caratteri; non c'è un indicatore di quale formula si sta battendo.
- Le maiuscole accentate (`È`, `À`...) non esistono sulla tastiera italiana di xkb (Maiusc+è dà `é`): `strokeFor` oggi dà null per loro, prima le trovava in modo sbagliato su Maiusc+è. Non compaiono nelle schede.
- Nella pagina Agenda le fasce orarie (`.timeline__hour`) stanno sotto i blocchi per scelta del mockup: il controllo delle coperture le esclude esplicitamente.
- Import `.tex`: la chiave resta vuota e l'ultima frase nascosta in Completa è un'euristica (i punti dentro abbreviazioni come «es.» la spostano). `\emph`, `\textbf` e gli elenchi dentro una scheda restano com'è nel sorgente; `%` a fine riga non unisce le parole come in TeX; `verbatim` non è speciale; `\chapter` e `\subsubsection` non contano come sezioni.
- I blocchi display che contengono un `$` (`$$ a $b$ c $$`) arrivano a KaTeX così come sono e si vedono come errore evidenziato.

## Decisioni prese con l'utente
- Niente screenshot da mostrare: le sovrapposizioni le controlla il test e2e automatico (`e2e/layout.spec.ts`). Gli screenshot si rigenerano comunque in `docs/screenshots/`.
- Modalità LaTeX (fetta H) = scatola 2 solo per le schede con `$...$`, al posto di Completa.
- Tastiera da xkb `it` di Ubuntu: `[ ] @ # ~` con AltGr, `{ }` con AltGr+Maiusc, `\ ^ _` senza AltGr.
- Un agente alla volta, un commit per fetta, `STATO-FASE-3.md` aggiornato nello stesso commit, pausa dopo J, nessun push.

## Decisioni prese dopo H
- `<` e `>` stanno sul tasto a destra di Alt Gr (così è sulla tastiera dell'utente e così lo disegna il mockup; in xkb è `LSGT`, che sulle tastiere ISO standard è a sinistra della Z: il codice resta il nome xkb, il disegno è `ROWS`). Dito: mignolo destro, con lo Shift sinistro per `>`. Il suggerimento è quello normale (««>», mignolo destro con lo Shift sinistro»); `hint.rightOfAltGr` e il caso «tasto senza dito» sono spariti. Il mockup non colora quel tasto: il colore del mignolo è una scelta dell'utente.
- Niente simboli stampati sui tasti, per ora (terzo e quarto livello restano solo nel suggerimento).
- `e2e/migration.spec.ts` (commit a5945b6): la fixture della fase 1 ha «martedì in inglese»; il test fissa un mercoledì con `page.clock.setFixedTime`. Non era un bug dell'app.

## Decisioni prese in H
- La modalità LaTeX batte solo il sorgente delle formule (senza `$`, separate da uno spazio), non il testo intero: la spec dice "si batte il sorgente della formula", e il testo intero è già Copia. La resa KaTeX sopra è quella della scheda intera, per il contesto.
- Dove xkb ha più posti per un carattere vince quello del piano (`[ ] { }` sui tasti `è` e `+` come sulla tastiera Windows, `@` su `ò`); per gli altri il livello più basso. Il piano e xkb coincidono per tutti i caratteri della lista (`\ { } [ ] ^ _ ~ @ #`).
- Il tasto Alt Gr è già nel disegno (dito: pollice destro): si accende col colore dello Shift. Nessun carattere di terzo livello è stampato sui tasti: il mockup non lo mostra.
- `hint.finger` ha il parametro `altGr`.

## Decisioni prese in G
- Greche ambigue: `eta, nu, mu, pi, chi, xi, zeta, iota, gamma, delta, Gamma, Delta, Pi, Xi` diventano simboli solo in contesto di formula (pedice o apice attaccato, oppure una parola vicina che è numero, lettera, operatore o simbolo); le altre greche si convertono anche da sole. Sempre e solo parole intere ("pianeta" non si tocca).
- Le espressioni di più parole che sono operatori (`somma diretta`, `isomorfo a`, `proporzionale a`, `è circa`, `tensor`, `intersecato`, `cup`, `cap`, `x`) si convertono solo tra due pezzi di formula.
- Una sequenza diventa `$...$` solo se contiene un pezzo "forte" (pedice, apice, simbolo del dizionario): "J = 1" resta testo.
- Formule in linea con la regola di Pandoc (`$` che apre seguito da non-spazio, `$` che chiude preceduto da non-spazio e non seguito da cifra): "costa 5$" resta testo.
- Tre schede inventate con formule nei dati dimostrativi (`demo-card-1-f*`), già nella scatola 5 con scadenza lontana per non cambiare il piano del giorno.
