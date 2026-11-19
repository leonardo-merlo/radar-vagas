# Radar de Vagas · painel

Dashboard to browse the collected jobs, approve or skip them, follow the contacts found at each company and track collection and application metrics.

## Stack

Next.js 16 (App Router, Server Components, Server Actions) · TypeScript · Tailwind 4 · Supabase Auth + Postgres RLS (`@supabase/ssr`)

## Local setup

```bash
cd painel
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm run build
npm run lint
```

Before the first login, in the Supabase dashboard:

1. Run `supabase/migrations/0002_contacts_and_dashboard.sql` (after `0001_init.sql`).
2. Authentication > Users > Add user: your email. Authentication > Sign In / Providers: turn off "Allow new users to sign up".
3. Authentication > URL Configuration: add `http://localhost:3000/auth/callback` (and the production URL later) to Redirect URLs.
4. SQL editor: `insert into dashboard_users (email) values ('your@email.com');`

Login is a magic link sent by Supabase Auth. Every query runs with the visitor's session, so RLS decides what they see: only emails in `dashboard_users` read anything, and they can only change a job's status (approve, skip) and a contact's status.

## Environment variables

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe in the browser; RLS protects the data) |
| `NEXT_PUBLIC_SITE_URL` | Base URL for the login link when the request has no Origin header |
