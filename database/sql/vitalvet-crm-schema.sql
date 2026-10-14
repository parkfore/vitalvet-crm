-- =====================================================================
-- VitalVET CRM · 데이터베이스 전체 생성 SQL (PostgreSQL / Supabase)
-- ---------------------------------------------------------------------
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 이 파일 내용 전체 붙여넣기 → Run
--
-- ※ 권장 방법은 서버에서 `php artisan migrate --seed --force` 실행입니다 (결과는 이 파일과 동일).
--   이 파일은 그 결과를 그대로 뽑은 것이라, 둘 중 하나만 하면 됩니다.
--   이 파일로 만든 뒤 나중에 migrate 를 실행해도 이미 만든 표는 건너뜁니다 (migrations 표에 기록 포함).
--
-- 만들어지는 것
--   · 표 21개 (병원, 영업 활동, 리드 평가 이미지, 단계 이력, 변경 이력, 사용자, 역할 등)
--   · 기본 데이터: 역할 4개(관리자·영업팀장·영업사원·조회 전용), 영업 단계 9개,
--     병원 등급·전문과 목록, 카테고리 ‘중점 관리’, 일일 방문 목표 4
--   · 모든 표에 RLS(행 수준 보안) 켜짐 → Supabase Data API 로는 읽기·쓰기 불가 (앱만 접근)
--
-- 만들어지지 않는 것
--   · 관리자 계정: 비밀번호 암호화 때문에 SQL 대신 서버에서
--       php artisan crm:admin
--     로 만듭니다.
--
-- 주의: 비어 있는 데이터베이스에서 한 번만 실행하세요. 표가 이미 있으면 오류가 납니다.
-- =====================================================================

BEGIN;
--
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    author_id bigint,
    type character varying(20) NOT NULL,
    date date NOT NULL,
    purpose character varying(40),
    contact character varying(20),
    reaction character varying(10),
    note text,
    voc_type character varying(20),
    voc_text text,
    comp_id bigint,
    comp_text text,
    issue_type character varying(20),
    issue_text text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activities_id_seq OWNED BY public.activities.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actor_id bigint,
    actor_name character varying(40),
    entity character varying(20) NOT NULL,
    entity_id character varying(40) NOT NULL,
    hospital_id bigint,
    target_name character varying(120),
    action character varying(10) NOT NULL,
    section character varying(40),
    summary character varying(200),
    changes json NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    name character varying(40) NOT NULL,
    description character varying(200),
    color character varying(20) NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: category_hospital; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_hospital (
    hospital_id bigint NOT NULL,
    category_id bigint NOT NULL
);


--
-- Name: code_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.code_items (
    id bigint NOT NULL,
    grp character varying(20) NOT NULL,
    value character varying(40) NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


--
-- Name: code_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.code_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: code_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.code_items_id_seq OWNED BY public.code_items.id;


--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    company character varying(100),
    type character varying(40),
    threat character varying(10) DEFAULT 'mid'::character varying NOT NULL,
    website character varying(300),
    phone character varying(20),
    zip character varying(10),
    address character varying(200),
    address_detail character varying(100),
    regions character varying(200),
    strengths text,
    weaknesses text,
    counter text,
    memo text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: competitors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competitors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competitors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competitors_id_seq OWNED BY public.competitors.id;


--
-- Name: eval_shots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_shots (
    id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    path character varying(300) NOT NULL,
    name character varying(200),
    mime character varying(60),
    size integer,
    uploaded_by bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: eval_shots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eval_shots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eval_shots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eval_shots_id_seq OWNED BY public.eval_shots.id;


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection character varying(255) NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospitals (
    id bigint NOT NULL,
    code character varying(12),
    name character varying(100) NOT NULL,
    zip character varying(10),
    address character varying(200) NOT NULL,
    jibun character varying(200),
    address_detail character varying(100),
    sido character varying(20),
    sigungu character varying(30),
    lat numeric(9,6),
    lng numeric(9,6),
    grade character varying(20),
    specialty character varying(40),
    phone character varying(20),
    director character varying(40),
    director_phone character varying(20),
    vet_count smallint,
    owner_id bigint,
    stage_id bigint NOT NULL,
    pre_type character varying(10),
    sources json,
    eval_adoption smallint,
    eval_favor smallint,
    eval_surgeries smallint,
    eval_surgery_count integer,
    eval_date date,
    next_todo character varying(200),
    next_date date,
    next_done boolean DEFAULT false NOT NULL,
    signup_date date,
    usage_count integer DEFAULT 0 NOT NULL,
    last_used_date date,
    conv_note text,
    competitor_id bigint,
    competitor_until date,
    memo text,
    created_by bigint,
    deleted_at timestamp(0) without time zone,
    deleted_by bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: hospitals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hospitals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hospitals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hospitals_id_seq OWNED BY public.hospitals.id;


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    key character varying(40),
    name character varying(40) NOT NULL,
    description character varying(200),
    scope character varying(10) DEFAULT 'all'::character varying NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    permissions json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(40) NOT NULL,
    value json NOT NULL
);


--
-- Name: stage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stage_history (
    id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    date date NOT NULL,
    from_stage character varying(30),
    to_stage character varying(30) NOT NULL,
    changed_by bigint,
    auto boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: stage_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stage_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stage_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stage_history_id_seq OWNED BY public.stage_history.id;


--
-- Name: stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stages (
    id bigint NOT NULL,
    name character varying(30) NOT NULL,
    kind character varying(10) NOT NULL,
    trigger character varying(20),
    color character varying(20) NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: stages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stages_id_seq OWNED BY public.stages.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    team character varying(40),
    phone character varying(20),
    role_id bigint,
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    annual_leave numeric(4,1) DEFAULT '15'::numeric NOT NULL,
    last_login_at timestamp(0) without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities ALTER COLUMN id SET DEFAULT nextval('public.activities_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: code_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_items ALTER COLUMN id SET DEFAULT nextval('public.code_items_id_seq'::regclass);


--
-- Name: competitors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors ALTER COLUMN id SET DEFAULT nextval('public.competitors_id_seq'::regclass);


--
-- Name: eval_shots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_shots ALTER COLUMN id SET DEFAULT nextval('public.eval_shots_id_seq'::regclass);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: hospitals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals ALTER COLUMN id SET DEFAULT nextval('public.hospitals_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: stage_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_history ALTER COLUMN id SET DEFAULT nextval('public.stage_history_id_seq'::regclass);


--
-- Name: stages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages ALTER COLUMN id SET DEFAULT nextval('public.stages_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cache; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cache_locks; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.categories VALUES
	(1, '중점 관리', '이번 분기 집중 영업 대상', '#0B6E63', 0, '2026-10-14 22:25:37', '2026-10-14 22:25:37');


--
-- Data for Name: category_hospital; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: code_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.code_items VALUES
	(1, 'grade', '1차', 0),
	(2, 'grade', '1.5차', 1),
	(3, 'grade', '2차', 2),
	(4, 'specialty', '일반진료', 0),
	(5, 'specialty', '내과', 1),
	(6, 'specialty', '외과', 2),
	(7, 'specialty', '정형외과', 3),
	(8, 'specialty', '피부과', 4),
	(9, 'specialty', '안과', 5),
	(10, 'specialty', '치과', 6),
	(11, 'specialty', '영상의학', 7),
	(12, 'specialty', '응급/중환자', 8),
	(13, 'specialty', '종양', 9),
	(14, 'specialty', '고양이 전문', 10),
	(15, 'specialty', '특수동물', 11),
	(16, 'specialty', '기타', 12);


--
-- Data for Name: competitors; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: eval_shots; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: failed_jobs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hospitals; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: job_batches; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.migrations VALUES
	(1, '0001_01_01_000000_create_users_table', 1),
	(2, '0001_01_01_000001_create_cache_table', 1),
	(3, '0001_01_01_000002_create_jobs_table', 1),
	(4, '2026_10_15_000001_create_crm_tables', 1),
	(5, '2026_10_15_000002_enable_row_level_security', 1);


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles VALUES
	(1, 'admin', '관리자', '모든 기능과 권한 관리', 'all', true, '{"myday":{"view":true,"read":true,"create":false,"update":false,"delete":false},"dash":{"view":true,"read":true,"create":false,"update":false,"delete":false},"hospital":{"view":true,"read":true,"create":true,"update":true,"delete":true},"eval":{"view":true,"read":true,"create":true,"update":true,"delete":true},"activity":{"view":true,"read":true,"create":true,"update":true,"delete":true},"conv":{"view":true,"read":true,"create":true,"update":true,"delete":true},"map":{"view":true,"read":true,"create":false,"update":false,"delete":false},"attendance":{"view":true,"read":true,"create":true,"update":true,"delete":true},"report":{"view":true,"read":true,"create":true,"update":true,"delete":true},"category":{"view":true,"read":true,"create":true,"update":true,"delete":true},"team":{"view":true,"read":true,"create":true,"update":true,"delete":true},"competitor":{"view":true,"read":true,"create":true,"update":true,"delete":true},"history":{"view":true,"read":true,"create":false,"update":false,"delete":false},"users":{"view":true,"read":true,"create":true,"update":true,"delete":true},"settings":{"view":true,"read":true,"create":false,"update":true,"delete":false}}', '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(2, 'lead', '영업팀장', '전체 병원 관리, 사용자는 조회만', 'all', false, '{"myday":{"view":true,"read":true,"create":false,"update":false,"delete":false},"dash":{"view":true,"read":true,"create":false,"update":false,"delete":false},"hospital":{"view":true,"read":true,"create":true,"update":true,"delete":true},"eval":{"view":true,"read":true,"create":true,"update":true,"delete":true},"activity":{"view":true,"read":true,"create":true,"update":true,"delete":true},"conv":{"view":true,"read":true,"create":true,"update":true,"delete":true},"map":{"view":true,"read":true,"create":false,"update":false,"delete":false},"attendance":{"view":true,"read":true,"create":true,"update":true,"delete":true},"report":{"view":true,"read":true,"create":true,"update":true,"delete":true},"category":{"view":true,"read":true,"create":true,"update":true,"delete":true},"team":{"view":true,"read":true,"create":true,"update":true,"delete":true},"competitor":{"view":true,"read":true,"create":true,"update":true,"delete":true},"history":{"view":true,"read":true,"create":false,"update":false,"delete":false},"users":{"view":true,"read":true,"create":false,"update":false,"delete":false},"settings":{"view":true,"read":true,"create":false,"update":false,"delete":false}}', '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(3, 'sales', '영업사원', '담당 병원만 수정, 삭제 불가', 'own', false, '{"myday":{"view":true,"read":true,"create":false,"update":false,"delete":false},"dash":{"view":true,"read":true,"create":false,"update":false,"delete":false},"hospital":{"view":true,"read":true,"create":true,"update":true,"delete":false},"eval":{"view":true,"read":true,"create":true,"update":true,"delete":true},"activity":{"view":true,"read":true,"create":true,"update":true,"delete":true},"conv":{"view":true,"read":true,"create":true,"update":true,"delete":false},"map":{"view":true,"read":true,"create":false,"update":false,"delete":false},"attendance":{"view":true,"read":true,"create":true,"update":false,"delete":true},"report":{"view":true,"read":true,"create":true,"update":true,"delete":true},"category":{"view":true,"read":true,"create":false,"update":false,"delete":false},"team":{"view":false,"read":false,"create":false,"update":false,"delete":false},"competitor":{"view":true,"read":true,"create":true,"update":false,"delete":false},"history":{"view":true,"read":true,"create":false,"update":false,"delete":false},"users":{"view":false,"read":false,"create":false,"update":false,"delete":false},"settings":{"view":false,"read":false,"create":false,"update":false,"delete":false}}', '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(4, 'viewer', '조회 전용', '마케팅·경영지원용, 전환·사용 숨김', 'all', false, '{"myday":{"view":false,"read":false,"create":false,"update":false,"delete":false},"dash":{"view":true,"read":true,"create":false,"update":false,"delete":false},"hospital":{"view":true,"read":true,"create":false,"update":false,"delete":false},"eval":{"view":true,"read":true,"create":false,"update":false,"delete":false},"activity":{"view":true,"read":true,"create":false,"update":false,"delete":false},"conv":{"view":false,"read":false,"create":false,"update":false,"delete":false},"map":{"view":true,"read":true,"create":false,"update":false,"delete":false},"attendance":{"view":true,"read":true,"create":true,"update":false,"delete":true},"report":{"view":false,"read":false,"create":false,"update":false,"delete":false},"category":{"view":true,"read":true,"create":false,"update":false,"delete":false},"team":{"view":false,"read":false,"create":false,"update":false,"delete":false},"competitor":{"view":true,"read":true,"create":false,"update":false,"delete":false},"history":{"view":false,"read":false,"create":false,"update":false,"delete":false},"users":{"view":false,"read":false,"create":false,"update":false,"delete":false},"settings":{"view":false,"read":false,"create":false,"update":false,"delete":false}}', '2026-10-14 22:25:37', '2026-10-14 22:25:37');


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.settings VALUES
	('visit_goal', '{"v":4}');


--
-- Data for Name: stage_history; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: stages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.stages VALUES
	(1, '미접촉(예정)', 'main', NULL, '#8A9794', 0, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(2, '접촉/리드', 'main', 'contact', '#5B7FA6', 1, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(3, '1차 방문', 'main', 'visit1', '#2E90FA', 2, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(4, '2차 방문', 'main', 'visit2', '#5A67E8', 3, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(5, '회원가입', 'main', 'signup', '#9460E0', 4, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(6, 'VitalVet 사용', 'main', 'use', '#12A66A', 5, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(7, '활성 고객', 'main', NULL, '#067647', 6, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(8, '보류', 'exit', NULL, '#D16A06', 7, '2026-10-14 22:25:37', '2026-10-14 22:25:37'),
	(9, 'Lost', 'exit', NULL, '#B42318', 8, '2026-10-14 22:25:37', '2026-10-14 22:25:37');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activities_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 1, true);


--
-- Name: code_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.code_items_id_seq', 16, true);


--
-- Name: competitors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.competitors_id_seq', 1, false);


--
-- Name: eval_shots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.eval_shots_id_seq', 1, false);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.failed_jobs_id_seq', 1, false);


--
-- Name: hospitals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hospitals_id_seq', 1, false);


--
-- Name: jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.jobs_id_seq', 1, false);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 5, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 4, true);


--
-- Name: stage_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stage_history_id_seq', 1, false);


--
-- Name: stages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stages_id_seq', 9, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: categories categories_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_unique UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: category_hospital category_hospital_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_hospital
    ADD CONSTRAINT category_hospital_pkey PRIMARY KEY (hospital_id, category_id);


--
-- Name: code_items code_items_grp_value_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_items
    ADD CONSTRAINT code_items_grp_value_unique UNIQUE (grp, value);


--
-- Name: code_items code_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_items
    ADD CONSTRAINT code_items_pkey PRIMARY KEY (id);


--
-- Name: competitors competitors_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_name_unique UNIQUE (name);


--
-- Name: competitors competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);


--
-- Name: eval_shots eval_shots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_shots
    ADD CONSTRAINT eval_shots_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: hospitals hospitals_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_code_unique UNIQUE (code);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: roles roles_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_unique UNIQUE (key);


--
-- Name: roles roles_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_unique UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: stage_history stage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_history
    ADD CONSTRAINT stage_history_pkey PRIMARY KEY (id);


--
-- Name: stages stages_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_name_unique UNIQUE (name);


--
-- Name: stages stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_pkey PRIMARY KEY (id);


--
-- Name: stages stages_trigger_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_trigger_unique UNIQUE (trigger);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activities_author_id_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_author_id_date_index ON public.activities USING btree (author_id, date);


--
-- Name: activities_hospital_id_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_hospital_id_date_index ON public.activities USING btree (hospital_id, date);


--
-- Name: audit_logs_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_at_index ON public.audit_logs USING btree (at);


--
-- Name: audit_logs_entity_entity_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_entity_entity_id_index ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: audit_logs_hospital_id_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_hospital_id_at_index ON public.audit_logs USING btree (hospital_id, at);


--
-- Name: cache_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);


--
-- Name: cache_locks_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);


--
-- Name: failed_jobs_connection_queue_failed_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX failed_jobs_connection_queue_failed_at_index ON public.failed_jobs USING btree (connection, queue, failed_at);


--
-- Name: hospitals_next_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hospitals_next_date_index ON public.hospitals USING btree (next_date);


--
-- Name: hospitals_owner_id_deleted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hospitals_owner_id_deleted_at_index ON public.hospitals USING btree (owner_id, deleted_at);


--
-- Name: hospitals_stage_id_deleted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hospitals_stage_id_deleted_at_index ON public.hospitals USING btree (stage_id, deleted_at);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: activities activities_author_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_author_id_foreign FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: activities activities_comp_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_comp_id_foreign FOREIGN KEY (comp_id) REFERENCES public.competitors(id) ON DELETE SET NULL;


--
-- Name: activities activities_hospital_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_hospital_id_foreign FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_foreign FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: category_hospital category_hospital_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_hospital
    ADD CONSTRAINT category_hospital_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: category_hospital category_hospital_hospital_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_hospital
    ADD CONSTRAINT category_hospital_hospital_id_foreign FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;


--
-- Name: eval_shots eval_shots_hospital_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_shots
    ADD CONSTRAINT eval_shots_hospital_id_foreign FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;


--
-- Name: eval_shots eval_shots_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_shots
    ADD CONSTRAINT eval_shots_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hospitals hospitals_competitor_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_competitor_id_foreign FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE SET NULL;


--
-- Name: hospitals hospitals_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hospitals hospitals_deleted_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_deleted_by_foreign FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hospitals hospitals_owner_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_owner_id_foreign FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hospitals hospitals_stage_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_stage_id_foreign FOREIGN KEY (stage_id) REFERENCES public.stages(id);


--
-- Name: stage_history stage_history_changed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_history
    ADD CONSTRAINT stage_history_changed_by_foreign FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stage_history stage_history_hospital_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_history
    ADD CONSTRAINT stage_history_hospital_id_foreign FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cache ENABLE ROW LEVEL SECURITY;

--
-- Name: cache_locks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cache_locks ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: category_hospital; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category_hospital ENABLE ROW LEVEL SECURITY;

--
-- Name: code_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.code_items ENABLE ROW LEVEL SECURITY;

--
-- Name: competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: eval_shots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eval_shots ENABLE ROW LEVEL SECURITY;

--
-- Name: failed_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: hospitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

--
-- Name: job_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: stage_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;

--
-- Name: stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
--


COMMIT;
