# CLAUDE.md

Orbita (nome provvisorio). Stato: fase 2 in corso sul branch `feat/fase-2`.

La specifica completa è `SPEC.md` nella radice, con `SPEC-FASE-2.md` accanto per la fase 2: restano solo in locale (sono in `.gitignore`), come `PROMPT.md`. Mockup in `design/`, schede di ripasso in `content/schede-2026-27.json`.

## Decisioni di progetto
Queste sono decisioni già prese: non ridiscuterle e non aggirarle senza che l'utente lo chieda.

### Architettura: PWA local-first
- **Stack:** Vite + React + TypeScript.
- **PWA:** `vite-plugin-pwa` (service worker e manifest).
- **Database locale:** Dexie su IndexedDB. Il DB locale è la fonte di verità e l'app deve funzionare completamente offline.
- **Sincronizzazione:** con Supabase, ma in una **fase successiva**. Fino ad allora niente dipendenze, client o chiamate Supabase. Il modello dati però va tenuto sincronizzabile.

### Dispositivi target
- **Ora:**
  - iPad con Safari;
  - Ubuntu con Chrome;
  - Android con Chrome.
- **Verifica:** ogni funzionalità va provata anche su WebKit (Safari iPad), non solo su Chromium.
- **Fase futura:** Capacitor, con widget e Health Connect (Android) / HealthKit (iOS). Per ora nessuna dipendenza Capacitor.

### Briefing
- Il briefing è generato **solo da regole deterministiche, offline**.
- **Niente LLM:** nessuna chiamata a API di modelli e nessun modello on-device.

### Schermate e design
- **Fonte dei layout:** le schermate seguono i mockup in `/design`. Non inventare layout, gerarchie o flussi che i mockup non mostrano.
- **Mockup mancante o ambiguo:** fermati e chiedi, invece di progettarlo da zero.
- **Uso delle skill di design:** servono a eseguire bene i mockup (tipografia, spaziatura, motion, accessibilità, rifinitura), non a ridisegnarli.
  - Di progetto: `impeccable`, `emil-design-eng`, `apple-design`, `animate`.
  - Plugin: `frontend-design`.

## Skill di terze parti
- **Origine:** le skill in `.claude/skills/` sono copie di repository esterni. Repo, commit e licenze sono in `.claude/skills/THIRD_PARTY.md`.
- **Modifiche:** non modificarle a mano. Per aggiornarle, ricopia da un commit nuovo e aggiorna `THIRD_PARTY.md`.
- **Hook di Impeccable: non attivarli.** Quindi non usare `/impeccable hooks on`, non lasciare che `/impeccable doctor` ripari l'hook e non eseguire `npx impeccable install`/`update`.

## Comandi
Serve Node 24 (`nvm use`, c'è `.nvmrc`): Vite 8 e Vitest 5 non girano sul Node 18 di sistema.

- `npm run dev`: server di sviluppo su http://localhost:5173
- `npm test`: test Vitest della logica pura (`src/**/*.test.ts`)
- `npm run build`: controllo dei tipi (`tsc -b`) e build in `dist/`; con `BASE_PATH=/orbita/` per GitHub Pages
- `npm run preview`: serve la build, service worker compreso
- `npm run test:e2e`: Playwright sulla build di produzione (porta 4173): screenshot di ogni schermata a 1180×820, 390×844 e 1280×800 in `docs/screenshots/` e prova offline col service worker. `WEBKIT=1` aggiunge WebKit, che su Ubuntu richiede `sudo npx playwright install-deps webkit`.
- `npm run gen:art`: rigenera le immagini pre-renderizzate in `public/art/` e le icone in `public/icons/`

## Pubblicazione
- GitHub Pages con `.github/workflows/deploy.yml`: a ogni push su `main` (o a mano con `gh workflow run deploy.yml`) test, build con `BASE_PATH=/orbita/` e deploy su https://alle235711.github.io/orbita/.
- Il service worker usa `registerType: 'prompt'`: una nuova versione compare come avviso "Aggiorna", non ricarica da sola.

## Struttura
- `src/app/`: guscio (router a hash, navigazione, avviso di aggiornamento)
- `src/styles/`: token (`--disk` è il colore del disco del giorno) e stili globali
- `src/lib/`: utilità pure (energia, date)
- `src/db/`: Dexie (`schema.ts` con i tipi, `db.ts` con gli indici), seed della SPEC §6, schede, backup
  - Ogni record ha `id`, `updatedAt`, `deletedAt` (cancellazione logica, usare `save`/`patch`/`remove` di `repo.ts`).
  - Chiavi naturali dove esistono: `days.id` è la data, `cardState.id` è l'id della scheda, `rules.id` la regola, `settings.id` il nome.
  - Seed e schede incluse hanno `updatedAt = 0`: qualsiasi modifica dell'utente vince nella fusione dei backup (last-write-wins).
- `src/rules/`: motore di regole, funzioni pure (`defaults.ts` ha le 9 regole e le soglie); `plan.ts` compone il piano, `schedule.ts` mette i blocchi in agenda
- `src/review/`: coda del ripasso, Leitner, motore di battitura
- `src/i18n/`: dizionari `it`/`en` (`dict/`), formati di date e numeri (`format/`), `AppError` con `renderError`; ogni testo visibile viene da qui (lo controlla `no-literals.test.ts`)
- `src/modules/`: i sette moduli accendibili (sport, peso, lingua...) e le loro impostazioni
- `src/libretto/`: voti, medie e stato degli esami (`grades.ts`, funzioni pure)
- `src/multiverse/`: scenari degli appelli (universi) e cielo del Multiverso, funzioni pure
- `src/ics/`: importazione dell'orario da `.ics`, tutta locale (solo `FileReader`/`file.text()`, CSP con `connect-src 'self'`). Il nucleo è puro: `parse.ts`, `rrule.ts` (DAILY/WEEKLY), `time.ts` (fusi con `Intl`), `expand.ts`, `plan.ts`; `apply.ts` scrive via `repo.ts`. Id naturali `ics:<UID>:<occorrenza>`: reimportare è idempotente, gli eventi modificati dall'utente (`userEdited`) non si riscrivono, le occorrenze sparite si cancellano in modo logico. `Course.hideLessons` nasconde le lezioni da Agenda, copertina e pianificazione
- `src/stats/`: aggregazioni per la pagina Statistiche; `src/typing/`: lezioni e statistiche di battitura; `src/test/`: fixture dei test
- `src/art/`: oggetti cosmici in SVG (buco nero, cielo, galassie); `public/art/` ha le immagini pre-renderizzate da `scripts/render-art.mjs`
- `src/features/oggi/`: la copertina; `orbit.ts` è la geometria dell'orbita del mockup (ellisse 700,320 di semiassi 500×200 ruotata di −12°, 8:00 a 162,1°, 19:00 a 28,8°)
- `e2e/demo-data.js`: backup dimostrativo per screenshot e prove (si importa dalla pagina Dati, mai in automatico)
- `e2e/ics-fixture.ts`: orario `.ics` inventato, generato rispetto alla data di oggi (nessun `.ics` nel repository); `e2e/ics-helpers.ts` lo importa dal foglio dell'Agenda come farebbe una persona

## Note di implementazione
- Le fusioni `mix-blend-mode` (titolo, pianeti, grana) stanno dentro `.cover`, isolata e con sfondo opaco: senza sfondo opaco la grana in overlay schiarisce.
- Niente `font-variant-numeric: tabular-nums` globale: in Schibsted Grotesk rende tabulari anche punto, virgola e due punti. Usare la classe `.tnum` dove servono cifre allineate.
- Per i contenuti che cambiano con l'energia si usa l'entrata CSS `.swap-in` legata alla `key`, non `AnimatePresence`: con StrictMode la modalità "wait" può restare a metà.
- `src/features/<sezione>/`: una cartella per schermata
