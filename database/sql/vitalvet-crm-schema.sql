-- VitalVET 영업 CRM 테이블 구조 (참고용, PostgreSQL / Supabase)
-- 실제 적용은 서버에서 php artisan migrate 로 합니다. 이 파일은 개발자 참고·수동 적용용입니다.

CREATE TABLE public.app_settings (
    key character varying(40) NOT NULL,
    value json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.attendance (
    id character varying(40) NOT NULL,
    user_id character varying(40) NOT NULL,
    status character varying(12) NOT NULL,
    from_date character varying(10) NOT NULL,
    to_date character varying(10) NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.audit_logs (
    id character varying(40) NOT NULL,
    ts character varying(30) NOT NULL,
    user_id character varying(40),
    entity character varying(20) NOT NULL,
    entity_id character varying(40),
    hospital_id character varying(20),
    data json NOT NULL,
    created_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration bigint NOT NULL
);
CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration bigint NOT NULL
);
CREATE TABLE public.categories (
    id character varying(40) NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.coaching (
    id character varying(40) NOT NULL,
    user_id character varying(40) NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.competitors (
    id character varying(40) NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.eval_shots (
    id character varying(40) NOT NULL,
    hospital_id character varying(20) NOT NULL,
    mime character varying(40) NOT NULL,
    data text NOT NULL,
    created_by character varying(40),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection character varying(255) NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;
CREATE TABLE public.hospitals (
    id character varying(20) NOT NULL,
    name character varying(120) NOT NULL,
    owner_id character varying(40),
    stage character varying(60) NOT NULL,
    deleted_at character varying(10),
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
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
CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);
CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;
CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);
CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;
CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);
CREATE TABLE public.reports (
    id character varying(40) NOT NULL,
    author_id character varying(40) NOT NULL,
    date character varying(10) NOT NULL,
    status character varying(12) NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.roles (
    id character varying(40) NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id character varying(40),
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);
CREATE TABLE public.stages (
    id character varying(40) NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.todos (
    id character varying(40) NOT NULL,
    user_id character varying(40) NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE TABLE public.users (
    id character varying(40) NOT NULL,
    username character varying(30) NOT NULL,
    password character varying(255) NOT NULL,
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    role_id character varying(40),
    data json NOT NULL,
    last_login_at timestamp(0) without time zone,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);
ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);
ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);
ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.coaching
    ADD CONSTRAINT coaching_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.eval_shots
    ADD CONSTRAINT eval_shots_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);
ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);
ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_author_id_date_unique UNIQUE (author_id, date);
ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);
CREATE INDEX attendance_user_id_index ON public.attendance USING btree (user_id);
CREATE INDEX audit_logs_entity_id_index ON public.audit_logs USING btree (entity_id);
CREATE INDEX audit_logs_entity_index ON public.audit_logs USING btree (entity);
CREATE INDEX audit_logs_hospital_id_index ON public.audit_logs USING btree (hospital_id);
CREATE INDEX audit_logs_ts_index ON public.audit_logs USING btree (ts);
CREATE INDEX audit_logs_user_id_index ON public.audit_logs USING btree (user_id);
CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);
CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);
CREATE INDEX coaching_user_id_index ON public.coaching USING btree (user_id);
CREATE INDEX eval_shots_hospital_id_index ON public.eval_shots USING btree (hospital_id);
CREATE INDEX failed_jobs_connection_queue_failed_at_index ON public.failed_jobs USING btree (connection, queue, failed_at);
CREATE INDEX hospitals_name_index ON public.hospitals USING btree (name);
CREATE INDEX hospitals_owner_id_index ON public.hospitals USING btree (owner_id);
CREATE INDEX hospitals_stage_index ON public.hospitals USING btree (stage);
CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);
CREATE INDEX reports_author_id_index ON public.reports USING btree (author_id);
CREATE INDEX reports_date_index ON public.reports USING btree (date);
CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);
CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);
CREATE INDEX todos_user_id_index ON public.todos USING btree (user_id);
CREATE INDEX users_role_id_index ON public.users USING btree (role_id);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
