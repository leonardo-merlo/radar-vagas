# Radar de Vagas

Daily job radar: collects remote developer jobs from public job boards, removes duplicates, scores each one against my resume with the Claude API, stores everything in Supabase and emails me a digest. A Claude Code skill then applies to the best ones in my own logged-in browser.

## Stack

TypeScript (Node.js 22) · Supabase (Postgres, RLS) · Claude API (`@anthropic-ai/sdk`, structured outputs) · GitHub Actions (cron) · Nodemailer (Gmail) · Vitest

## How it works

```
GitHub Actions (06:30 BRT)
  └─ src/run.ts
       ├─ src/sources/*      one collector per board, all run in parallel; a failing board is logged, never fatal
       ├─ core/location.ts   drops jobs I can't take (on-site, US-only, ...)
       ├─ core/normalize.ts  fingerprint = company + title, so the same job from two boards is stored once
       ├─ db/client.ts       upsert_jobs() in Postgres: insert new, merge sources of known ones
       ├─ scoring/score.ts   Claude returns { score 0-100, reason, requirements, eligibleFromBrazil }
       └─ digest/digest.ts   email: new jobs, top 15, count per board, boards that failed

Claude Code + Claude in Chrome (manual)
  └─ .claude/skills/aplica-nas-vagas   reads the queue, applies one by one, updates status
```

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

Blocked boards are reported in the digest every day. The radar never tries to get around a block, a login wall or a CAPTCHA.

## Local setup

```bash
npm install
cp .env.example .env          # fill in the values
npm run dev                   # dry run: collects only, writes dry-run.json, touches nothing
npm run radar -- --no-email   # full run without sending the email (writes digest-preview.html)
npm run radar                 # full run
npm test
```

Run one board only: `npm run dev -- --source=gupy`.

### Database

Create a Supabase project and run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`). Tables have RLS on and no policies: only the service role key can read or write.

### Personal files

`perfil/` is git-ignored except the examples. Put there:

- `resumo-cv.md`: the profile text Claude scores against (from `resumo-cv.example.md`)
- `perfil-candidato.md`: the answer bank for applications (from `perfil-candidato.example.md`)
- the PT and EN resumes as PDF

## Environment variables

| Variable | Used for |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key; never commit it |
| `ANTHROPIC_API_KEY` | Scoring |
| `GMAIL_USER` | Gmail account that sends the digest |
| `GMAIL_APP_PASSWORD` | Gmail app password (needs 2-step verification) |
| `DIGEST_TO` | Digest recipient (defaults to `GMAIL_USER`) |
| `CANDIDATE_PROFILE` | Profile text for scoring in CI (same content as `perfil/resumo-cv.md`) |

In GitHub: Settings > Secrets and variables > Actions > New repository secret, one per variable. With the GitHub CLI:

```bash
gh secret set SUPABASE_URL
gh secret set SUPABASE_SERVICE_ROLE_KEY
gh secret set ANTHROPIC_API_KEY
gh secret set GMAIL_USER
gh secret set GMAIL_APP_PASSWORD
gh secret set DIGEST_TO
gh secret set CANDIDATE_PROFILE < perfil/resumo-cv.md
```

Trigger a run by hand: Actions > Radar de Vagas > Run workflow, or `gh workflow run radar.yml`.

## Tuning

Everything lives in `config/radar.config.json`:

| Key | What it does |
|---|---|
| `keywordsBr` / `keywordsIntl` | Searches on LinkedIn, Gupy, Vagas.com (PT) and LinkedIn, Himalayas (EN) |
| `broadTermsBr` | Short generic terms for Gupy and Programathor, whose search is very literal |
| `wellfoundRoles` | Wellfound role slugs (`/role/r/<slug>`) |
| `scoreCutoff` | Minimum score for a job to enter the apply queue (jobs below it are kept, just ranked lower) |
| `scoringModel` / `scoringEffort` | Claude model and effort used for scoring |
| `maxScoringPerRun` | Cap on jobs scored per run, which caps the API cost |
| `maxDetailFetchesPerSource` | Cap on job detail pages fetched per board (LinkedIn, Trampos, GeekHunter) |
| `dailyApplyLimits` | Max applications per platform per day, enforced by the apply queue |

You can also approve a job by hand in Supabase (`status = 'approved'`) to put it in the queue regardless of score.

## Applying

In Claude Code, inside this folder, with Claude in Chrome connected to a browser where you are logged in to LinkedIn and Gupy, say "aplica nas vagas". The skill shows the queue, asks once for approval of the batch, then applies one job at a time. It stops and marks the job `pending_me` for logins, CAPTCHAs, online tests and document numbers, and asks you when a question isn't covered by the profile (the answer is saved for next time). Status updates go through `npm run fila` and `npm run marca`.

Automating applications goes against LinkedIn's user agreement and can get an account restricted. The daily limits reduce that risk; they don't remove it.

## Known limits

- GitHub disables scheduled workflows in public repositories after 60 days without commits.
- Board HTML changes without notice; when a collector breaks, it shows up as a failed board in the digest.
