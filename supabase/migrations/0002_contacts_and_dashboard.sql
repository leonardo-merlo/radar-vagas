-- Contatos por vaga (recrutadores e pessoas do time) e acesso do painel.
-- O painel entra com Supabase Auth; só e-mails em dashboard_users leem os dados.

create type contact_kind as enum ('recruiter', 'tech_recruiter', 'talent_acquisition', 'hiring_manager', 'team_member', 'other');
create type contact_status as enum ('found', 'invited', 'messaged', 'replied', 'ignored');

create table job_contacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  company text not null,
  name text not null,
  title text,
  kind contact_kind not null default 'other',
  linkedin_url text not null,
  why text,
  message_draft text,
  status contact_status not null default 'found',
  found_at timestamptz not null default now(),
  contacted_at timestamptz,
  unique (job_id, linkedin_url)
);

create index job_contacts_job_idx on job_contacts (job_id);
create index job_contacts_status_idx on job_contacts (status);

alter table jobs add column contacts_searched_at timestamptz;

create table dashboard_users (
  email text primary key
);

alter table job_contacts enable row level security;
alter table dashboard_users enable row level security;

create or replace function is_dashboard_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from dashboard_users where email = (select auth.jwt() ->> 'email'));
$$;

revoke execute on function is_dashboard_user() from public, anon;
grant execute on function is_dashboard_user() to authenticated;

create policy "dashboard reads jobs" on jobs for select to authenticated using ((select is_dashboard_user()));
create policy "dashboard triages jobs" on jobs for update to authenticated
  using ((select is_dashboard_user())) with check ((select is_dashboard_user()));
create policy "dashboard reads runs" on source_runs for select to authenticated using ((select is_dashboard_user()));
create policy "dashboard reads events" on application_events for select to authenticated using ((select is_dashboard_user()));
create policy "dashboard reads contacts" on job_contacts for select to authenticated using ((select is_dashboard_user()));
create policy "dashboard updates contacts" on job_contacts for update to authenticated
  using ((select is_dashboard_user())) with check ((select is_dashboard_user()));

-- No painel só dá para mudar o status (aprovar, pular) e marcar contato; o resto é do pipeline.
revoke update on jobs from authenticated;
grant update (status, status_reason) on jobs to authenticated;
revoke update on job_contacts from authenticated;
grant update (status, contacted_at) on job_contacts to authenticated;
revoke insert, delete on jobs, job_contacts, source_runs, application_events from authenticated;

-- Métricas do painel num só lugar. security invoker: respeita o RLS de quem chama.
-- Uma vaga vista em duas fontes conta para as duas em by_source; os totais contam a vaga uma vez.
create or replace function dashboard_metrics(since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with recent as (
    select * from jobs where first_seen_at >= since
  ),
  sightings as (
    select r.*, s.source_name from recent r cross join lateral unnest(r.sources) as s (source_name)
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'collected', count(*),
        'scored', count(*) filter (where score is not null),
        'above_70', count(*) filter (where score >= 70),
        'approved', count(*) filter (where status = 'approved'),
        'applied', count(*) filter (where status = 'applied'),
        'pending_me', count(*) filter (where status = 'pending_me'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'),
        'avg_score', round(avg(score)::numeric, 1)
      ) from recent
    ),
    'applied_in_period', (
      select count(*) from application_events where status = 'applied' and created_at >= since
    ),
    'by_source', coalesce((
      select jsonb_agg(row_to_json(t) order by t.collected desc) from (
        select source_name as source,
               count(*) as collected,
               count(*) filter (where score >= 70) as above_70,
               count(*) filter (where status = 'applied') as applied,
               round(avg(score)::numeric, 1) as avg_score
        from sightings group by source_name
      ) t
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day) from (
        select (first_seen_at at time zone 'America/Sao_Paulo')::date as day,
               count(*) as collected,
               count(*) filter (where score >= 70) as above_70
        from recent group by 1
      ) t
    ), '[]'::jsonb),
    'applied_by_day', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day) from (
        select (created_at at time zone 'America/Sao_Paulo')::date as day, count(*) as applied
        from application_events where status = 'applied' and created_at >= since group by 1
      ) t
    ), '[]'::jsonb),
    'last_runs', coalesce((
      select jsonb_agg(row_to_json(t) order by t.source) from (
        select distinct on (source) source, ok, fetched, kept, inserted, error, created_at
        from source_runs order by source, created_at desc
      ) t
    ), '[]'::jsonb),
    'contacts', (
      select jsonb_build_object(
        'found', count(*),
        'contacted', count(*) filter (where status in ('invited', 'messaged', 'replied')),
        'replied', count(*) filter (where status = 'replied')
      ) from job_contacts where found_at >= since
    )
  );
$$;

revoke execute on function dashboard_metrics(timestamptz) from public, anon;
grant execute on function dashboard_metrics(timestamptz) to authenticated, service_role;
