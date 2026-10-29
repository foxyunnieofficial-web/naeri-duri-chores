-- 내리두리 집안일: 테이블, 접근 규칙, 5분마다 알림 서버 호출
-- 배포할 때마다 실행돼요. 여러 번 실행해도 결과가 같아요.
create table if not exists household (id int primary key default 1, chores jsonb not null, prefs jsonb not null default '{}', updated_at timestamptz default now());
create table if not exists tasks (
  id text primary key, week date not null, chore_id text not null, who text not null, day date not null,
  status text not null default 'todo', done_at timestamptz, done_by text, postpone_count int not null default 0
);
create index if not exists tasks_day on tasks(day);
create index if not exists tasks_week on tasks(week);
create table if not exists logs (id text primary key, chore_id text not null, "by" text not null, date date not null, at bigint not null, task_id text);
create table if not exists weeks (monday date primary key, planned boolean not null default false, planned_by text);
create table if not exists push_subs (endpoint text primary key, person text not null, p256dh text not null, auth text not null, created_at timestamptz default now());
create table if not exists push_log (key text primary key, sent_at timestamptz default now());
create table if not exists public_config (key text primary key, value text);
create table if not exists app_secrets (key text primary key, value text);

alter table household enable row level security;
alter table tasks enable row level security;
alter table logs enable row level security;
alter table weeks enable row level security;
alter table push_subs enable row level security;
alter table push_log enable row level security;
alter table public_config enable row level security;
alter table app_secrets enable row level security;

-- 앱(공개 키)은 집안일 기록을 읽고 쓸 수 있어요. 알림 기록·비밀 값은 서버만.
grant select, insert, update, delete on household, tasks, logs, weeks, push_subs to anon, authenticated;
grant select on public_config to anon, authenticated;
grant all on household, tasks, logs, weeks, push_subs, push_log, public_config, app_secrets to service_role;
drop policy if exists "app all" on household;
create policy "app all" on household for all to anon, authenticated using (true) with check (true);
drop policy if exists "app all" on tasks;
create policy "app all" on tasks for all to anon, authenticated using (true) with check (true);
drop policy if exists "app all" on logs;
create policy "app all" on logs for all to anon, authenticated using (true) with check (true);
drop policy if exists "app all" on weeks;
create policy "app all" on weeks for all to anon, authenticated using (true) with check (true);
drop policy if exists "app all" on push_subs;
create policy "app all" on push_subs for all to anon, authenticated using (true) with check (true);
drop policy if exists "app read" on public_config;
create policy "app read" on public_config for select to anon, authenticated using (true);

insert into app_secrets(key, value) values ('cron', gen_random_uuid()::text) on conflict do nothing;

do $$
declare t text;
begin
  foreach t in array array['household', 'tasks', 'logs', 'weeks'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule('chore-tick', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://__PROJECT_REF__.supabase.co/functions/v1/tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where key = 'cron')),
    body := '{}'::jsonb
  );
$$);
