-- 엄마가 보내는 메시지와 하트. 여러 번 실행해도 결과가 같아요.
create table if not exists messages (
  id text primary key, from_p text not null, to_p text not null, msg text not null,
  heart boolean not null default false, created_at timestamptz not null default now()
);
alter table messages enable row level security;
drop policy if exists "app all" on messages;
create policy "app all" on messages for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on messages to anon, authenticated;
grant all on messages to service_role;
do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;
