-- Radar de Vagas: banco local (SQLite, arquivo data/radar.db).
-- Datas em texto ISO 8601 UTC. Listas (sources, requirements) em JSON.

pragma journal_mode = wal;
pragma foreign_keys = on;

create table if not exists jobs (
  id text primary key,
  fingerprint text not null unique,
  source text not null,
  sources text not null default '[]',
  external_id text,
  url text not null,
  apply_url text,
  apply_type text not null default 'unknown'
    check (apply_type in ('easy_apply', 'form', 'email', 'external', 'unknown')),
  title text not null,
  company text not null,
  location text,
  remote_scope text not null default 'unknown'
    check (remote_scope in ('worldwide', 'latam', 'brazil', 'europe', 'unknown')),
  language text,
  seniority text not null default 'nao_definido'
    check (seniority in ('junior', 'pleno', 'senior', 'nao_definido')),
  description text,
  requirements text,
  posted_at text,
  first_seen_at text not null,
  last_seen_at text not null,
  score integer check (score between 0 and 100),
  score_reason text,
  scored_at text,
  status text not null default 'new'
    check (status in ('new', 'approved', 'skipped', 'applied', 'pending_me', 'failed')),
  status_reason text,
  applied_at text,
  cv_used text,
  contacts_searched_at text
);

create index if not exists jobs_score_idx on jobs (score desc);
create index if not exists jobs_status_idx on jobs (status);
create index if not exists jobs_first_seen_idx on jobs (first_seen_at desc);

create table if not exists source_runs (
  id integer primary key autoincrement,
  run_id text not null,
  source text not null,
  ok integer not null,
  fetched integer not null default 0,
  kept integer not null default 0,
  inserted integer not null default 0,
  error text,
  duration_ms integer,
  created_at text not null
);

create index if not exists source_runs_source_idx on source_runs (source, created_at desc);

create table if not exists application_events (
  id integer primary key autoincrement,
  job_id text not null references jobs (id) on delete cascade,
  platform text not null,
  status text not null,
  reason text,
  created_at text not null
);

create index if not exists application_events_day_idx on application_events (platform, created_at);

create table if not exists job_contacts (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  company text not null,
  name text not null,
  title text,
  kind text not null default 'other'
    check (kind in ('recruiter', 'tech_recruiter', 'talent_acquisition', 'hiring_manager', 'team_member', 'other')),
  linkedin_url text not null,
  why text,
  message_draft text,
  status text not null default 'found'
    check (status in ('found', 'invited', 'messaged', 'replied', 'ignored')),
  found_at text not null,
  contacted_at text,
  unique (job_id, linkedin_url)
);

create index if not exists job_contacts_job_idx on job_contacts (job_id);
