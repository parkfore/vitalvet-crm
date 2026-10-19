// 알림 모아 보기: 상단 종 + 목록 창 + (허락하면) 브라우저 알림
import { useEffect } from 'react';
import { attManager, can, canRep, canReview, cur, liveH } from '../lib/domain';
import { compDays, compSoon } from '../lib/hinfo';
import { I } from '../lib/icons';
import { notify, S, setView, ui } from '../lib/store';
import { today } from '../lib/utils';
import { fmtN } from '../lib/utils';
import { Modal } from './ui';
import { openReportAt } from '../pages/Report';

export type Notif = { key: string; level: 'crit' | 'warn' | 'info'; title: string; desc: string; go: () => void };

const goList = (p: Partial<typeof ui.list>) => { Object.assign(ui.list, { q: '', cat: '', stage: '', pre: '', src: '', grade: '', follow: '', owner: '', biz: '', info: '', sido: '', deleted: false }, p); setView('list'); };

/** 지금 나에게 해당하는 알림 (가장 급한 것부터) */
export function notifItems(): Notif[] {
    const me = cur(); if (!me || !S) return [];
    const t = today(); const out: Notif[] = [];
    const mine = liveH().filter(h => h.ownerId === me.id);
    const ret = S.reports.filter(r => r.authorId === me.id && r.status === 'returned');
    if (ret.length && canRep('create')) out.push({ key: `ret:${ret.map(r => r.id).join(',')}`, level: 'crit', title: `반려된 보고서 ${fmtN(ret.length)}건`, desc: ret.map(r => r.date.slice(5).replace('-', '/')).join(', ') + ' · 보완해서 다시 제출하세요', go: () => openReportAt(ret[0].date) });
    const coach = (S.coaching || []).filter(n => n.userId === me.id && !n.readAt);
    if (coach.length) out.push({ key: `coach:${coach.map(n => n.id).join(',')}`, level: 'warn', title: `새 코칭 메모 ${fmtN(coach.length)}건`, desc: `${coach[0].authorName}: ${coach[0].text.slice(0, 40)}`, go: () => { setView('today'); setTimeout(() => document.getElementById('coachPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); } });
    const over = mine.filter(h => h.next?.date && !h.next.done && h.next.date < t);
    if (over.length && can('activity', 'read')) out.push({ key: `over:${t}:${over.length}`, level: 'crit', title: `지연된 팔로우업 ${fmtN(over.length)}곳`, desc: '다음 액션일이 지난 담당 병원', go: () => goList({ follow: '지연', owner: '__me' }) });
    const tod = mine.filter(h => h.next?.date === t && !h.next.done);
    if (tod.length && can('activity', 'read')) out.push({ key: `today:${t}:${tod.length}`, level: 'info', title: `오늘 할 팔로우업 ${fmtN(tod.length)}곳`, desc: tod.slice(0, 3).map(h => h.name).join(', '), go: () => setView('today') });
    const comp = mine.filter(h => compSoon(h) && (compDays(h) ?? 99) <= 14);
    if (comp.length) out.push({ key: `comp:${t}:${comp.map(h => h.id).join(',')}`, level: 'warn', title: `경쟁 제품 계약 만료 임박 ${fmtN(comp.length)}곳`, desc: comp.slice(0, 3).map(h => `${h.name} (${(compDays(h) ?? 0) < 0 ? '만료됨' : 'D-' + compDays(h)})`).join(', '), go: () => { setView('today'); setTimeout(() => document.getElementById('compSoon')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); } });
    const rev = S.reports.filter(r => r.status === 'submitted' && canReview(r));
    if (rev.length) out.push({ key: `rev:${rev.map(r => r.id).join(',')}`, level: 'info', title: `검토 대기 보고서 ${fmtN(rev.length)}건`, desc: '영업 보고 › 제출 현황에서 확인·반려', go: () => { ui.rep.tab = 'status'; setView('report'); } });
    const pend = S.users.filter(u => u.status === 'pending');
    if (pend.length && can('users', 'update')) out.push({ key: `pend:${pend.map(u => u.id).join(',')}`, level: 'warn', title: `가입 승인 대기 ${fmtN(pend.length)}명`, desc: pend.slice(0, 3).map(u => u.name).join(', '), go: () => { ui.usersTab = 'users'; setView('users'); } });
    const att = (S.attendance || []).filter(a => a.status === 'requested' && a.userId !== me.id);
    if (att.length && attManager()) out.push({ key: `att:${att.map(a => a.id).join(',')}`, level: 'info', title: `근태 승인 대기 ${fmtN(att.length)}건`, desc: '근태 일정에서 승인·반려', go: () => setView('attend') });
    const errs = (S as any).errorCount as number | undefined;
    if (errs && cur()?.roleId === 'r_admin') out.push({ key: `err:${errs}`, level: 'crit', title: `최근 24시간 오류 ${fmtN(errs)}건`, desc: '사용자·권한 › 오류 기록에서 확인', go: () => { ui.usersTab = 'errors'; setView('users'); } });
    return out;
}

/* ---------- 브라우저 알림 (앱이 열려 있을 때, 새 알림이 생기면) ---------- */
const SEEN = 'vv-notif-seen';
const seen = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } };
const setSeen = (s: Set<string>) => { try { localStorage.setItem(SEEN, JSON.stringify([...s].slice(-200))); } catch { /* 저장 불가 */ } };
export const notifSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export function useBrowserNotify(items: Notif[]) {
    const keys = items.map(n => n.key).join('|');
    useEffect(() => {
        if (!notifSupported() || Notification.permission !== 'granted') return;
        const s = seen(); const fresh = items.filter(n => !s.has(n.key) && n.level !== 'info');
        fresh.slice(0, 3).forEach(n => { try { const x = new Notification(`VitalVET · ${n.title}`, { body: n.desc, tag: n.key, icon: '/favicon.svg' }); x.onclick = () => { window.focus(); n.go(); x.close(); }; } catch { /* 일부 브라우저 */ } });
        items.forEach(n => s.add(n.key)); setSeen(s);
    }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function BellButton({ cls = '' }: { cls?: string }) {
    const items = notifItems(); const n = items.length; const crit = items.some(x => x.level === 'crit');
    return <button className={`bell-btn ${cls}`} aria-label={`알림 ${n}건`} title="알림" onClick={() => { ui.modal = { type: 'notif' }; notify(); }}>{I.bell}{n ? <span className={`bell-n ${crit ? 'crit' : ''}`}>{n > 9 ? '9+' : n}</span> : null}</button>;
}

export function NotifModal() {
    const items = notifItems();
    const perm = notifSupported() ? Notification.permission : 'unsupported';
    return <Modal title="알림" size="sm">
        {items.length ? <ul className="notif-list">{items.map(n => <li key={n.key} className={`nl-${n.level}`}><button onClick={() => { ui.modal = null; n.go(); }}><b>{n.title}</b><small>{n.desc}</small></button></li>)}</ul>
            : <div className="empty">확인할 알림이 없습니다</div>}
        <div className="notif-perm">{perm === 'granted' ? <span className="hint">브라우저 알림 켜짐 · 이 화면이 열려 있을 때 새 알림을 띄웁니다</span>
            : perm === 'denied' ? <span className="hint">브라우저 알림이 막혀 있습니다. 주소창 왼쪽 자물쇠 › 알림에서 허용하세요.</span>
                : perm === 'default' ? <button className="btn sm" onClick={() => Notification.requestPermission().then(() => notify())}>{I.bell}브라우저 알림 받기</button> : <span className="hint">이 브라우저는 알림을 지원하지 않습니다</span>}</div>
    </Modal>;
}
