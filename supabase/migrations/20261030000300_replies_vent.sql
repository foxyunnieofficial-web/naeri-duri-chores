-- 메시지 답장, 두리의 매일 환기하기. 여러 번 실행해도 결과가 같아요.
alter table messages add column if not exists reply_to text;

update household
set chores = chores || '[{"id":"vent","name":"환기하기","who":"두리","mins":5,"freq":"daily","at":"08:00","note":"창문 열고 5분"}]'::jsonb
where id = 1 and not exists (select 1 from jsonb_array_elements(chores) e where e->>'id' = 'vent');
