// 왼쪽 메뉴(PC)·아래 탭(휴대폰)·더보기 메뉴
import { canSee, cur, roleOf } from '../lib/domain';
import { I } from '../lib/icons';
import { mapStatusLabel, mapReady } from '../lib/maps';
import { notify, S, setView, syncBusy, syncFail, syncLabel, ui } from '../lib/store';
import type { Feature } from '../lib/constants';
import { Av, Modal } from './ui';
import { doLogout } from '../pages/Login';

export const MENUS: [string, string, keyof typeof I, Feature][] = [
    ['today', '오늘 할 일', 'today', 'myday'], ['dash', '대시보드', 'dash', 'dash'], ['list', '병원 관리', 'list', 'hospital'], ['map', '지도', 'map', 'map'],
    ['report', '영업 보고', 'report', 'report'], ['team', '팀 성과', 'team', 'team'], ['attend', '근태 일정', 'cal', 'attendance'], ['cat', '카테고리', 'cat', 'category'],
    ['comp', '경쟁사', 'comp', 'competitor'], ['history', '변경 이력', 'hist', 'history'], ['users', '사용자·권한', 'users', 'users'], ['settings', '설정', 'set', 'settings'],
];
export const visMenus = () => MENUS.filter(m => canSee(m[3]));
const go = (v: string) => { setView(v); document.querySelector('#main')?.scrollTo(0, 0); };
const openPw = () => { ui.modal = { type: 'pw' }; notify(); };

export function Nav() {
    const u = cur()!; const r = roleOf(u); const vm = visMenus();
    return <nav className="nav" id="nav">
        <div className="brand"><div className="brand-mark">{I.logo}</div><div><b>VitalVET</b><small>영업 CRM</small></div></div>
        {vm.map(([k, l, ic]) => <button key={k} className={`nav-btn ${ui.view === k ? "on" : ""}`} data-v={k} onClick={() => go(k)}>{I[ic]}{l}</button>)}
        <div className="user-box"><Av u={u} /><div><b>{u.name}</b><small>{r?.name} · {u.team}</small></div><button className="btn sm" onClick={doLogout}>로그아웃</button></div>
        <div className="nav-foot"><div><span className="dot" style={{ background: mapReady() ? 'var(--ok)' : 'var(--warn)' }} />{mapStatusLabel()} · <span id="syncState" className={syncFail ? 'sync-err' : syncBusy ? 'sync-busy' : ''}>{syncLabel()}</span></div>
            <button className="link-btn" onClick={openPw}>비밀번호 변경</button></div>
    </nav>;
}

export function Tabbar() {
    const vm = visMenus(); const tb: [string, string, keyof typeof I][] = vm.length > 5 ? [...vm.slice(0, 4).map(m => [m[0], m[1], m[2]] as [string, string, keyof typeof I]), ['more', '더보기', 'more']] : vm.map(m => [m[0], m[1], m[2]]);
    return <div className="tabbar" id="tabbar" style={{ gridTemplateColumns: `repeat(${tb.length},1fr)` }}>
        {tb.map(([k, l, ic]) => <button key={k} data-v={k} data-act={k === "more" ? "moreMenu" : "go"} className={ui.view === k || (k === "more" && !vm.slice(0, 4).some(m => m[0] === ui.view)) ? "on" : ""}
            onClick={() => { if (k === 'more') { ui.modal = { type: 'more' }; notify(); } else go(k); }}>{I[ic]}{l}</button>)}
    </div>;
}

export function MoreMenu() {
    const u = cur()!;
    return <Modal title="메뉴" size="sm">
        <div className="more-list">{visMenus().slice(4).map(([k, l, ic]) => <button key={k} className={`nav-btn ${ui.view === k ? "on" : ""}`} data-v={k} onClick={() => go(k)}>{I[ic]}{l}</button>)}</div>
        <div className="user-box" style={{ marginTop: 12 }}><Av u={u} /><div><b>{u.name}</b><small>{roleOf(u)?.name} · {u.username}</small></div>
            <button className="icon-btn" onClick={openPw} aria-label="비밀번호 변경">{I.lock}</button><button className="btn sm" onClick={doLogout}>로그아웃</button></div>
    </Modal>;
}
export const hasState = () => !!S;
