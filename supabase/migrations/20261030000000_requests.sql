-- 서로에게 일 부탁하기. 여러 번 실행해도 결과가 같아요.
create table if not exists requests (
  id text primary key, from_p text not null, to_p text not null, title text not null,
  chore_id text, task_id text, due text, msg text not null,
  status text not null default 'open', created_at timestamptz not null default now(), done_at timestamptz
);
alter table requests enable row level security;
drop policy if exists "app all" on requests;
create policy "app all" on requests for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on requests to anon, authenticated;
grant all on requests to service_role;
do $$
begin
  alter publication supabase_realtime add table requests;
exception when duplicate_object then null;
end $$;
-- 직접 쓴 부탁을 해줬을 때 별 기록에 이름을 남겨요
alter table logs add column if not exists title text;
