// 로그인 · 회원가입 신청 · 로그아웃 · 비밀번호 변경
import { useEffect, useRef, useState } from 'react';
import { Modal, PasswordInput } from '../components/ui';
import { api } from '../lib/api';
import { USERNAME_RE } from '../lib/constants';
import { can, cur, roleOf } from '../lib/domain';
import { I } from '../lib/icons';
import { startMaps } from '../lib/maps';
import { clearState, loadState, notify, toast, ui, waitSync } from '../lib/store';
import { fmtPhone } from '../lib/utils';
import { goTo } from '../lib/ux';

export async function doLogout() {
    try { await waitSync(); } catch { /* 저장 실패해도 로그아웃 */ }
    try { await api('POST', '/api/auth/logout'); } catch { /* 이미 끝난 세션 */ }
    ui.loginUser = cur()?.username || ''; clearState(); ui.loginMsg = ''; ui.loginTab = 'login'; notify();
}

export function Login() {
    const L = ui.loginTab;
    const [user, setUser] = useState(ui.loginUser); const [pw, setPw] = useState('');
    const [f, setF] = useState({ name: '', username: '', password: '', password2: '', team: '', phone: '' });
    const [busy, setBusy] = useState(false); const [teams, setTeams] = useState<string[] | null>(null);
    useEffect(() => { if (L === 'signup' && !teams) api<{ teams: string[] }>('GET', '/api/auth/teams').then(r => setTeams(r.teams || [])).catch(() => setTeams([])); }, [L, teams]);
    const userRef = useRef<HTMLInputElement>(null); const pwRef = useRef<HTMLInputElement>(null);
    useEffect(() => { if (L === 'login') setTimeout(() => (ui.loginUser ? pwRef.current : userRef.current)?.focus(), 20); }, [L]);
    const msg = (m: string) => { ui.loginMsg = m; notify(); };

    async function doLogin() {
        if (busy) return; const u = user.trim().toLowerCase(); ui.loginUser = u;
        if (!u || !pw) { msg('아이디와 비밀번호를 입력하세요.'); goTo(u ? '#li-pw' : '#li-user'); return; }
        setBusy(true);
        try {
            await api('POST', '/api/auth/login', { username: u, password: pw }); await loadState();
            ui.loginMsg = ''; ui.view = can('myday', 'view') ? 'today' : 'dash'; ui.list.owner = ''; ui.detailId = null; ui.modal = null; notify(); startMaps();
            toast(`${cur()!.name}님(${roleOf(cur())!.name})으로 로그인했습니다`);
        } catch (e: any) { setBusy(false); msg(e.message); setTimeout(() => pwRef.current?.focus(), 20); }
    }
    async function doSignup() {
        const username = f.username.trim().toLowerCase();
        if (!f.name.trim()) { msg('이름을 입력하세요.'); goTo('#su-name'); return; }
        if (!USERNAME_RE.test(username)) { msg('아이디는 영문 소문자로 시작하고 영문 소문자·숫자·. _ - 로 4~30자여야 합니다.'); goTo('#su-username'); return; }
        if (f.password.length < 8) { msg('비밀번호는 8자 이상이어야 합니다.'); goTo('#su-pw'); return; }
        if (f.password !== f.password2) { msg('비밀번호 확인이 일치하지 않습니다.'); goTo('#su-pw2'); return; }
        if (!f.team) { msg('소속을 선택하세요.'); goTo('#su-team'); return; }
        try { await api('POST', '/api/auth/signup', { name: f.name.trim(), username, password: f.password, team: f.team.trim(), phone: fmtPhone(f.phone) }); }
        catch (e: any) { msg(e.message); return; }
        ui.loginUser = username; setUser(username); setF({ name: '', username: '', password: '', password2: '', team: '', phone: '' }); ui.loginTab = 'login'; ui.loginMsg = ''; notify();
        toast('가입 신청 완료 · 관리자 승인 후 로그인할 수 있습니다');
    }
    const enter = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); fn(); } };
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

    return <div id="loginLayer"><div className="login"><div className="login-card">
        <div className="login-intro"><div className="brand" style={{ padding: 0 }}><div className="brand-mark">{I.logo}</div><div><b>VitalVET</b><small>영업 CRM</small></div></div>
            <h1>VitalVET 영업 CRM</h1><p>병원 리드 관리부터 방문 기록, 일일 영업 보고, 근태 일정까지 한곳에서 관리합니다. 역할마다 보이는 메뉴와 할 수 있는 작업이 다르고, 모든 등록·수정·삭제는 로그인한 사람 이름으로 변경 이력에 남습니다.</p>
            <ul><li><b>관리자</b> · 모든 기능, 사용자·권한 관리</li><li><b>영업팀장</b> · 전체 병원 관리, 사용자는 조회만</li><li><b>영업사원</b> · 담당 병원만 수정, 삭제 불가</li><li><b>조회 전용</b> · 읽기만, 전환·사용 숨김</li></ul>
            <p style={{ marginTop: 12 }} className="hint">계정이 없으면 회원가입을 신청하세요. 관리자가 승인하고 역할을 지정하면 로그인할 수 있습니다.</p></div>
        <section className="panel"><div className="sub-tabs">
            <button className={`tab ${L === 'login' ? 'on' : ''}`} onClick={() => { ui.loginTab = 'login'; ui.loginMsg = ''; notify(); }}>로그인</button>
            <button className={`tab ${L === 'signup' ? 'on' : ''}`} onClick={() => { ui.loginTab = 'signup'; ui.loginMsg = ''; notify(); }}>회원가입 신청</button></div>
            {L === 'login' ? <>
                <div className="form-grid login-form">
                    <label className="fld span2"><span>아이디</span><input id="li-user" ref={userRef} value={user} onChange={e => setUser(e.target.value)} onKeyDown={enter(doLogin)} autoComplete="username" autoCapitalize="off" spellCheck={false} placeholder="아이디" /></label>
                    <label className="fld span2"><span>비밀번호</span><PasswordInput id="li-pw" ref={pwRef} value={pw} onChange={e => setPw(e.target.value)} onKeyDown={enter(doLogin)} autoComplete="current-password" placeholder="비밀번호" /></label>
                    {ui.loginMsg ? <p className="err span2">{ui.loginMsg}</p> : null}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="btn primary" id="doLogin" onClick={doLogin} disabled={busy}>로그인</button></div>
            </> : <>
                <div className="form-grid">
                    <label className="fld"><span>이름 <em>*</em></span><input id="su-name" value={f.name} onChange={set('name')} /></label>
                    <label className="fld"><span>아이디 <em>*</em> <small>영문 소문자로 시작, 4~30자</small></span><input id="su-username" value={f.username} onChange={set('username')} autoComplete="username" autoCapitalize="off" spellCheck={false} placeholder="예: sumin.lee" /></label>
                    <label className="fld"><span>비밀번호 <em>*</em> <small>8자 이상</small></span><PasswordInput id="su-pw" value={f.password} onChange={set('password')} autoComplete="new-password" /></label>
                    <label className="fld"><span>비밀번호 확인 <em>*</em></span><PasswordInput id="su-pw2" value={f.password2} onChange={set('password2')} onKeyDown={enter(doSignup)} autoComplete="new-password" /></label>
                    <label className="fld"><span>소속 <em>*</em></span><select id="su-team" value={f.team} onChange={e => setF({ ...f, team: e.target.value })}><option value="">{teams ? '선택' : '불러오는 중…'}</option>{(teams || []).map(t => <option key={t}>{t}</option>)}</select></label>
                    <label className="fld"><span>연락처</span><input id="su-phone" value={f.phone} onChange={set('phone')} onBlur={() => setF({ ...f, phone: fmtPhone(f.phone) })} inputMode="tel" /></label>
                    {ui.loginMsg ? <p className="err span2">{ui.loginMsg}</p> : null}<p className="hint span2">신청하면 관리자가 승인하고 역할을 지정할 때까지 로그인할 수 없습니다.</p></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="btn primary" onClick={doSignup}>가입 신청</button></div>
            </>}
        </section></div></div></div>;
}

export function PasswordModal() {
    const [f, setF] = useState({ current: '', password: '', password2: '' }); const [err, setErr] = useState('');
    async function saveIt() {
        if (!f.current) { setErr('현재 비밀번호를 입력하세요.'); return; } if (f.password.length < 8) { setErr('새 비밀번호는 8자 이상이어야 합니다.'); return; }
        if (f.password !== f.password2) { setErr('새 비밀번호 확인이 일치하지 않습니다.'); return; }
        try { await api('POST', '/api/auth/password', { current: f.current, password: f.password }); ui.modal = null; notify(); toast('비밀번호를 바꿨습니다'); } catch (e: any) { setErr(e.message); }
    }
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
    return <Modal title="비밀번호 변경" size="sm" foot={<><button className="btn" onClick={() => { ui.modal = null; notify(); }}>취소</button><button className="btn primary" onClick={saveIt}>변경</button></>}>
        <div className="form-grid">
            <label className="fld span2"><span>현재 비밀번호</span><PasswordInput id="pw-cur" autoFocus value={f.current} onChange={set('current')} autoComplete="current-password" /></label>
            <label className="fld"><span>새 비밀번호 <small>8자 이상</small></span><PasswordInput id="pw-new" value={f.password} onChange={set('password')} autoComplete="new-password" /></label>
            <label className="fld"><span>새 비밀번호 확인</span><PasswordInput id="pw-new2" value={f.password2} onChange={set('password2')} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveIt(); }} autoComplete="new-password" /></label>
            {err ? <p className="err span2">{err}</p> : null}</div>
    </Modal>;
}
