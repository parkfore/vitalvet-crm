// 알림 모아 보기: 상단 종 + 목록 창 + (허락하면) 브라우저 알림
import { useEffect, useState } from 'react';
import { attManager, can, canRep, canReview, cur, liveH, roleOf } from '../lib/domain';
import { compDays, compSoon } from '../lib/hinfo';
import { I } from '../lib/icons';
import { notify, S, setView, toast, ui } from '../lib/store';
import { api } from '../lib/api';
import { pushOff, pushOn, pushStatus, rememberPush, type PushStatus } from '../lib/push';
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

export function BellButton({ cls = '' }: { cls?: string }) {
    const items = notifItems(); const n = items.length; const crit = items.some(x => x.level === 'crit');
    return <button className={`bell-btn ${cls}`} aria-label={`알림 ${n}건`} title="알림" onClick={() => { ui.modal = { type: 'notif' }; notify(); }}>{I.bell}{n ? <span className={`bell-n ${crit ? 'crit' : ''}`}>{n > 9 ? '9+' : n}</span> : null}</button>;
}

export function NotifModal() {
    const items = notifItems(); const [st, setSt] = useState<PushStatus | ''>('');
    useEffect(() => { pushStatus().then(setSt); }, []);
    return <Modal title="알림" size="sm">
        {items.length ? <ul className="notif-list">{items.map(n => <li key={n.key} className={`nl-${n.level}`}><button onClick={() => { ui.modal = null; n.go(); }}><b>{n.title}</b><small>{n.desc}</small></button></li>)}</ul>
            : <div className="empty">확인할 알림이 없습니다</div>}
        <div className="notif-perm"><span className="hint">{st === 'on' ? '이 기기로 알림이 옵니다 (화면을 닫아도)' : st === 'ios-install' ? '아이폰은 홈 화면에 추가한 앱에서 알림을 켤 수 있습니다' : st === 'denied' ? '이 브라우저에서 알림이 막혀 있습니다' : st === 'unsupported' ? '이 브라우저는 알림을 지원하지 않습니다' : '이 기기는 아직 알림을 받지 않습니다'}</span>
            <button className="btn sm" data-act="notifPrefs" onClick={() => { ui.modal = { type: 'notifPrefs' }; notify(); }}>{I.bell}알림 설정</button></div>
    </Modal>;
}

/* ---------------- 내 알림 설정 ---------------- */
const GROUP: Record<string, string> = { mine: '내 일', team: '팀 소식 (관리자·팀장)', brief: '하루 요약' };
export const seesTeam = () => { const me = cur(); return !!me && (me.roleId === 'r_admin' || (roleOf(me)?.scope === 'all' && canRep('update')) || attManager() || can('users', 'update')); };

function DeviceBox() {
    const [st, setSt] = useState<PushStatus | ''>(''); const [busy, setBusy] = useState(false);
    useEffect(() => { pushStatus().then(setSt); }, []);
    const run = async (f: () => Promise<PushStatus>, okMsg: string) => { setBusy(true); try { const r = await f(); setSt(r); rememberPush(r === 'on'); if (r === 'on' || r === 'off') toast(okMsg); else if (r === 'denied') toast('알림이 막혀 있습니다. 아래 안내대로 허용해 주세요'); } catch (e: any) { toast(e.message || '알림을 켜지 못했습니다'); } finally { setBusy(false); } };
    async function test() { setBusy(true); try { const r = await api<{ ok: number; total: number }>('POST', '/api/notif/test'); toast(r.ok ? `테스트 알림을 보냈습니다 (${r.ok}/${r.total}대)` : '보내지 못했습니다. 이 기기에서 알림을 다시 켜 주세요'); } catch (e: any) { toast(e.message); } finally { setBusy(false); } }
    const dev = S.notif?.devices || 0;
    return <div className={`np-device ${st === 'on' ? 'on' : ''}`} id="np-device">
        <div><b>{st === 'on' ? '이 기기에서 알림 받는 중' : '이 기기는 알림을 받지 않음'}</b><small>내 계정에 등록된 기기 {fmtN(dev)}대 · 휴대폰·PC 모두 등록할 수 있습니다</small></div>
        <div className="np-dev-act">{st === 'on' ? <><button className="btn sm" disabled={busy} data-act="pushTest" onClick={test}>테스트 알림</button><button className="btn sm" disabled={busy} onClick={() => run(pushOff, '이 기기 알림을 껐습니다')}>이 기기 끄기</button></>
            : st === 'off' ? <button className="btn primary sm" disabled={busy} data-act="pushOn" onClick={() => run(pushOn, '이 기기에서 알림을 받습니다')}>{I.bell}이 기기에서 알림 받기</button> : null}</div>
        {st === 'ios-install' ? <p className="hint np-guide">아이폰·아이패드: 사파리 아래쪽 <b>공유 버튼</b> → <b>홈 화면에 추가</b> → 홈 화면의 VitalVET 아이콘으로 열고 로그인 → 다시 이 화면에서 "알림 받기"를 누르세요. (iOS 16.4 이상)</p> : null}
        {st === 'denied' ? <p className="hint np-guide">주소창 왼쪽 자물쇠(또는 설정) › 사이트 설정 › <b>알림 허용</b>으로 바꾼 뒤 새로고침하세요. 휴대폰은 설정 › 앱 › 브라우저 › 알림도 켜져 있어야 합니다.</p> : null}
        {st === 'unsupported' ? <p className="hint np-guide">이 브라우저는 웹 알림을 지원하지 않습니다. 크롬·엣지·삼성 인터넷(안드로이드) 또는 홈 화면에 추가한 사파리(아이폰)를 써 주세요.</p> : null}
    </div>;
}

export function NotifPrefsModal() {
    const N = S.notif!; const base = N.base; const lock = new Set(N.locked); const team = seesTeam(); const admin = cur()?.roleId === 'r_admin';
    const [d, setD] = useState(() => ({ off: !!N.mine.off, types: { ...base.types, ...(N.mine.types || {}) } as Record<string, boolean>, morning: N.mine.morning ?? base.morning, evening: N.mine.evening ?? base.evening, quietOn: N.mine.quietOn ?? base.quietOn, quietFrom: N.mine.quietFrom ?? base.quietFrom, quietTo: N.mine.quietTo ?? base.quietTo, weekend: N.mine.weekend ?? base.weekend }));
    const [busy, setBusy] = useState(false);
    const types = N.types.filter(t => t.group !== 'team' || (team && (t.key !== 'sys_error' || admin)));
    const changed = (k: string) => !lock.has(k) && d.types[k] !== base.types[k];
    async function saveP() {
        const prefs: any = { types: {} as Record<string, boolean>, off: d.off };
        types.forEach(t => { if (changed(t.key)) prefs.types[t.key] = d.types[t.key]; });
        (['morning', 'evening', 'quietOn', 'quietFrom', 'quietTo', 'weekend'] as const).forEach(k => { if (d[k] !== (base as any)[k]) prefs[k] = d[k]; });
        setBusy(true);
        try { const r = await api<{ notif: any }>('POST', '/api/notif/me', { prefs }); S.notif = r.notif; ui.modal = null; toast('알림 설정을 저장했습니다'); } catch (e: any) { toast(e.message); } finally { setBusy(false); }
    }
    const reset = () => setD({ off: false, types: { ...base.types }, morning: base.morning, evening: base.evening, quietOn: base.quietOn, quietFrom: base.quietFrom, quietTo: base.quietTo, weekend: base.weekend });
    const row = (t: typeof N.types[0]) => {
        const locked = lock.has(t.key); const on = locked || d.types[t.key];
        const time = t.key === 'morning' || t.key === 'evening' ? <input type="time" id={`np-${t.key}-at`} value={d[t.key as 'morning']} disabled={!on || (d.off && !locked)} onChange={e => setD({ ...d, [t.key]: e.target.value })} /> : null;
        return <li key={t.key} className={`np-row ${locked ? 'locked' : ''}`}><label><input type="checkbox" id={`np-${t.key}`} checked={on} disabled={locked || d.off} onChange={e => setD({ ...d, types: { ...d.types, [t.key]: e.target.checked } })} />
            <span><span className="np-t"><b>{t.label}</b>{locked ? <em className="np-lock">🔒 관리자 고정</em> : changed(t.key) ? <em className="np-mine">내가 바꿈</em> : null}</span><small>{t.desc}</small></span></label>{time}</li>;
    };
    return <Modal title="내 알림 설정" size="wide" foot={<><button className="btn" onClick={reset} style={{ marginRight: 'auto' }}>모두 기본값으로</button><button className="btn" onClick={() => { ui.modal = null; notify(); }}>취소</button><button className="btn primary" data-act="npSave" disabled={busy} onClick={saveP}>저장</button></>}>
        <DeviceBox />
        <label className="np-all"><input type="checkbox" id="np-off" checked={d.off} onChange={e => setD({ ...d, off: e.target.checked })} /><span><b>내 알림 모두 끄기</b><small>{lock.size ? '관리자가 고정한 알림은 계속 받습니다. ' : ''}내가 한 일은 관리자·팀장에게 그대로 알림이 갑니다.</small></span></label>
        {(['mine', 'team', 'brief'] as const).map(g => { const L = types.filter(t => t.group === g); return L.length ? <section key={g} className="np-sec"><h3 className="rv-h">{GROUP[g]}</h3><ul className="np-list">{L.map(row)}</ul></section> : null; })}
        <section className="np-sec"><h3 className="rv-h">조용한 시간·주말</h3>
            <div className="np-quiet"><label><input type="checkbox" id="np-quiet" checked={d.quietOn} onChange={e => setD({ ...d, quietOn: e.target.checked })} /><b>조용한 시간</b></label>
                <input type="time" id="np-qfrom" value={d.quietFrom} disabled={!d.quietOn} onChange={e => setD({ ...d, quietFrom: e.target.value })} /><span>~</span><input type="time" id="np-qto" value={d.quietTo} disabled={!d.quietOn} onChange={e => setD({ ...d, quietTo: e.target.value })} /></div>
            <label className="np-wk"><input type="checkbox" id="np-weekend" checked={d.weekend} onChange={e => setD({ ...d, weekend: e.target.checked })} /><b>주말·공휴일에도 받기</b></label>
            <p className="hint">조용한 시간과 쉬는 날에 생긴 알림은 모아 두었다가 조용한 시간이 끝나면 보냅니다. 아침 요약·저녁 알림은 쉬는 날에는 보내지 않습니다{d.weekend ? ' (지금은 쉬는 날에도 받음)' : ''}.</p></section>
        <p className="hint">처음 값은 관리자가 역할별로 정한 기본값입니다. 바꾼 항목만 내 설정으로 저장되고, 나머지는 관리자가 기본값을 바꾸면 함께 바뀝니다. 바꾼 내용은 관리자가 볼 수 있습니다.</p>
    </Modal>;
}
