# CLAUDE.md

Orbita (nome provvisorio). Stato: fase 1 in corso sul branch `feat/fase-1`.

La specifica completa è `SPEC.md` nella radice: resta solo in locale (è in `.gitignore`), come `PROMPT.md`. Mockup in `design/`, schede di ripasso in `content/schede-2026-27.json`.

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
- `npm run test:e2e`: Playwright (screenshot e controlli su Chromium e WebKit)
- `npm run gen:art`: rigenera le immagini pre-renderizzate in `public/art/`

## Struttura
- `src/app/`: guscio (router a hash, navigazione, avviso di aggiornamento)
- `src/styles/`: token (`--disk` è il colore del disco del giorno) e stili globali
- `src/lib/`: utilità pure (energia, date)
- `src/db/`: Dexie (`schema.ts` con i tipi, `db.ts` con gli indici), seed della SPEC §6, schede, backup
  - Ogni record ha `id`, `updatedAt`, `deletedAt` (cancellazione logica, usare `save`/`patch`/`remove` di `repo.ts`).
  - Chiavi naturali dove esistono: `days.id` è la data, `cardState.id` è l'id della scheda, `rules.id` la regola, `settings.id` il nome.
  - Seed e schede incluse hanno `updatedAt = 0`: qualsiasi modifica dell'utente vince nella fusione dei backup (last-write-wins).
- `src/rules/`: motore di regole, funzioni pure (`defaults.ts` ha le 9 regole e le soglie)
- `src/features/<sezione>/`: una cartella per schermata
