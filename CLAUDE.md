# CLAUDE.md

Orbita (nome provvisorio). Stato: solo setup, ancora nessun codice dell'app.

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
Ancora nessuno: verranno aggiunti qui quando ci sarà lo scaffold Vite.
