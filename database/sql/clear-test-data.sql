-- =====================================================================
-- VitalVET CRM · 테스트 데이터 지우기 (실제 사용 시작 전에 한 번)
-- ---------------------------------------------------------------------
-- 사용법: Supabase → SQL Editor → 붙여넣기 → Run
-- 같은 일을 서버에서 하려면:  php artisan crm:clear-test-data
--   (명령어 쪽은 서버에 올린 리드 평가 이미지 파일까지 지워 줍니다. 가능하면 명령어를 쓰세요)
--
-- 지워지는 것: 병원, 영업 활동, 리드 평가 이미지 기록, 단계 이력, 변경 이력, 경쟁사,
--             관리자를 제외한 모든 사용자
-- 남는 것:     관리자 계정, 역할·권한, 영업 단계, 카테고리, 선택 목록, 설정
-- 되돌릴 수 없습니다.
-- =====================================================================

BEGIN;

DELETE FROM public.eval_shots;
DELETE FROM public.activities;
DELETE FROM public.stage_history;
DELETE FROM public.category_hospital;
DELETE FROM public.audit_logs;
DELETE FROM public.hospitals;
DELETE FROM public.competitors;

DELETE FROM public.sessions
WHERE user_id IS NULL
   OR user_id NOT IN (SELECT u.id FROM public.users u JOIN public.roles r ON r.id = u.role_id WHERE r.locked);

DELETE FROM public.users
WHERE role_id IS NULL
   OR role_id NOT IN (SELECT id FROM public.roles WHERE locked);

-- 병원 코드(VV-0001)가 다시 1번부터 시작하도록
SELECT setval(pg_get_serial_sequence('public.hospitals', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.activities', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.audit_logs', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.stage_history', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.eval_shots', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.competitors', 'id'), 1, false);

COMMIT;

-- 확인: 병원 0, 사용자 = 관리자 수
SELECT (SELECT count(*) FROM public.hospitals) AS hospitals, (SELECT count(*) FROM public.users) AS users;
