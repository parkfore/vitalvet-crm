// 고정 목록·기준값 (서버 config/crm.php 와 같은 값)

export type Op = 'view' | 'read' | 'create' | 'update' | 'delete';
export type Feature =
    | 'myday' | 'dash' | 'hospital' | 'eval' | 'activity' | 'conv' | 'map' | 'attendance'
    | 'report' | 'category' | 'team' | 'competitor' | 'history' | 'users' | 'settings';

export const OPS: [Op, string][] = [['view', '표시'], ['read', '읽기'], ['create', '입력'], ['update', '수정'], ['delete', '삭제']];
const ALL5: Op[] = ['view', 'read', 'create', 'update', 'delete'];

// [키, 이름, 가능한 동작, 설명]
export const FEATURES: [Feature, string, Op[], string][] = [
    ['myday', '오늘 할 일', ['view', 'read'], '내 담당 병원 기준 오늘 갈 곳·지연 팔로우업·내 메모'],
    ['dash', '대시보드', ['view', 'read'], '영업 현황 요약'],
    ['hospital', '병원 기본 정보', ALL5, '병원 등록·수정·삭제(복원), 단계·카테고리 지정'],
    ['eval', '리드 평가', ALL5, '수용도·호감도·수술 건수'],
    ['activity', '영업 활동', ALL5, '방문·전화 기록, 다음 액션'],
    ['conv', '전환·사용', ALL5, '회원가입일·사용 건수·비고'],
    ['map', '지도·동선', ['view', 'read'], '카테고리별 지도, 동선 짜기'],
    ['attendance', '근태 일정', ALL5, '연차·반차·교육 등 일정 신청·승인, 회사 휴일 (수정 범위가 담당만이면 본인 일정만)'],
    ['report', '영업 보고', ALL5, '일일 보고서 작성·검토·분석 (수정 범위가 담당만이면 본인 보고서만)'],
    ['category', '카테고리', ALL5, '카테고리 추가·변경·삭제'],
    ['team', '팀 성과', ALL5, '영업사원 역량 비교와 코칭 메모 (입력·수정·삭제는 코칭 메모)'],
    ['competitor', '경쟁사', ALL5, '경쟁사·경쟁 제품 정보 등록·수정·삭제'],
    ['history', '변경 이력', ['view', 'read'], '병원 타임라인, 전체 변경 이력'],
    ['users', '사용자·권한', ALL5, '가입 승인, 사용자·역할 관리'],
    ['settings', '설정', ['view', 'read', 'update'], '지도 연동, 등급 기준, 선택 목록'],
];
export const FNAME = Object.fromEntries(FEATURES.map(f => [f[0], f[1]])) as Record<Feature, string>;
export const SCOPED: Feature[] = ['hospital', 'eval', 'activity', 'conv'];

export const ACTION_LABEL: Record<string, string> = { create: '등록', update: '수정', delete: '삭제', restore: '복원' };
export const ENTITY_LABEL: Record<string, string> = { hospital: '병원', category: '카테고리', user: '사용자', role: '역할', settings: '설정', report: '영업 보고', attendance: '근태', competitor: '경쟁사' };

export const ACT_TYPES = ['방문', '전화', '문자/카톡', '이메일', '세미나/행사', '기타'];
export const ACT_PURPOSES = ['첫 소개', '제품 소개·시연', '추가 시연', '가입 상담', '가입 지원', '사용 교육', '정기 관리', '불만 대응', '후속 연락', '일정 조율', '사용 현황 확인', '자료 발송', '자료 안내'];
export const ACT_CONTACTS = ['원장', '봉직의', '실장', '테크니션', '기타'];
export const ACT_REACTIONS = ['긍정', '보통', '부정', '부재'];
export const VOC_TYPES = ['기능 요청', '불만/개선', '가격', '교육 요청', '칭찬'];
export const ISSUE_TYPES = ['자료 요청', '시연 장비', '기술 지원', '가격 승인', '기타'];
export const EXP_TYPES = ['주유·교통', '주차', '식대', '기타'];
export const WORK_TYPES = ['외근', '내근', '교육', '출장'];
export const LEAD_SOURCES = ['전시회', '광고', '세미나', '지인추천', '고객추천', '방문영업', '행사영업'];
export const CAT_COLORS = ['#0B6E63', '#2E90FA', '#9460E0', '#D16A06', '#D92D20', '#C11574', '#4E5BA6', '#6E7F2E'];
export const STAGE_COLORS = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)', 'var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)', 'var(--v5)', 'var(--v7)'];
export const TRIGGERS: Record<string, string> = { contact: '첫 접촉 기록 시', visit1: '첫 방문 기록 시', visit2: '두 번째 방문 기록 시', signup: '회원가입일 입력 시', use: '사용 건수 입력 시' };

// 미접촉(예정) 구분
export const PRE_TYPES: Record<string, [string, string]> = { call: ['연락 예정', 'var(--info)'], visit: ['방문 예정', 'var(--ok)'], send: ['자료전송 예정', 'var(--s4)'] };

// 리드 평가: 항목별 0~5점, 합계 11~15 상 / 6~10 중 / 0~5 하
export const EVAL_MAX = 5;
export const EVAL_TOTAL = EVAL_MAX * 3;
export const EVAL_ITEMS: [string, string, string][] = [
    ['adoption', '디지털 수용도', '태블릿·전자차트·온라인 서비스 활용 정도. 근거 화면을 캡처해 올려 두세요'],
    ['favor', '서비스 호감도', 'VitalVET 서비스에 대한 관심과 호의'],
    ['surgeries', '월 마취 건수', '월 평균 마취·수술 규모'],
];
export const MAX_SHOTS = 4;

export const REP_ST: Record<string, [string, string]> = { draft: ['임시 저장', 'rs-draft'], submitted: ['제출', 'rs-submitted'], confirmed: ['확인', 'rs-confirmed'], returned: ['반려', 'rs-returned'] };

export const COMP_TYPES = ['마취 기록 앱', '전자차트(EMR) 부가 모듈', '모니터 제조사 번들', '수기·외주 대행', '기타'];
export const THREAT: Record<string, string> = { 높음: 'a-delete', 중간: 'f-오늘', 낮음: 'f-없음' };

export const USERNAME_RE = /^[a-z][a-z0-9._-]{3,29}$/;

// 근태 유형: off=근무 안 함(방문 목표 0), half=반차(0.5일, 목표 절반), goal0=근무하지만 방문 목표 0
export const ATT: Record<string, { off?: boolean; half?: boolean; goal0?: boolean; short: string; color: string }> = {
    '연차': { off: true, short: '연', color: 'var(--v1)' }, '오전 반차': { half: true, short: '오전', color: 'var(--v3)' }, '오후 반차': { half: true, short: '오후', color: 'var(--v3)' },
    '병가': { off: true, short: '병', color: 'var(--v8)' }, '경조사': { off: true, short: '경', color: 'var(--v5)' }, '교육': { goal0: true, short: '교', color: 'var(--v7)' }, '출장': { short: '출', color: 'var(--v2)' },
};
export const ATT_ST: Record<string, [string, string]> = { requested: ['승인 대기', 'st-pending'], approved: ['승인', 'st-active'], rejected: ['반려', 'a-delete'], canceled: ['취소', 'st-inactive'] };

export const MAP_MODE_LABEL: Record<string, string> = { sido: '시·도별 개수 · 원을 누르거나 확대하면 구 단위로', sgg: '시·군·구별 개수 · 원을 누르거나 확대하면 병원별로', pin: '병원별 보기 · 축소하면 지역별 개수로' };

export const NAV_APPS: Record<string, { name: string; max: number; note: string }> = {
    kakaomap: { name: '카카오맵', max: 7, note: '출발지 포함 최대 7곳(경유지 5곳)을 한 번에 넘깁니다. PC·모바일 모두 열립니다.' },
    kakaonavi: { name: '카카오내비', max: 4, note: '현재 위치에서 출발해 최대 4곳(경유지 3곳)을 안내합니다. 휴대폰에 카카오내비 앱이 있어야 하며, 카카오 JavaScript 키와 콘솔의 카카오내비 사용 설정이 필요합니다.' },
    tmap: { name: '티맵', max: 1, note: '티맵 앱 연결 주소는 목적지 1곳만 받습니다. 한 곳씩 차례로 안내합니다. 휴대폰에 티맵 앱이 있어야 합니다.' },
};

// 팀 성과 7개 지표
export const AXES: [string, string][] = [['activity', '활동량'], ['coverage', '관리 범위'], ['progress', '단계 진척'], ['followup', '팔로우업'], ['report', '보고 성실도'], ['response', '고객 반응'], ['quality', '평가 입력']];
export const AXIS_HELP: Record<string, string> = { activity: '방문 수 ÷ 근무일 방문 목표 합', coverage: '담당 병원 중 최근 14일 안에 접촉한 비율', progress: '담당 병원 단계 진전 건수 (팀 최고 = 100)', followup: '다음 액션 중 기한을 넘기지 않은 비율', report: '근무일 중 보고서를 제출한 비율', response: '방문·통화 반응 중 긍정 비율 (부재 제외)', quality: '접촉한 담당 병원 중 리드 평가를 다 입력한 비율' };
