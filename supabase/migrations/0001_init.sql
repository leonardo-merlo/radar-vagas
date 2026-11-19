-- Radar de Vagas: schema inicial.
-- Acesso só pela service key (GitHub Actions e scripts locais). RLS ligado e sem políticas:
-- a chave anon não lê nem escreve nada.

create type apply_type as enum ('easy_apply', 'form', 'email', 'external', 'unknown');
create type remote_scope as enum ('worldwide', 'latam', 'brazil', 'europe', 'unknown');
create type job_status as enum ('new', 'approved', 'skipped', 'applied', 'pending_me', 'failed');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  source text not null,
  sources text[] not null default '{}',
  external_id text,
  url text not null,
  apply_url text,
  apply_type apply_type not null default 'unknown',
  title text not null,
  company text not null,
  location text,
  remote_scope remote_scope not null default 'unknown',
  language text,
  description text,
  requirements text[],
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  score smallint check (score between 0 and 100),
  score_reason text,
  scored_at timestamptz,
  status job_status not null default 'new',
  status_reason text,
  applied_at timestamptz,
  cv_used text
);

create index jobs_score_idx on jobs (score desc nulls last);
create index jobs_status_idx on jobs (status);
create index jobs_first_seen_idx on jobs (first_seen_at desc);
create index jobs_unscored_idx on jobs (first_seen_at) where score is null;

create table source_runs (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  source text not null,
  ok boolean not null,
  fetched integer not null default 0,
  kept integer not null default 0,
  inserted integer not null default 0,
  error text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index source_runs_run_idx on source_runs (run_id);

create table application_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references jobs (id) on delete cascade,
  platform text not null,
  status job_status not null,
  reason text,
  created_at timestamptz not null default now()
);

create index application_events_day_idx on application_events (platform, created_at);

alter table jobs enable row level security;
alter table source_runs enable row level security;
alter table application_events enable row level security;

-- Insere vagas novas e, para as já conhecidas, só junta a fonte e atualiza last_seen_at.
-- Devolve o id e se a linha é nova, para o resumo contar "novas de hoje".
create or replace function upsert_jobs(payload jsonb)
returns table (id uuid, inserted boolean)
language sql
security invoker
set search_path = public
as $$
  insert into jobs as j (
    fingerprint, source, sources, external_id, url, apply_url, apply_type,
    title, company, location, remote_scope, language, description, posted_at
  )
  select
    r.fingerprint, r.source, coalesce(r.sources, array[r.source]), r.external_id, r.url, r.apply_url,
    coalesce(r.apply_type, 'unknown')::apply_type,
    r.title, r.company, r.location,
    coalesce(r.remote_scope, 'unknown')::remote_scope,
    r.language, r.description, r.posted_at
  from jsonb_to_recordset(payload) as r (
    fingerprint text, source text, sources text[], external_id text, url text, apply_url text,
    apply_type text, title text, company text, location text, remote_scope text,
    language text, description text, posted_at timestamptz
  )
  on conflict (fingerprint) do update set
    last_seen_at = now(),
    sources = (select array(select distinct unnest(j.sources || excluded.sources))),
    description = coalesce(j.description, excluded.description),
    apply_type = case when j.apply_type = 'unknown' then excluded.apply_type else j.apply_type end
  returning j.id, (xmax = 0) as inserted;
$$;

revoke execute on function upsert_jobs(jsonb) from public, anon, authenticated;
