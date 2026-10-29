-- 오늘 집 소식(두리 점심·저녁, 내리 귀가)과 "확인했어". 여러 번 실행해도 결과가 같아요.
alter table messages add column if not exists kind text;
alter table messages add column if not exists ack_at timestamptz;
