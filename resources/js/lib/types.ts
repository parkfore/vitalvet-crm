// 서버(API)가 주고받는 데이터 모양. docs/openapi 와 같은 기준.

export type Op = 'view' | 'read' | 'create' | 'update' | 'delete';
export type PermMap = Record<string, Record<Op, boolean>>;
export type Level = 0 | 1 | 2 | 3 | 4 | 5;
export type Grade = '상' | '중' | '하' | '미평가';
export type Follow = '지연' | '오늘' | '예정' | '완료' | '없음';

export interface User {
    id: number;
    name: string;
    username: string;
    email: string | null;
    team: string | null;
    phone: string | null;
    role_id: number | null;
    role_name: string | null;
    status: 'pending' | 'active' | 'inactive';
    annual_leave: number;
    created_at: string | null;
    last_login_at: string | null;
    hospitals?: number;
}

export interface Me {
    user: User;
    perms: PermMap;
    scope: 'all' | 'own';
    is_admin: boolean;
}

export interface Stage {
    id: number;
    name: string;
    kind: 'main' | 'exit';
    trigger: string | null;
    color: string;
    sort: number;
}

export interface Category {
    id: number;
    name: string;
    description: string | null;
    color: string;
    sort: number;
}

export interface Meta {
    stages: Stage[];
    categories: Category[];
    codes: Record<string, string[]>;
    users: { id: number; name: string; team: string | null; role_name: string | null }[];
    competitors: { id: number; name: string }[];
    features: { key: string; name: string; ops: Op[]; desc: string }[];
    triggers: Record<string, string>;
    pre_types: Record<string, [string, string]>;
    lead_sources: string[];
    eval_items: Record<'adoption' | 'favor' | 'surgeries', [string, string]>;
    eval_max: number;
    eval_grades: { 상: number; 중: number };
    eval_max_shots: number;
    activity_types: string[];
    activity_purposes: string[];
    activity_contacts: string[];
    activity_reactions: string[];
    voc_types: string[];
    issue_types: string[];
    category_colors: string[];
    visit_goal: number;
    today: string;
}

export interface HospitalItem {
    id: number;
    code: string | null;
    name: string;
    address: string;
    sido: string | null;
    sigungu: string | null;
    grade: string | null;
    specialty: string | null;
    director: string | null;
    phone: string | null;
    owner_id: number | null;
    stage_id: number;
    pre_type: string | null;
    sources: string[];
    category_ids: number[];
    eval_sum: number | null;
    eval_grade: Grade | null;
    next_date: string | null;
    next_todo: string | null;
    follow: Follow | null;
    lat: number | null;
    lng: number | null;
    deleted_at: string | null;
    created_at: string | null;
}

export interface Activity {
    id: number;
    hospital_id: number;
    author_id: number | null;
    author_name: string | null;
    type: string;
    date: string;
    purpose: string | null;
    contact: string | null;
    reaction: string | null;
    note: string | null;
    voc_type: string | null;
    voc_text: string | null;
    comp_id: number | null;
    comp_text: string | null;
    issue_type: string | null;
    issue_text: string | null;
}

export type Can = Record<'hospital' | 'eval' | 'activity' | 'conv', Record<'create' | 'update' | 'delete', boolean>>;

export interface HospitalDetail extends HospitalItem {
    zip: string | null;
    jibun: string | null;
    address_detail: string | null;
    director_phone: string | null;
    vet_count: number | null;
    competitor_id: number | null;
    competitor_until: string | null;
    eval?: {
        adoption: Level | null;
        favor: Level | null;
        surgeries: Level | null;
        surgery_count: number | null;
        date: string | null;
        shots: { id: number; name: string | null; url: string }[];
    };
    next_done?: boolean;
    signup_date?: string | null;
    usage_count?: number;
    last_used_date?: string | null;
    conv_note?: string | null;
    memo: string | null;
    activities?: Activity[];
    stage_history?: { id: number; date: string; from_stage: string | null; to_stage: string; auto: boolean; changed_by: number | null }[];
    can: Can;
    can_eval_stage: boolean;
}

export interface AuditItem {
    id: number;
    at: string;
    actor_id: number | null;
    actor_name: string | null;
    entity: string;
    entity_id: string;
    hospital_id: number | null;
    target_name: string | null;
    action: 'create' | 'update' | 'delete' | 'restore';
    section: string | null;
    summary: string | null;
    changes: { field: string; before: string; after: string }[];
}

export interface Role {
    id: number;
    key: string | null;
    name: string;
    description: string | null;
    scope: 'all' | 'own';
    locked: boolean;
    permissions: PermMap;
    users_count: number;
}
