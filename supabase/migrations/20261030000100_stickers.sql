-- 했어요에 보내는 칭찬 스티커. 여러 번 실행해도 결과가 같아요.
create table if not exists stickers (
  id text primary key, log_id text not null, from_p text not null, to_p text not null, kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists stickers_log on stickers(log_id);
alter table stickers enable row level security;
drop policy if exists "app all" on stickers;
create policy "app all" on stickers for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on stickers to anon, authenticated;
grant all on stickers to service_role;
do $$
begin
  alter publication supabase_realtime add table stickers;
exception when duplicate_object then null;
end $$;
