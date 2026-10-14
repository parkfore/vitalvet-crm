/*
 * 업무 규칙·계산 (화면과 무관한 순수 로직)
 * 권한 확인, 리드 등급, 팔로우업 상태, 자동 단계 전환, 변경 이력, 영업 보고 집계, 근태 계산, 팀 성과 지표
 */
import { ATT, ATT_ST, AXES, EVAL_TOTAL, FNAME, OPS, PRE_TYPES, REP_ST, SCOPED, type Feature, type Op } from './constants';
import { MAIN_N, S, STAGES, save, toast, ui } from './store';
import type { Attendance, AuditEntry, Change, Competitor, Hospital, Report, User } from './types';
import { addDays, dday, distKm, fd, fmtD, fmtTs, today, uid, won } from './utils';

/* ---------------- 사용자·권한 ---------------- */
export const cur = (): User | undefined => (S ? S.users.find(u => u.id === S.session && u.status === 'active') : undefined);
export const roleOf = (u?: { roleId?: string } | null) => S.roles.find(r => r.id === u?.roleId);
export const userById = (id?: string) => S.users.find(u => u.id === id);
export const userName = (id?: string) => userById(id)?.name || '';

/** 기능 f 에 대한 동작 op 권한. 병원 h 를 주면 삭제 상태·담당 범위까지 본다 */
export function can(f: Feature, op: Op, h?: Hospital | null) {
    const u = cur(), r = roleOf(u); if (!u || !r) return false; if (!r.perms[f]?.[op]) return false;
    if (h && op !== 'view' && op !== 'read') {
        if (h.deletedAt && !(f === 'hospital' && op === 'delete')) return false;
        if (r.scope === 'own' && SCOPED.includes(f) && h.ownerId !== u.id) return false;
    }
    return true;
}
export const canSee = (f: Feature) => can(f, 'view');
export const canRead = (f: Feature) => can(f, 'view') && can(f, 'read');
/** 권한이 없으면 이유를 알려주고 false */
export function need(f: Feature, op: Op, h?: Hospital | null) {
    if (can(f, op, h)) return true; const r = roleOf(cur());
    toast(h && r?.scope === 'own' && SCOPED.includes(f) && h.ownerId !== cur()?.id && r.perms[f]?.[op] ? '담당 병원만 수정할 수 있습니다' : `${FNAME[f]} ${OPS.find(o => o[0] === op)?.[1]} 권한이 없습니다`);
    return false;
}
export function roNote(f: Feature, h?: Hospital | null) {
    const r = roleOf(cur()); if (h?.deletedAt) return '삭제된 병원은 복원 전까지 수정할 수 없습니다';
    if (r?.scope === 'own' && h && h.ownerId !== cur()?.id && (r.perms[f]?.update || r.perms[f]?.create)) return `담당 병원만 수정할 수 있습니다 · 담당 ${userName(h.ownerId) || '미지정'}`;
    return `읽기 전용 · ${r?.name || ''} 역할에는 ${FNAME[f]} 수정 권한이 없습니다`;
}

/* ---------------- 단계 ---------------- */
export const initialStage = () => STAGES[0];
export const sc = (s: string) => { const st = S && S.stages && S.stages.find(x => x.name === s); return st ? st.color : 'var(--s0)'; };
export function setStage(h: Hospital, to: string) { if (h.stage === to) return; (h.stageHistory ||= []).push({ date: today(), from: h.stage, to }); h.stage = to; }
/** 활동·가입·사용 기록에 따라 앞으로만 단계 자동 전환 (이탈 단계는 그대로). 바뀐 단계 이름을 돌려준다 */
export function autoAdvance(h: Hospital) {
    let moved = '';
    const go = (t: string) => { const c = STAGES.indexOf(h.stage), ti = STAGES.indexOf(t); if (c >= MAIN_N) return; if (ti > c) { setStage(h, t); moved = t; } };
    const T = (k: string) => S.stages.find(x => x.trigger === k && x.kind === 'main')?.name;
    const g2 = (k: string) => { const t = T(k); if (t) go(t); };
    const a = h.activities || []; if (a.length) g2('contact');
    const v = a.filter(x => x.type === '방문').length; if (v >= 1) g2('visit1'); if (v >= 2) g2('visit2');
    if (h.signupDate) g2('signup'); if (+h.usageCount > 0) g2('use');
    return moved;
}

/* ---------------- 리드 평가 ---------------- */
export const hasEval = (v: any) => v !== '' && v != null;
export const ptTxt = (v: any) => (hasEval(v) ? `${v}점` : '');
export function evalSum(e: any) { e = e || {}; if (!hasEval(e.adoption) || !hasEval(e.favor) || !hasEval(e.surgeries)) return null; return +e.adoption + +e.favor + +e.surgeries; }
export const scoreOf = (h: Hospital) => evalSum(h.eval);
/** 항목별 0~5점 합산(0~15) → 11~15 상 / 6~10 중 / 0~5 하 */
export const gradeFromSum = (s: number | null) => (s == null ? '미평가' : s >= 11 ? '상' : s >= 6 ? '중' : '하');
export const gradeOf = (h: Hospital) => gradeFromSum(scoreOf(h));
function evalStageIdx() { const s = (S.stages || []).find(x => x.trigger === 'visit1' && x.kind === 'main'); return s ? STAGES.indexOf(s.name) : 2; }
/** 리드 평가는 1차 방문 이후 단계에서만 (이탈 단계는 방문 기록이 있으면 허용) */
export function canEvalStage(h: Hospital) { const i = STAGES.indexOf(h.stage); if (i < 0) return false; if (i < MAIN_N) return i >= evalStageIdx(); return (h.activities || []).some(a => a.type === '방문'); }
export function evalN(h: Hospital) { const e: any = h.eval || {}; return (hasEval(e.adoption) ? 1 : 0) + (hasEval(e.favor) ? 1 : 0) + (hasEval(e.surgeries) ? 1 : 0); }

/* ---------------- 병원 ---------------- */
export function followOf(h: Hospital) { const n = h.next || {}; if (!n.date) return '없음'; if (n.done) return '완료'; const d = dday(n.date); return d < 0 ? '지연' : d === 0 ? '오늘' : '예정'; }
export const sortedActs = (h: Hospital) => [...(h.activities || [])].sort((a, b) => a.date.localeCompare(b.date));
export function contactInfo(h: Hospital) { const a = sortedActs(h); const v = a.filter(x => x.type === '방문'); return { first: a[0]?.date || '', last: a.at(-1)?.date || '', v1: v[0]?.date || '', v2: v[1]?.date || '' }; }
export const catById = (id: string) => S.categories.find(c => c.id === id);
export const inCat = (h: Hospital, key: string) => (key === '__none' ? !(h.categoryIds || []).length : (h.categoryIds || []).includes(key));
export const getH = (id?: string | null) => S.hospitals.find(h => h.id === id);
export const liveH = () => S.hospitals.filter(h => !h.deletedAt);
export const region = (h: Hospital) => (h.sigungu ? `${h.sido} ${h.sigungu}` : '주소 없음');
export const hName = (id: string) => getH(id)?.name || '';
export const compById = (id?: string) => (S.competitors || []).find(c => c.id === id);
export const preLabel = (h: Hospital) => (h.stage === initialStage() && h.pre && PRE_TYPES[h.pre] ? PRE_TYPES[h.pre] : null);

export type HForm = Pick<Hospital, 'name' | 'zip' | 'address' | 'jibun' | 'addressDetail' | 'sido' | 'sigungu' | 'lat' | 'lng' | 'grade' | 'specialty' | 'phone' | 'director' | 'directorPhone' | 'vetCount' | 'ownerId' | 'categoryIds' | 'compId' | 'compUntil' | 'pre' | 'sources'> & { _stage?: string; _dupWarned?: boolean };
export function blankForm(): HForm { return { name: '', zip: '', address: '', jibun: '', addressDetail: '', sido: '', sigungu: '', lat: null, lng: null, grade: '', specialty: '', phone: '', director: '', directorPhone: '', vetCount: '', ownerId: '', categoryIds: [], compId: '', compUntil: '', pre: 'call', sources: [] }; }
export function formFromH(h: Hospital): HForm { const f: any = blankForm(); for (const k in f) if (k in h) f[k] = JSON.parse(JSON.stringify((h as any)[k] ?? null)) ?? f[k]; f.sources = f.sources || []; f._stage = h.stage; return f; }
export function findDup(f: HForm, selfId?: string) {
    const n = f.name.replace(/\s/g, '');
    return S.hospitals.find(h => h.id !== selfId && ((n && h.name.replace(/\s/g, '') === n) || (f.address && h.address === f.address && (h.addressDetail || '') === (f.addressDetail || '')) || (f.phone && h.phone === f.phone)));
}
export function validateForm(f: HForm) { if (!f.name.trim()) return '병원명을 입력하세요.'; if (!f.address) return '주소 검색으로 주소를 선택하세요.'; return ''; }

/** 동선: 첫 병원에서 가장 가까운 순으로 */
export function nearestOrder(ids: string[]) {
    const pts = ids.map(getH) as Hospital[]; const out = [pts.shift()!];
    while (pts.length) { const last = out.at(-1)!; let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = distKm(last, p); if (d < bd) { bd = d; bi = i; } }); out.push(pts.splice(bi, 1)[0]); }
    return out.map(h => h.id);
}

/* ---------------- 변경 이력 ---------------- */
type Snap = Record<string, { l: string; v: string }>;
const H_FIELDS: [string, string, string, ((h: Hospital) => any)?][] = [
    ['name', '병원명', '기본 정보'], ['address', '주소', '기본 정보', h => (h.address ? `(${h.zip || '-'}) ${h.address}` : '')], ['addressDetail', '상세주소', '기본 정보'], ['grade', '병원 등급', '기본 정보'],
    ['specialty', '전문과', '기본 정보'], ['phone', '대표 전화', '기본 정보'], ['director', '원장님 이름', '기본 정보'], ['directorPhone', '원장님 연락처', '기본 정보'], ['vetCount', '봉직수의사 수', '기본 정보'],
    ['ownerId', '담당 영업사원', '기본 정보', h => userName(h.ownerId)], ['compId', '사용 중인 경쟁 제품', '기본 정보', h => compById(h.compId)?.name || ''], ['compUntil', '경쟁 제품 계약 만료일', '기본 정보', h => fd(h.compUntil)],
    ['categoryIds', '카테고리', '카테고리', h => (h.categoryIds || []).map(id => catById(id)?.name).filter(Boolean).join(', ') || '미분류'],
    ['stage', '현재 단계', '영업 단계'],
    ['pre', '미접촉 예정 구분', '기본 정보', h => (h.stage === initialStage() ? (PRE_TYPES[h.pre || '']?.[0] || '') : '')], ['sources', '접촉 경로', '기본 정보', h => (h.sources || []).join(', ')],
    ['e.adoption', '디지털 수용도', '리드 평가', h => ptTxt(h.eval?.adoption)], ['e.shots', '디지털 수용도 근거 이미지', '리드 평가', h => ((h.eval?.shots || []).length ? `${h.eval.shots!.length}장` : '')],
    ['e.favor', '서비스 호감도', '리드 평가', h => ptTxt(h.eval?.favor)], ['e.surgeries', '월 마취 건수', '리드 평가', h => ptTxt(h.eval?.surgeries)],
    ['score', '리드 종합 등급', '리드 평가', h => { const s = scoreOf(h); return s == null ? '미평가' : `${gradeOf(h)} (${s}/${EVAL_TOTAL}점)`; }],
    ['n.date', '다음 액션일', '영업 활동', h => h.next?.date || ''], ['n.todo', '팔로우업 할 사항', '영업 활동', h => h.next?.todo || ''], ['n.done', '팔로우업 처리', '영업 활동', h => (h.next?.date ? (h.next.done ? '완료' : '미완료') : '')],
    ['signupDate', '회원가입일', '전환·사용'], ['usageCount', 'VitalVET 누적 사용 건수', '전환·사용', h => (+h.usageCount ? String(h.usageCount) : '')], ['lastUsedDate', '최근 사용일', '전환·사용'], ['memo', '비고', '전환·사용'],
    ['status', '상태', '병원 상태', h => (h.deletedAt ? '삭제됨' : '정상')],
];
export function snapH(h: Hospital): Snap {
    const o: Snap = {};
    H_FIELDS.forEach(([k, l, , fn]) => { const v = fn ? fn(h) : (h as any)[k]; o[k] = { l, v: v == null ? '' : String(v) }; });
    (h.activities || []).forEach(a => { o['act:' + a.id] = { l: '활동 기록', v: [a.type, a.date, a.purpose, a.contact && '면담 ' + a.contact, a.reaction, a.note].filter(Boolean).join(' · ') }; });
    return o;
}
export function diffSnap(a: Snap, b: Snap, skip: string[] = []): Change[] {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]; const out: Change[] = [];
    keys.forEach(k => { if (skip.includes(k)) return; const x = a[k]?.v ?? '', y = b[k]?.v ?? ''; if (x !== y) out.push({ field: (a[k] || b[k]).l, before: x, after: y }); });
    return out;
}
/** 변경 이력 추가 (서버가 작성자·시각을 다시 찍는다) */
export function logEntry(o: Partial<AuditEntry>) {
    const u = cur(); const r = roleOf(u);
    S.audit.push({ id: uid(), ts: new Date().toISOString(), userId: u?.id || '', userName: u?.name || '시스템', roleName: r?.name || '', ...o } as AuditEntry);
}
/** 병원 고치기: 바꾸기 전·후를 비교해 변경 이력을 남기고 저장 */
export function mutateH<T>(h: Hospital, section: string, fn: (h: Hospital) => T, opt: { action?: string; summary?: string; force?: boolean } = {}): T {
    const b = snapH(h); const ret = fn(h); const a = snapH(h); const ch = diffSnap(b, a);
    if (ch.length || opt.force) logEntry({ entity: 'hospital', entityId: h.id, hospitalId: h.id, targetName: h.name, action: opt.action || 'update', section, changes: ch, summary: opt.summary || '' });
    save(); return ret;
}

/* ---------------- 근무일 · 근태 ---------------- */
export const holMap = () => (S && S.holidays) || {};
export const holName = (ds: string) => holMap()[ds] || '';
export const isBiz = (ds: string) => { const d = new Date(ds + 'T00:00:00').getDay(); return d !== 0 && d !== 6 && !holName(ds); };
export function nextBiz(ds: string) { let d = addDays(1, ds); while (!isBiz(d)) d = addDays(1, d); return d; }
export function prevBiz(ds: string) { let d = addDays(-1, ds); while (!isBiz(d)) d = addDays(-1, d); return d; }
export function bizDays(from: string, to: string) { const out: string[] = []; for (let d = from; d <= to; d = addDays(1, d)) if (isBiz(d)) out.push(d); return out; }
export function attOn(uidv: string, ds: string, sts = ['approved']) { return (S.attendance || []).find(a => a.userId === uidv && sts.includes(a.status) && a.from <= ds && a.to >= ds); }
export const isOffDay = (uidv: string, ds: string) => { const a = attOn(uidv, ds); return !!(a && ATT[a.type]?.off); };
/** 그날 방문 목표 (연차·병가 0, 반차 절반, 교육 0) */
export function goalFor(uidv: string, ds: string) { const g = S.settings.visitGoal || 4; const a = attOn(uidv, ds); if (!a) return g; const t: any = ATT[a.type] || {}; return t.off || t.goal0 ? 0 : t.half ? Math.ceil(g / 2) : g; }
export function attDays(a: Pick<Attendance, 'type' | 'from' | 'to'>) { if (ATT[a.type]?.half) return .5; return bizDays(a.from, a.to).length; }
export const leaveTotal = (u?: User) => u?.annualLeave ?? 15;
export function leaveUsed(uidv: string, year: string) { return (S.attendance || []).filter(a => a.userId === uidv && a.status === 'approved' && (a.type === '연차' || ATT[a.type]?.half) && a.from.startsWith(year)).reduce((s, a) => s + attDays(a), 0); }
export function canAtt(op: Op, a?: Attendance) { const u = cur(), r = roleOf(u); if (!u || !r?.perms.attendance?.[op]) return false; if (a && r.scope === 'own' && a.userId !== u.id) return false; return true; }
export const attManager = () => canAtt('update') && roleOf(cur())?.scope === 'all';
export const attPeriod = (a: Pick<Attendance, 'from' | 'to'>) => (a.from === a.to ? fd(a.from) : `${fd(a.from)} ~ ${fd(a.to)}`);
export function snapAtt(a: Attendance): Snap {
    const o: Snap = {}; const p = (k: string, l: string, v: any) => (o[k] = { l, v: v == null ? '' : String(v) });
    p('u', '대상자', userName(a.userId)); p('t', '유형', a.type); p('p', '기간', attPeriod(a)); p('d', '일수', attDays(a) + '일'); p('s', '상태', ATT_ST[a.status]?.[0]); p('r', '사유', a.reason); p('c', '처리 의견', a.comment);
    return o;
}
export function logAtt(a: Attendance, action: string, section: string, before?: Snap) { logEntry({ entity: 'attendance', entityId: a.id, targetName: `${userName(a.userId)} ${a.type} ${attPeriod(a)}`, action, section, changes: diffSnap(before || {}, snapAtt(a)) }); }

/* ---------------- 영업 보고 ---------------- */
export const userColor = (id: string) => `var(--v${((userById(id)?.slot || 1) - 1) % 8 + 1})`;
export function canRep(op: Op, rep?: Report) { const u = cur(), r = roleOf(u); if (!u || !r?.perms.report?.[op]) return false; if (rep && r.scope === 'own' && rep.authorId !== u.id) return false; return true; }
export const canReview = (rep?: Report) => !!rep && rep.authorId !== cur()?.id && roleOf(cur())?.scope === 'all' && canRep('update', rep);
/** 보고서를 쓰는 사람 (담당만 범위면 본인만) */
export const reporters = (): User[] => { const me = cur()!; if (roleOf(me)?.scope === 'own') return [me]; return S.users.filter(u => u.status === 'active' && roleOf(u)?.perms.report?.create && u.roleId !== 'r_admin'); };
export const expTotal = (r: Report) => (r.exp || []).reduce((a, x) => a + (+x.amount || 0), 0);
/** 그날 그 사람의 활동 자동 집계 */
export function repStats(author: string, date: string) {
    const acts: any[] = [];
    S.hospitals.forEach(h => (h.activities || []).forEach(a => { if (a.authorId === author && a.date === date) acts.push({ id: a.id, hospitalId: h.id, hospitalName: h.name, type: a.type, purpose: a.purpose || '', contact: a.contact || '', reaction: a.reaction || '', note: a.note || '' }); }));
    const t = (x: string) => acts.filter(a => a.type === x).length;
    const au = S.audit.filter(e => e.userId === author && e.entity === 'hospital' && fmtTs(e.ts).slice(0, 10) === date);
    const evals = new Set(au.filter(e => e.section === '리드 평가' && e.action !== 'delete').map(e => e.hospitalId)).size;
    let ups = 0; au.forEach(e => (e.changes || []).forEach(c => { if (c.field === '현재 단계') { const a = STAGES.indexOf(c.before), b = STAGES.indexOf(c.after); if (b > a && b < MAIN_N) ups++; } }));
    const react: Record<string, number> = { 긍정: 0, 보통: 0, 부정: 0, 부재: 0 }; acts.forEach(a => { if (a.reaction in react) react[a.reaction]++; });
    return {
        visits: t('방문'), calls: t('전화'), msgs: t('문자/카톡') + t('이메일'), events: t('세미나/행사'), newHosp: S.hospitals.filter(h => h.createdBy === author && h.createdAt === date).length, evals, stageUps: ups,
        signups: S.hospitals.filter(h => h.ownerId === author && h.signupDate === date).length, demos: acts.filter(a => /시연/.test(a.purpose)).length, react,
        acts: acts.sort((a, b) => (a.type === '방문' ? 0 : 1) - (b.type === '방문' ? 0 : 1)),
    };
}
export function newReport(author: string, date: string): Report {
    const mine = liveH().filter(h => h.ownerId === author); const nb = nextBiz(date);
    const sug = mine.filter(h => h.next?.date && !h.next.done && h.next.date <= nb).map(h => h.id).slice(0, 5);
    return { id: 'rp_' + uid(), authorId: author, date, status: 'draft', workType: '외근', region: '', mileage: '', highlights: '', voc: [], comp: [], issues: [], plan: { hospitalIds: sug, goal: goalFor(author, nb), note: '' }, exp: [], memo: '' };
}
export function snapRep(r: Report): Snap {
    const o: Snap = {}; const put = (k: string, l: string, v: any) => (o[k] = { l, v: v == null ? '' : String(v) });
    put('status', '상태', REP_ST[r.status]?.[0]); put('work', '근무 형태', r.workType); put('region', '방문 지역', r.region); put('mile', '이동 거리(km)', r.mileage);
    put('visits', '방문 수(자동 집계)', r.stats?.visits); put('calls', '통화 수(자동 집계)', r.stats?.calls); put('hl', '오늘 요약', r.highlights);
    (r.voc || []).forEach((x, i) => put('voc' + i, `고객의 소리 ${i + 1}`, [x.type, hName(x.hospitalId), x.text].filter(Boolean).join(' · ')));
    (r.comp || []).forEach((x, i) => put('comp' + i, `경쟁사 동향 ${i + 1}`, [x.name, hName(x.hospitalId), x.text].filter(Boolean).join(' · ')));
    (r.issues || []).forEach((x, i) => put('iss' + i, `지원 요청 ${i + 1}`, [x.type, x.urgency, x.text].filter(Boolean).join(' · ')));
    put('plan', '내일 방문 계획', (r.plan?.hospitalIds || []).map(hName).join(', ')); put('pgoal', '내일 목표 방문', r.plan?.goal); put('pnote', '내일 계획 메모', r.plan?.note);
    put('exp', '경비 합계', expTotal(r) ? won(expTotal(r)) : ''); put('memo', '특이사항', r.memo); put('rc', '검토 의견', r.reviewComment);
    return o;
}
/** 활동 기록에 적은 고객의 소리·경쟁사·지원 요청을 보고서 행으로 자동 반영 */
export function syncAutoRows(d: Report) {
    const st = S.reports.find(r => r.id === d.id)?.status; if (st === 'submitted' || st === 'confirmed') return;
    const add: Record<string, any[]> = { voc: [], comp: [], issues: [] };
    S.hospitals.forEach(h => {
        if (h.deletedAt) return;
        (h.activities || []).forEach(a => {
            if (a.authorId !== d.authorId || a.date !== d.date) return;
            if (a.voc) add.voc.push({ src: a.id, type: a.voc.type, hospitalId: h.id, text: a.voc.text });
            if (a.comp) add.comp.push({ src: a.id, competitorId: a.comp.competitorId || '', name: compById(a.comp.competitorId)?.name || '경쟁사 미지정', hospitalId: h.id, text: a.comp.text });
            if (a.issue) add.issues.push({ src: a.id, type: a.issue.type, urgency: '보통', text: a.issue.text });
        });
    });
    (['voc', 'comp', 'issues'] as const).forEach(k => {
        const old = (d[k] || []); const keep = old.filter((x: any) => !x.src); const prev = Object.fromEntries(old.filter((x: any) => x.src).map((x: any) => [x.src, x]));
        d[k] = [...add[k].map(x => (k === 'issues' && prev[x.src] ? { ...x, urgency: prev[x.src].urgency || '보통' } : x)), ...keep];
    });
}
export function repRange(): [string, string] { const R = ui.rep; if (!R.from) { R.to = today(); R.from = addDays(-13); } return [R.from, R.to]; }
export function setPreset(p: string) {
    const R = ui.rep; const t = today(); const d = new Date(t + 'T00:00:00'); R.preset = p; R.to = t;
    if (p === 'week') { const k = (d.getDay() + 6) % 7; R.from = addDays(-k); } else if (p === '2w') R.from = addDays(-13); else if (p === 'month') R.from = t.slice(0, 8) + '01'; else if (p === '30') R.from = addDays(-29);
}

/* ---------------- 활동 기록 보고서 항목 ---------------- */
export type ExtrasDraft = { vocType: string; vocText: string; compId: string; compText: string; issType: string; issText: string };
export function extrasOf(a: Partial<ExtrasDraft>, VOC0: string, ISS0: string) {
    const o: any = { voc: null, comp: null, issue: null }; const t = (k: keyof ExtrasDraft) => String(a[k] || '').trim();
    if (t('vocText')) o.voc = { type: a.vocType || VOC0, text: t('vocText') };
    if (a.compId || t('compText')) o.comp = { competitorId: a.compId || '', text: t('compText') };
    if (t('issText')) o.issue = { type: a.issType || ISS0, text: t('issText') };
    Object.keys(o).forEach(k => { if (!o[k]) delete o[k]; });
    return o;
}

/* ---------------- 경쟁사 ---------------- */
export const canComp = (op: Op) => can('competitor', op);
export function compMentions(c: Competitor) {
    const out: any[] = [];
    S.reports.forEach(r => (r.comp || []).forEach(x => { if (x.competitorId === c.id || (!x.competitorId && x.name === c.name)) out.push({ ...x, date: r.date, author: r.authorId, status: r.status }); }));
    return out.sort((a, b) => b.date.localeCompare(a.date));
}
export const compHosp = (c: Competitor) => liveH().filter(h => h.compId === c.id);
export function snapComp(c: Competitor): Snap {
    const o: Snap = {}; const p = (k: string, l: string, v: any) => (o[k] = { l, v: v == null ? '' : String(v) });
    p('n', '제품·서비스명', c.name); p('co', '회사명', c.company); p('t', '유형', c.type); p('th', '위협도', c.threat); p('w', '웹사이트', c.website); p('ph', '대표 전화', c.phone);
    p('a', '본사 위치', c.address ? `${c.address} ${c.addressDetail || ''}`.trim() : ''); p('r', '영업 지역', c.regions);
    (c.products || []).filter(x => x.name).forEach((x, i) => p('pr' + i, `경쟁 품목 ${i + 1}`, [x.name, x.price, x.note].filter(Boolean).join(' · ')));
    p('s', '강점', c.strengths); p('wk', '약점', c.weaknesses); p('cn', '대응 포인트', c.counter); p('m', '메모', c.memo);
    return o;
}

/* ---------------- 팀 성과 지표 ---------------- */
export const ownedActive = (uidv: string) => liveH().filter(h => h.ownerId === uidv && STAGES.indexOf(h.stage) < MAIN_N);
export const lastContact = (h: Hospital) => sortedActs(h).at(-1)?.date || '';
export const isStale = (h: Hospital) => { const lc = lastContact(h); return STAGES.indexOf(h.stage) < MAIN_N && (lc ? dday(lc) <= -14 : dday(h.createdAt) <= -7); };
export const monOf = (d: string) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return fmtD(x); };
export function repMetrics(u: User, from: string, to: string) {
    const acts: any[] = []; S.hospitals.forEach(h => (h.activities || []).forEach(a => { if (a.authorId === u.id && a.date >= from && a.date <= to) acts.push({ ...a, hid: h.id }); }));
    const days = bizDays(from, to).filter(d => d < today() || d === to); const worked = days.filter(d => !isOffDay(u.id, d) && d <= today()); const goalSum = worked.reduce((s, d) => s + goalFor(u.id, d), 0);
    const visits = acts.filter(a => a.type === '방문').length; const calls = acts.filter(a => a.type === '전화').length;
    const own = ownedActive(u.id); const contacted = own.filter(h => { const lc = lastContact(h); return lc && dday(lc) > -14; }).length;
    const ownIds = new Set(liveH().filter(h => h.ownerId === u.id).map(h => h.id)); let ups = 0;
    S.audit.forEach(e => {
        if (e.entity !== 'hospital' || !ownIds.has(e.hospitalId!)) return; const d = fmtTs(e.ts).slice(0, 10); if (d < from || d > to) return;
        (e.changes || []).forEach(c => { if (c.field === '현재 단계') { const a = STAGES.indexOf(c.before), b = STAGES.indexOf(c.after); if (b > a && b < MAIN_N && a >= 0) ups++; } });
    });
    const signups = liveH().filter(h => h.ownerId === u.id && h.signupDate >= from && h.signupDate <= to).length;
    const withNext = liveH().filter(h => h.ownerId === u.id && h.next?.date && !h.next.done); const overdue = withNext.filter(h => dday(h.next.date!) < 0);
    const due = days.filter(d => d < today() && !isOffDay(u.id, d)); const subm = due.filter(d => S.reports.some(r => r.authorId === u.id && r.date === d && ['submitted', 'confirmed'].includes(r.status))).length;
    const re: Record<string, number> = { 긍정: 0, 보통: 0, 부정: 0, 부재: 0 }; acts.forEach(a => { if (a.reaction in re) re[a.reaction]++; }); const ans = re.긍정 + re.보통 + re.부정;
    const elig = own.filter(canEvalStage); const evalOk = elig.filter(h => evalN(h) === 3).length;
    const stale = own.filter(isStale); const evalMissing = elig.filter(h => evalN(h) < 3);
    const scores: Record<string, number | null> = {
        activity: goalSum ? Math.min(100, visits / goalSum * 100) : null, coverage: own.length ? contacted / own.length * 100 : null, progress: null,
        followup: withNext.length ? (withNext.length - overdue.length) / withNext.length * 100 : 100, report: due.length ? subm / due.length * 100 : null,
        response: ans ? re.긍정 / ans * 100 : null, quality: elig.length ? evalOk / elig.length * 100 : null,
    };
    return { u, visits, calls, worked: worked.length, goalSum, avg: worked.length ? visits / worked.length : 0, own: own.length, contacted, ups, signups, withNext: withNext.length, overdue, subm, due: due.length, re, ans, elig: elig.length, evalOk, stale, evalMissing, scores, total: 0 };
}
export type Metrics = ReturnType<typeof repMetrics>;
export function teamData(weeks: number) {
    const to = today(); const from = addDays(-(weeks * 7 - 1)); const rs = reporters().filter(u => u.roleId !== 'r_admin'); const M = rs.map(u => repMetrics(u, from, to));
    const maxUp = Math.max(0, ...M.map(m => m.ups));
    M.forEach(m => { m.scores.progress = maxUp ? m.ups / maxUp * 100 : null; const v = Object.values(m.scores).filter(x => x != null) as number[]; m.total = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
    const avg: Record<string, number> = {}; AXES.forEach(([k]) => { const v = M.map(m => m.scores[k]).filter(x => x != null) as number[]; avg[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
    return { from, to, M, avg, maxUp };
}
export const gradeOfScore = (s: number): [string, string, string] => (s >= 80 ? ['A', '우수', 'g-a'] : s >= 65 ? ['B', '양호', 'g-b'] : s >= 50 ? ['C', '보통', 'g-c'] : ['D', '관리 필요', 'g-d']);
export function repAlerts(m: Metrics): [string, string][] {
    const goal = S.settings.visitGoal || 4; const out: [string, string][] = [];
    if (m.overdue.length) out.push(['crit', `팔로우업 지연 ${m.overdue.length}건`]); if (m.stale.length) out.push(['warn', `2주 넘게 연락 없는 병원 ${m.stale.length}곳`]);
    if (m.due && m.subm < m.due) out.push([m.due - m.subm >= 2 ? 'crit' : 'warn', `보고서 미제출 ${m.due - m.subm}일`]); if (m.worked && m.avg < goal * .75) out.push(['warn', `일평균 방문 ${m.avg.toFixed(1)}곳 (목표 ${goal})`]);
    if (m.evalMissing.length >= 3) out.push(['info', `리드 평가 미완료 ${m.evalMissing.length}곳`]); if (m.signups) out.push(['good', `회원가입 전환 ${m.signups}건`]);
    return out;
}
export const weeklyVisits = (uidv: string, n = 8) => {
    const w0 = monOf(today()); const ws = [...Array(n)].map((_, i) => addDays(-7 * (n - 1 - i), w0));
    const acts = S.hospitals.flatMap(h => h.activities || []).filter(a => a.authorId === uidv && a.type === '방문');
    return { ws, vals: ws.map(w => acts.filter(a => monOf(a.date) === w).length) };
};

/* ---------------- 병원 검색 (자동완성) ---------------- */
export function hpPool() { const me = cur()!; return (roleOf(me)?.scope === 'own' ? liveH().filter(h => h.ownerId === me.id) : liveH()); }
const hpMatch = (h: Hospital, q: string) => [h.name, h.sigungu, h.director, h.address, h.id].join(' ').toLowerCase().includes(q);
const hpRank = (h: Hospital, q: string) => (!q ? 0 : h.name.toLowerCase().startsWith(q) ? 0 : h.name.toLowerCase().includes(q) ? 1 : 2);
/** dayIds: 그날 접촉한 병원(먼저 보여줌), exclude: 이미 고른 병원 */
export function hpSearch(q: string, dayIds: string[] = [], exclude: string[] = [], planMode = false) {
    q = q.trim().toLowerCase(); const pool = hpPool().filter(h => !exclude.includes(h.id)); const day = dayIds.map(getH).filter(Boolean) as Hospital[];
    if (planMode) return pool.filter(h => !q || hpMatch(h, q)).sort((a, b) => hpRank(a, q) - hpRank(b, q)).slice(0, 30);
    if (!q) return [...day, ...pool.filter(h => !day.includes(h)).sort((a, b) => a.name.localeCompare(b.name, 'ko'))].slice(0, 30);
    return pool.filter(h => hpMatch(h, q)).sort((a, b) => hpRank(a, q) - hpRank(b, q)).slice(0, 30);
}

/* ---------------- 내비 연동 ---------------- */
export function chunks<T>(R: T[], size: number, overlap: boolean) {
    const out: T[][] = []; if (size <= 1) { R.forEach(h => out.push([h])); return out; }
    let i = 0; while (i < R.length) { const c = R.slice(i, i + size); out.push(c); if (i + size >= R.length) break; i += size - (overlap ? 1 : 0); }
    return out;
}
export const kakaoMapRouteUrl = (pts: Hospital[]) => `https://map.kakao.com/link/by/car/${pts.map(h => `${encodeURIComponent(h.name)},${h.lat},${h.lng}`).join('/')}`;
export const tmapUrl = (h: Hospital) => `tmap://route?rGoName=${encodeURIComponent(h.name)}&rGoX=${h.lng}&rGoY=${h.lat}`;
