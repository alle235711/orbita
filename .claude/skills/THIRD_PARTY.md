# Skill di terze parti

Tutte le skill in questa cartella sono copie di repository di terzi, copiate il 2026-10-26 senza modifiche al contenuto. Le uniche aggiunte sono i file `LICENSE`/`NOTICE.md` messi dentro ogni cartella. Per aggiornare una skill, ripeti la copia da un commit più recente e aggiorna questa tabella.

| Skill | Repository | Percorso sorgente | Commit (HEAD del clone) | Ultimo commit sul percorso | Licenza |
|---|---|---|---|---|---|
| `impeccable/` (v4.7.1) | https://github.com/pbakaus/impeccable | `.claude/skills/impeccable/` | `ade37830fee364c1457f9ada479470296f80dbbb` | `63d672f178b70e96b93d81ec43be4448fd3c345a` | Apache-2.0 (`impeccable/LICENSE`, `impeccable/NOTICE.md`) |
| `emil-design-eng/` | https://github.com/emilkowalski/skills | `skills/emil-design-eng/` | `2d228630ba1446365f614a108cb8252f1feda202` | `85e8e2363b713506e1d5b6e07a0eb2da66be1bc3` | MIT, © 2026 Emil Kowalski (`emil-design-eng/LICENSE`) |
| `apple-design/` | https://github.com/emilkowalski/skills | `skills/apple-design/` | `2d228630ba1446365f614a108cb8252f1feda202` | `85e8e2363b713506e1d5b6e07a0eb2da66be1bc3` | MIT, © 2026 Emil Kowalski (`apple-design/LICENSE`) |
| `animate/` | https://github.com/emilkowalski/skills | `skills/animate/` | `2d228630ba1446365f614a108cb8252f1feda202` | `85e8e2363b713506e1d5b6e07a0eb2da66be1bc3` | MIT, © 2026 Emil Kowalski (`animate/LICENSE`) |

## Note su Impeccable
- **Sorgente:** è stata copiata la build per Claude Code con installazione a livello di progetto (`.claude/skills/impeccable/` del repo). Non è la variante plugin (`plugin/skills/impeccable/`).
- **Materiale derivato:** secondo `impeccable/NOTICE.md`, `reference/ios.md` e `reference/android.md` derivano da https://github.com/ehmo/platform-design-skills (MIT, autore ehmo).
- **Hook non installati:** non sono stati copiati né `.claude/settings.json` né `plugin/hooks/hooks.json` del repo. Non sono stati copiati nemmeno i subagent `impeccable-*` (`.claude/agents/`): la skill ha un percorso di ripiego quando mancano (`reference/degraded/`).
- **Binario esterno:** `scripts/impeccable` è un launcher. Alla prima esecuzione scarica il motore (versione 0.1.17) da `https://github.com/pbakaus/impeccable/releases` in `~/.impeccable/bin/`, verificandone lo sha256 con `scripts/engine-checksums.txt`. La skill lo invoca con `scripts/impeccable context`.
