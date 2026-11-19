# Radar de Vagas

Daily job radar that runs on my own machine: collects remote developer jobs from public job boards, removes duplicates, scores each one against my resume with Claude Code (my subscription, no API key), stores everything in a local SQLite file and shows it in a local dashboard. Claude Code skills then find people to contact and apply to the best jobs in my own logged-in browser.

## Stack

TypeScript (Node.js 22) · SQLite (`node:sqlite`, built into Node) · Claude Code headless (`claude -p` with a JSON schema) · Next.js 16 dashboard · Windows Task Scheduler · Vitest

## How it works

```
Windows Task Scheduler (daily)
  └─ scripts/radar-diario.ps1 → npm run radar → src/run.ts
       ├─ src/sources/*      one collector per board, all in parallel; a failing board is logged, never fatal
       ├─ core/location.ts   drops jobs I can't take (on-site, US-only, ...)
       ├─ core/normalize.ts  fingerprint = company + title, so the same job from two boards is stored once
       ├─ db/client.ts       data/radar.db (schema in db/schema.sql)
       └─ scoring/score.ts   `claude -p` in batches of 10: { score 0-100, reason, requirements, eligibleFromBrazil }

painel/ (Next.js, http://localhost:3000, only reachable from this computer)
  └─ filter jobs, approve or skip, contacts per job, metrics by board and period

Claude Code + Claude in Chrome (manual)
  ├─ .claude/skills/busca-contatos     for approved jobs: recruiters and team members on LinkedIn, plus a draft note
  └─ .claude/skills/aplica-nas-vagas   reads the queue, applies one by one, updates status
```

Flow: the radar collects and scores → you approve in the dashboard → `busca-contatos` finds people to reach out to → `aplica-nas-vagas` applies.

| Board | Method | Notes |
|---|---|---|
| RemoteOK | Public JSON API | |
| Himalayas | Public JSON API | |
| We Work Remotely | RSS | |
| Trampos.co | Public JSON API | few tech jobs |
| Gupy | `__NEXT_DATA__` of the public portal | the old `portal.api.gupy.io` returns 404 |
| LinkedIn | Guest job search endpoint (no login) | rate-limited: retries with backoff, keeps partial results |
| Wellfound | `__NEXT_DATA__` of role pages | |
| Programathor | HTML | |
| Vagas.com | HTML | most jobs are on-site, so few survive the remote filter |
| GeekHunter | JSON-LD on listing and job pages | |
| Indeed BR | not collected | answers 403 to automated requests |
| Remote.co | not collected | no collector yet |
| FlexJobs | not collected | job details need a paid plan |

Blocked boards show up as failed in the dashboard's metrics. The radar never tries to get around a block, a login wall or a CAPTCHA.

## Setup

Requirements: Node.js 22+ and [Claude Code](https://claude.com/claude-code) installed and logged in (`claude` on the PATH).

```bash
npm install
npm --prefix painel install
```

Put your personal files in `perfil/` (git-ignored, see `perfil/README.md`): `resumo-cv.md` (the text Claude scores against), `perfil-candidato.md` (answer bank for applications) and the PT and EN resumes as PDF.

## Running

```bash
npm run radar                  # collect + score; creates data/radar.db on first run
npm run painel                 # dashboard at http://localhost:3000
npm run agendar                # schedule the daily run (08:00; runs at next boot if the PC was off)
```

Other options:

```bash
npm run dev                    # dry run: collects only, writes dry-run.json, touches nothing
npm run radar -- --no-score    # collect without scoring
npm run radar -- --score-only  # score what is still unscored
npm run radar -- --source=gupy # one board only
npm test
```

At the end of each daily run a Windows popup shows how many jobs are new and asks whether to open the dashboard; Yes starts it (if it isn't running) and opens today's jobs in the browser. Daily runs log to `data/logs/radar-YYYY-MM-DD.log`. Another time: `npm run agendar -- -Hora 07:30`. To remove the task: `Unregister-ScheduledTask -TaskName "Radar de Vagas"` in PowerShell.

There are no secrets and no environment variables. Optional: `RADAR_DB` points the radar and the dashboard at another database file.

## Tuning

Everything lives in `config/radar.config.json`:

| Key | What it does |
|---|---|
| `keywordsBr` / `keywordsIntl` | Searches on LinkedIn, Gupy, Vagas.com (PT) and LinkedIn, Himalayas (EN) |
| `broadTermsBr` | Short generic terms for Gupy and Programathor, whose search is very literal |
| `wellfoundRoles` | Wellfound role slugs (`/role/r/<slug>`) |
| `scoreCutoff` | Minimum score for a job to enter the apply queue (jobs below it are kept, just ranked lower) |
| `scoringModel` | Claude Code model alias (`sonnet`, `haiku`, `opus`); uses your subscription's usage limits |
| `scoringBatchSize` / `scoringConcurrency` | Jobs per `claude -p` call, and calls in parallel |
| `maxScoringPerRun` | Cap on jobs scored per run |
| `maxDetailFetchesPerSource` | Cap on job detail pages fetched per board (LinkedIn, Trampos, GeekHunter) |
| `dailyApplyLimits` | Max applications per platform per day, enforced by the apply queue |
| `contactSearchesPerDay` / `contactsPerCompany` | Companies searched for contacts per day, and people saved per company |

## Applying and contacts

In Claude Code, inside this folder, with Claude in Chrome connected to a browser where you are logged in to LinkedIn and Gupy, say "aplica nas vagas". The skill first runs `busca-contatos` for approved jobs, then shows the queue, asks once for approval of the batch and applies one job at a time. It stops and marks the job `pending_me` for logins, CAPTCHAs, online tests and document numbers, and asks you when a question isn't covered by the profile (the answer is saved for next time). Status updates go through `npm run fila`, `npm run marca` and `npm run contatos`.

`busca-contatos` opens the company's People tab in your LinkedIn session, picks up to `contactsPerCompany` people (tech recruiter, talent acquisition, hiring manager, team member), saves name, headline and profile URL with a draft connection note, and never sends anything. You send the invites and track each contact's status in the dashboard.

Automating applications goes against LinkedIn's user agreement and can get an account restricted. The daily limits reduce that risk; they don't remove it.

## Known limits

- The daily run only happens when the computer is on (it catches up at the next boot).
- Board HTML changes without notice; when a collector breaks, it shows up as a failed board in the metrics.
