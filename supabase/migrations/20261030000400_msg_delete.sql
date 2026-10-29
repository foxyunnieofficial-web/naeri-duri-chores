-- 받은 사람이 지운 메시지는 받은 사람 화면에서만 숨겨요. 여러 번 실행해도 결과가 같아요.
alter table messages add column if not exists del_to boolean not null default false;
