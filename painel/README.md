# Radar de Vagas · painel

Local dashboard to browse the collected jobs, approve or skip them, follow the contacts found at each company and track collection and application metrics.

## Stack

Next.js 16 (App Router, Server Components, Server Actions) · TypeScript · Tailwind 4 · SQLite via `node:sqlite`

## Local setup

```bash
cd painel
npm install
npm run dev      # http://localhost:3000, bound to 127.0.0.1 only
npm run build
npm run lint
```

From the repo root, `npm run painel` does the same as `npm run dev` here.

It reads `../data/radar.db`, the file the radar creates on its first `npm run radar`. There is no login: the server only listens on 127.0.0.1, so it is reachable from this computer only.

## Environment variables

| Variable | Used for |
|---|---|
| `RADAR_DB` | Optional. Path to the database file when it is not `../data/radar.db` |
