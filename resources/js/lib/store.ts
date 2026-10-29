/*
 * 화면 상태 저장소
 *
 * - S  : 서버에서 받은 데이터 (/api/state). 화면 코드는 S 를 바로 고친 뒤 save() 를 부른다.
 * - ui : 메뉴를 옮겨 다녀도 유지되는 화면 상태 (목록 필터, 지도 선택, 열린 병원·창 등)
 * - save(): 바뀐 레코드만 골라 /api/sync 로 보낸다. 서버가 권한을 다시 확인하고, 거절하면 서버 상태로 되돌린다.
 * - 어떤 값이든 바뀌면 notify() → 화면 전체가 다시 그려진다 (useStore 훅).
 */
import { useSyncExternalStore, type ReactNode } from 'react';
import { reportError } from './errors';
import { stopAllVoice } from './voicebus';
import { api, onDataVer, setViewOnly } from './api';
import { today } from './utils';
import type { State } from './types';

export let S: State = null as unknown as State;
export let STAGES: string[] = [];
export let MAIN_N = 7;

/* ---------- 다시 그리기 ---------- */
let version = 0;
const listeners = new Set<() => void>();
export function notify() { version++; listeners.forEach(f => f()); }
export function useStore() {
    return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => version);
}

/* ---------- 화면 상태 ---------- */
export type Modal = { type: string; [k: string]: any } | null;
export const ui = {
    view: 'dash',
    detailId: null as string | null,
    tab: 'info',
    modal: null as Modal,
    list: { q: '', cat: '', stage: '', pre: '', src: '', grade: '', age: '', follow: '', owner: '', sort: 'id', deleted: false, biz: '', info: '', sido: '' },
    map: { tab: 'h' as 'h' | 'track', start: { kind: 'here' as 'here' | 'hosp' | 'addr', hid: '', lat: 0, lng: 0, label: '' }, me: null as null | { lat: number; lng: number; acc: number; at: number }, meErr: '', cats: new Set<string>(), stages: new Set<string>(), sel: null as string | null, route: [] as string[], labels: true, navStep: 0, fitTick: 0, focusId: '', biz: new Set<string>(['영업', '휴업']), sido: '', sigungu: '', owner: '', info: '', grade: '', viewId: '', q: '', blink: true },
    hist: { entity: '', user: '', action: '', q: '', limit: 60 },
    pick: { on: false, ids: new Set<string>() },   // 병원 관리: 담당 일괄 지정용 선택
    team: { weeks: 4 },
    track: { date: '', user: '', sel: '', kind: '' as '' | 'geo' | 'manual' | 'none' },   // 지도 › 방문 기록
    att: { month: today().slice(0, 7), user: '' },
    rep: { tab: '', date: today(), preset: '2w', from: '', to: '', user: '', status: '', review: '', draftKey: 0 },
    usersTab: 'users',
    roleSel: 'r_sales',
    cq: '',
    loginTab: 'login', loginUser: '', loginMsg: '',
};
/** 메뉴 이동: 화면을 바꾸고, 다른 사람이 바꾼 내용이 있는지 가볍게 확인한다 */
export function setView(v: string) { stopAllVoice(); ui.view = v; ui.modal = null; notify(); checkFresh(false, 3000); }

/* ---------- 알림 (토스트) ---------- */
export let toastMsg = '';
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
    toastMsg = msg; notify();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg = ''; notify(); }, 2600);
}

/* ---------- 단계 순서 ---------- */
export function syncStages() {
    const L = S.stages;
    S.stages = [...L.filter(x => x.kind === 'main'), ...L.filter(x => x.kind === 'exit')];
    STAGES = S.stages.map(x => x.name);
    MAIN_N = L.filter(x => x.kind === 'main').length;
    ui.map.stages = new Set(STAGES);
}

/* ---------- 서버 저장 ---------- */
const SYNC_COLS = ['hospitals', 'categories', 'stages', 'roles', 'users', 'competitors', 'reports', 'attendance', 'todos', 'coaching'] as const;
const SYNC_ORDERED = ['stages', 'categories', 'roles'] as const;
const SYNC_APP = ['settings', 'codes', 'holidays'] as const;
type Base = { col: Record<string, Map<string, string>>; order: Record<string, string[]>; app: Record<string, string>; audit: Set<string> };
let BASE: Base | null = null;
const SA = () => S as unknown as Record<string, any>;

function makeBase(): Base {
    const b: Base = { col: {}, order: {}, app: {}, audit: new Set((S.audit || []).map(e => e.id)) };
    SYNC_COLS.forEach(c => { b.col[c] = new Map((SA()[c] || []).map((x: any) => [x.id, JSON.stringify(x)])); });
    SYNC_ORDERED.forEach(c => { b.order[c] = (SA()[c] || []).map((x: any) => x.id); });
    SYNC_APP.forEach(k => { b.app[k] = JSON.stringify(SA()[k] ?? {}); });
    return b;
}

/** 마지막으로 서버와 맞춘 상태(BASE)와 지금 상태(S)를 레코드 단위로 비교 */
function collectChanges() {
    const B = BASE!;
    const changes: any[] = [], order: Record<string, string[]> = {}, app: Record<string, any> = {};
    SYNC_COLS.forEach(c => {
        const old = B.col[c]; const seen = new Set<string>();
        (SA()[c] || []).forEach((x: any) => {
            seen.add(x.id); const j = JSON.stringify(x); const o = old.get(x.id);
            if (o !== j) changes.push({ c, id: x.id, b: o ? JSON.parse(o) : null, a: JSON.parse(j) });
        });
        old.forEach((o, id) => { if (!seen.has(id)) changes.push({ c, id, b: JSON.parse(o), a: null }); });
    });
    SYNC_ORDERED.forEach(c => {
        const now = (SA()[c] || []).map((x: any) => x.id) as string[], old = B.order[c];
        const kn = now.filter(id => old.includes(id)).join('|'), ko = old.filter(id => now.includes(id)).join('|');
        const fi = now.findIndex(id => !old.includes(id));
        if (kn !== ko || (fi >= 0 && now.slice(fi).some(id => old.includes(id)))) order[c] = now;
    });
    SYNC_APP.forEach(k => { const j = JSON.stringify(SA()[k] ?? {}); if (j !== B.app[k]) app[k] = { b: JSON.parse(B.app[k]), a: JSON.parse(j) }; });
    const audit = (S.audit || []).filter(e => !B.audit.has(e.id));
    const empty = !changes.length && !Object.keys(order).length && !Object.keys(app).length && !audit.length;
    return { body: { changes, order, app, audit }, empty };
}

let syncChain: Promise<boolean> = Promise.resolve(true);
export let syncBusy = 0;
export let syncFail = '';
export const syncLabel = () => (syncBusy ? '저장 중…' : syncFail ? '저장 실패' : '저장됨');

async function pushChanges(): Promise<boolean> {
    if (!S || !BASE) return true;
    const { body, empty } = collectChanges(); if (empty) return true;
    const next = makeBase();
    syncBusy++; notify();
    try {
        const r = await api<{ seq: number }>('POST', '/api/sync', body);
        BASE = next; syncFail = '';
        if (r && r.seq != null) S.seq = Math.max(S.seq || 0, r.seq);
        return true;
    } catch (e: any) {
        syncFail = e.message;
        if (e.status === 401) { sessionLost(); return false; }
        // 저장이 거절된 경우(충돌·검사 실패 등)는 오류 기록으로 (연결 끊김은 제외)
        if (e.status && e.status !== 419 && e.status < 500) reportError({ message: `저장 실패 (${e.status}${e.code ? ' ' + e.code : ''}): ${e.message}`, key: `sync:${e.status}:${e.code || ''}:${e.message}`, stack: `바뀐 병원 ${body.changes.filter((c: any) => c.c === 'hospitals').length}곳 · 항목 ${body.changes.length}개 · 앱 설정 ${Object.keys(body.app).join(',') || '-'}`, url: '/api/sync · ' + location.pathname });
        toast(e.message + ' · 서버에 저장된 내용으로 되돌립니다');
        await reloadState(true);
        return false;
    } finally { syncBusy--; notify(); }
}
/** 지금까지 바뀐 내용을 서버에 저장 (끝나면 성공 여부) */
export function saveNow() { syncChain = syncChain.then(pushChanges, pushChanges); return syncChain; }
/** 바뀐 내용을 저장하고 화면을 다시 그린다 */
export function save() { saveNow(); notify(); return true; }
export function waitSync() { return syncChain; }

/* ---------- 불러오기 ---------- */
let lastLoad = 0;
/* ---------- 오늘 동선: 서버에 저장해 PC·휴대폰이 같은 동선을 본다 ---------- */
let routeSaved = '';          // 서버와 맞춘 동선 (날짜|id들)
let routeLocalAt = '';        // 이 기기에서 마지막으로 바꾼 시각
let routeTimer: ReturnType<typeof setTimeout> | undefined;
const routeKey = (ids: string[]) => `${today()}|${ids.join(',')}`;
/** 서버 동선이 오늘 것이고 이 기기에서 바꾼 것보다 새로우면 받아 온다 */
function pullRoute() {
    if (!routeSaved) routeSaved = routeKey(ui.map.route);   // 처음 불러올 때 빈 동선을 서버에 덮어쓰지 않도록
    const r = S?.myRoute; if (!r || !Array.isArray(r.ids) || r.date !== today()) return;
    if (routeLocalAt && routeLocalAt >= r.at) return;
    const have = new Set(S.hospitals.filter(h => !h.deletedAt).map(h => h.id));
    ui.map.route = r.ids.filter(id => have.has(id)); routeSaved = routeKey(ui.map.route); routeLocalAt = r.at;
}
/** 화면이 바뀔 때마다 불러서, 동선이 바뀌었으면 잠시 뒤 서버에 저장 */
export function pushRoute() {
    if (!S) return; const k = routeKey(ui.map.route); if (k === routeSaved) return;
    routeSaved = k; routeLocalAt = new Date().toISOString(); clearTimeout(routeTimer);
    const ids = [...ui.map.route];
    routeTimer = setTimeout(() => { api<{ at: string }>('POST', '/api/me/route', { date: today(), ids }).then(r => { routeLocalAt = r.at; if (S) S.myRoute = { date: today(), ids, at: r.at }; }).catch(() => { routeSaved = ''; }); }, 600);
}

export async function loadState() {
    const st = await api<State>('GET', '/api/state');
    setViewOnly(!!st.viewAs);
    S = st; syncStages(); BASE = makeBase(); lastLoad = Date.now(); syncFail = ''; afterReset(st.settings?.resetAt);
    pullRoute();
    if (!S.roles.some(r => r.id === ui.roleSel)) ui.roleSel = S.roles.find(r => r.id === 'r_sales')?.id || S.roles[0]?.id;
    return S;
}
/** 대표 관리자: 다른 사용자 화면으로 보기 (보기 전용) / 관리자로 돌아가기 */
export async function startViewAs(id: string, name: string) {
    try { await api('POST', `/api/auth/impersonate/${id}`); } catch (e: any) { toast(e.message); return; }
    ui.detailId = null; ui.modal = null; ui.map.route = []; await loadState(); ui.view = 'today'; notify(); toast(`${name}님 화면으로 봅니다 · 보기 전용`);
}
export async function stopViewAs() {
    try { await api('POST', '/api/auth/impersonate/stop'); } catch (e: any) { toast(e.message); return; }
    setViewOnly(false); ui.detailId = null; ui.modal = null; ui.map.route = []; await loadState(); ui.view = 'users'; notify(); toast('관리자 화면으로 돌아왔습니다');
}
export async function reloadState(force: boolean) {
    if (!S) return;
    try {
        await loadState();
        if (ui.detailId && !S.hospitals.some(h => h.id === ui.detailId)) ui.detailId = null;
        notify();
    } catch (e: any) { if (e.status === 401) sessionLost(); else if (force) toast(e.message); }
}
/** 실사용 전 초기화 뒤 첫 접속: 이 기기에 남은 테스트 기간 임시 저장(활동 기록 쓰던 내용)·알림 읽음 표시를 지운다 */
function afterReset(at?: string) {
    if (!at) return;
    try {
        if (localStorage.getItem('vv-reset-seen') === at) return; const t = Date.parse(at);
        for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i) || ''; if (k.startsWith('vv-act-draft:')) { const d = JSON.parse(localStorage.getItem(k) || '{}'); if (!(d.savedAt > t)) localStorage.removeItem(k); } }
        localStorage.removeItem('vv-notif-hseen'); localStorage.setItem('vv-reset-seen', at);
    } catch { /* 저장 불가 */ }
}
export function clearState() { S = null as unknown as State; BASE = null; ui.detailId = null; ui.modal = null; ui.map.route = []; routeSaved = ''; routeLocalAt = ''; }
export function sessionLost() {
    clearState(); ui.loginTab = 'login'; ui.loginMsg = '로그인이 끝났습니다. 다시 로그인하세요.'; notify();
}

// 다른 사람이 바꾼 내용: 서버에 '데이터 버전'만 물어보고(아주 작은 응답) 바뀌었을 때만 전체를 다시 받는다
// - 창·앱으로 돌아올 때(20초 이상 지났으면), 화면을 계속 띄워 두면 10분마다
onDataVer((prev, ver) => { if (S && S.dataVer === prev) S.dataVer = ver; });
let lastCheck = Date.now();
export async function checkFresh(force = false, minGap = 0) {
    if (!S || syncBusy || (!force && (ui.modal || confirmOpen())) || Date.now() - lastCheck < minGap) return;
    lastCheck = Date.now();
    try { const r = await api<{ v: string }>('GET', '/api/ping'); if (S && r.v !== S.dataVer) await syncChain.then(() => reloadState(false)); }
    catch (e: any) { if (e.status === 401) sessionLost(); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 20000) checkFresh(); });
setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 9.5 * 60e3) checkFresh(); }, 60e3);
window.addEventListener('beforeunload', e => { if (syncBusy) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- 확인·입력 대화상자 ---------- */
export type Dialog = { kind: 'confirm' | 'prompt'; title: string; body?: ReactNode; ok?: string; danger?: boolean; input?: string; value?: string; resolve: (v: any) => void } | null;
export let dialog: Dialog = null;
const confirmOpen = () => !!dialog;
/** 확인 창. input 이 있으면 {v: 입력값} 을, 취소하면 false 를 돌려준다 */
export function confirmBox(o: { title: string; body?: ReactNode; ok?: string; danger?: boolean; input?: string }): Promise<any> {
    return new Promise(resolve => { dialog = { kind: 'confirm', ...o, resolve: v => { dialog = null; notify(); resolve(v); } }; notify(); });
}
export function promptBox(title: string, value: string): Promise<string | null> {
    return new Promise(resolve => { dialog = { kind: 'prompt', title, value, resolve: v => { dialog = null; notify(); resolve(v); } }; notify(); });
}
