/*
 * 목표 대비 실적 (월 단위) · 영업 단계 전환율·소요 기간
 * 목표: 설정값은 서버 app_settings 'goals' = { default: {visits, signups, uses}, users: { 사용자id: {...} } }
 */
import { liveH } from './domain';
import { S, STAGES, MAIN_N } from './store';
import type { Hospital } from './types';
import { today } from './utils';
import { visitCount } from './ux';

export type GoalSet = { visits: number; signups: number; uses: number };
export const GOAL_KEYS: [keyof GoalSet, string, string][] = [['visits', '방문', '같은 병원·같은 날은 1회'], ['signups', '회원가입', '담당 병원 중 그달 회원가입일'], ['uses', '사용 전환', '그달 사용 단계로 바뀐 담당 병원']];
export const DEFAULT_GOAL: GoalSet = { visits: 80, signups: 3, uses: 2 };

export const goals = () => ((S as any).goals || { default: DEFAULT_GOAL, users: {} }) as { default: GoalSet; users: Record<string, Partial<GoalSet>> };
export function goalOf(uid: string): GoalSet { const g = goals(); return { ...DEFAULT_GOAL, ...g.default, ...(g.users?.[uid] || {}) } as GoalSet; }

const useStage = () => S.stages.find(s => s.trigger === 'use' && s.kind === 'main')?.name;

/** 사용자 uid 의 ym(YYYY-MM) 실적 */
export function monthActual(uid: string, ym: string): GoalSet {
    const H = liveH(); const us = useStage();
    const acts = H.flatMap(h => (h.activities || []).filter(a => a.authorId === uid && a.date.startsWith(ym)).map(a => ({ ...a, hid: h.id })));
    const own = H.filter(h => h.ownerId === uid);
    return {
        visits: visitCount(acts),
        signups: own.filter(h => (h.signupDate || '').startsWith(ym)).length,
        uses: us ? own.filter(h => (h.stageHistory || []).some(x => x.to === us && (x.date || '').startsWith(ym))).length : 0,
    };
}
export const thisMonth = () => today().slice(0, 7);
export function recentMonths(n = 6) { const out: string[] = []; const d = new Date(today() + 'T00:00:00'); d.setDate(1); for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); } return out; }
/** 이번 달이면 오늘까지 지난 비율 (페이스 비교용) */
export function monthPace(ym: string) { if (ym !== thisMonth()) return 1; const d = new Date(today() + 'T00:00:00'); const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return d.getDate() / days; }

/* ---------------- 단계 전환율 · 소요 기간 ---------------- */
export type FunnelRow = { stage: string; reached: number; rate: number | null; avgDays: number | null; stuck: number; now: number };
const dayDiff = (a: string, b: string) => Math.round((+new Date(b + 'T00:00:00') - +new Date(a + 'T00:00:00')) / 864e5);

/** 병원마다 진행 단계별 처음 들어온 날 (등록일 = 첫 단계) */
function entries(h: Hospital): Record<string, string> {
    const e: Record<string, string> = {}; const main = STAGES.slice(0, MAIN_N);
    e[main[0]] = h.createdAt || '';
    for (const x of [...(h.stageHistory || [])].sort((p, q) => (p.date || '').localeCompare(q.date || ''))) if (main.includes(x.to) && !e[x.to]) e[x.to] = x.date;
    // 단계를 건너뛰었으면 그 앞 단계는 같은 날 지나간 것으로
    let last = ''; for (let i = main.length - 1; i >= 0; i--) { if (e[main[i]]) last = e[main[i]]; else if (last && reachedIdx(h) >= i) e[main[i]] = last; }
    return e;
}
function reachedIdx(h: Hospital) {
    const main = STAGES.slice(0, MAIN_N); let mx = main.indexOf(h.stage);
    for (const x of h.stageHistory || []) mx = Math.max(mx, main.indexOf(x.to));
    return mx;
}
export function funnel(H: Hospital[], stuckDays = 30): FunnelRow[] {
    const main = STAGES.slice(0, MAIN_N); const t = today(); const E = H.map(h => ({ h, e: entries(h), r: reachedIdx(h) }));
    return main.map((s, i) => {
        const reached = E.filter(x => x.r >= i).length; const prev = i ? E.filter(x => x.r >= i - 1).length : null;
        const ds = i ? E.filter(x => x.r >= i && x.e[main[i - 1]] && x.e[s]).map(x => dayDiff(x.e[main[i - 1]], x.e[s])).filter(d => d >= 0) : [];
        const nowIn = E.filter(x => x.h.stage === s);
        const stuck = nowIn.filter(x => { const since = [...(x.h.stageHistory || [])].reverse().find(y => y.to === s)?.date || x.h.createdAt || t; return dayDiff(since, t) > stuckDays; }).length;
        return { stage: s, reached, rate: prev ? reached / prev : null, avgDays: ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null, stuck, now: nowIn.length };
    });
}
