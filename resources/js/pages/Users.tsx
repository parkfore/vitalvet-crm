// 사용자·권한: 가입 승인, 사용자 추가·수정·삭제(아이디·비밀번호), 역할별 권한 표
import { useState } from 'react';
import { Av, Modal, PasswordInput, PhoneInput, RoNote } from '../components/ui';
import { api } from '../lib/api';
import { FEATURES, OPS, USERNAME_RE } from '../lib/constants';
import { can, cur, isAdmin, liveH, logEntry, mutateH, need, roleOf, userById } from '../lib/domain';
import { I } from '../lib/icons';
import { confirmBox, notify, promptBox, S, save, saveNow, toast, ui } from '../lib/store';
import type { Role, User } from '../lib/types';
import { clone, fmtPhone, fmtTs, fd, phoneErr, today, uid, fmtN } from '../lib/utils';
import { goTo } from '../lib/ux';
import { AccessLogPanel, ErrorLogPanel, NotifAdminPanel } from '../components/AdminPanels';

const ST_L: Record<string, [string, string]> = { active: ['활성', 'st-active'], inactive: ['비활성', 'st-inactive'], pending: ['승인 대기', 'st-pending'] };
function permsOf(spec: Record<string, string>) { const p: Record<string, Record<string, boolean>> = {}; FEATURES.forEach(([k, , ops]) => { p[k] = {}; ops.forEach(o => (p[k][o] = !!(spec[k] || '').includes(o[0]))); }); return p; }

export function Users() {
    const T = ui.usersTab;
    async function newRole() {
        if (!need('users', 'create')) return; const n = await promptBox('새 역할 이름', ''); if (!n) return; if (S.roles.some(r => r.name === n)) { toast('같은 이름의 역할이 있습니다'); return; }
        const r: Role = { id: 'r_' + uid(), name: n, desc: '', scope: 'own', people: 'team', perms: permsOf({ dash: 'vr', hospital: 'vr' }) }; S.roles.push(r);
        logEntry({ entity: 'role', entityId: r.id, targetName: n, action: 'create', section: '역할', changes: [{ field: '이름', before: '', after: n }] }); ui.roleSel = r.id; save();
    }
    return <>
        <div className="page-head"><div><h1>사용자·권한</h1><p>가입 신청을 승인하고, 역할마다 메뉴별 표시·읽기·입력·수정·삭제 권한을 정합니다.</p></div>
            {T === 'users' && can('users', 'create') ? <button className="btn primary" data-act="newUser" onClick={() => { if (need('users', 'create')) { ui.modal = { type: 'user', f: { id: '', name: '', username: '', team: '', phone: '', roleId: 'r_sales', status: 'active', password: '' } }; notify(); } }}>{I.plus}사용자 추가</button> : null}
            {T === 'roles' && can('users', 'create') ? <button className="btn primary" onClick={newRole}>{I.plus}역할 추가</button> : null}</div>
        <div className="sub-tabs"><button className={`tab ${T === 'users' ? 'on' : ''}`} onClick={() => { ui.usersTab = 'users'; notify(); }}>사용자 <span className="n">{S.users.length}</span></button>
            <button className={`tab ${T === 'roles' ? 'on' : ''}`} data-act="usersTab" data-v="roles" onClick={() => { ui.usersTab = 'roles'; notify(); }}>역할별 권한 <span className="n">{S.roles.length}</span></button>
            {isAdmin() ? <button className={`tab ${T === 'logs' ? 'on' : ''}`} data-act="usersTab" data-v="logs" onClick={() => { ui.usersTab = 'logs'; notify(); }}>접속·이용 기록</button> : null}
            {isAdmin() ? <button className={`tab ${T === 'notif' ? 'on' : ''}`} data-act="usersTab" data-v="notif" onClick={() => { ui.usersTab = 'notif'; notify(); }}>알림 설정</button> : null}
            {isAdmin() ? <button className={`tab ${T === 'errors' ? 'on' : ''}`} data-act="usersTab" data-v="errors" onClick={() => { ui.usersTab = 'errors'; notify(); }}>오류 기록{(S as any).errorCount ? <span className="n" style={{ background: 'var(--danger)', color: '#fff' }}>{fmtN((S as any).errorCount)}</span> : null}</button> : null}</div>
        {T === 'users' ? <UsersTable /> : T === 'logs' && isAdmin() ? <AccessLogPanel /> : T === 'errors' && isAdmin() ? <ErrorLogPanel /> : T === 'notif' && isAdmin() ? <NotifAdminPanel /> : <RolesPanel key={ui.roleSel} />}
    </>;
}

function UsersTable() {
    const pend = S.users.filter(u => u.status === 'pending'); const cU = can('users', 'update'), cD = can('users', 'delete'); const me = cur()!;
    const [ap, setAp] = useState<Record<string, string>>({});
    const lastAct = (id: string) => { const e = [...S.audit].reverse().find(x => x.userId === id); return e ? fmtTs(e.ts) : '—'; };
    function approve(u: User) {
        if (!need('users', 'update')) return; const rid = ap[u.id] || 'r_sales'; const rn = S.roles.find(r => r.id === rid)!.name;
        logEntry({ entity: 'user', entityId: u.id, targetName: u.name, action: 'update', section: '가입 승인', changes: [{ field: '상태', before: '승인 대기', after: '활성' }, { field: '역할', before: '', after: rn }] });
        u.status = 'active'; u.roleId = rid; save(); toast(`${u.name} 승인 · ${rn}`);
    }
    async function reject(u: User) {
        if (!need('users', 'delete')) return;
        if (!await confirmBox({ title: '가입 신청을 거절할까요?', body: <p>{u.name} ({u.username})의 신청이 삭제됩니다.</p>, ok: '거절', danger: true })) return;
        logEntry({ entity: 'user', entityId: u.id, targetName: u.name, action: 'delete', section: '가입 거절', changes: [{ field: '상태', before: '승인 대기', after: '거절' }] }); S.users = S.users.filter(x => x !== u); save();
    }
    async function delUser(u: User) {
        if (!need('users', 'delete')) return; const own = S.hospitals.filter(h => h.ownerId === u.id);
        if (u.roleId === 'r_admin' && S.users.filter(x => x.roleId === 'r_admin').length < 2) { toast('마지막 관리자는 삭제할 수 없습니다'); return; }
        if (!await confirmBox({ title: `${u.name}님을 삭제할까요?`, body: <><p>로그인할 수 없게 됩니다. {own.length ? <>담당 병원 {own.length}곳은 <b>담당 미지정</b>으로 바뀌고 각 병원 이력에 기록됩니다. </> : null}이 사람이 남긴 기록과 변경 이력은 이름과 함께 그대로 남습니다.</p><p className="hint">퇴사자는 삭제 대신 비활성으로 두는 것을 권장합니다.</p></>, ok: '삭제', danger: true })) return;
        own.forEach(h => mutateH(h, '기본 정보', x => { x.ownerId = ''; }, { summary: `담당자 ${u.name} 계정 삭제` }));
        logEntry({ entity: 'user', entityId: u.id, targetName: u.name, action: 'delete', section: '사용자', changes: [{ field: '아이디', before: u.username, after: '' }, { field: '역할', before: roleOf(u)?.name || '', after: '' }] });
        S.users = S.users.filter(x => x !== u); save(); toast(`${u.name} 삭제됨`);
    }
    return <>
        {pend.length ? <div className="pending-box"><b>가입 승인 대기 {fmtN(pend.length)}명</b>{pend.map(u => <div key={u.id} className="pending-row"><div className="u-cell"><Av u={u} /><div><b>{u.name}</b><small>{u.username} · {u.team || '소속 미입력'} · 신청 {fd(u.joinedAt)}</small></div></div>
            {cU ? <><select id={`ap-${u.id}`} aria-label="역할" value={ap[u.id] || 'r_sales'} onChange={e => setAp({ ...ap, [u.id]: e.target.value })}>{S.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><button className="btn primary sm" data-act="approve" data-v={u.id} onClick={() => approve(u)}>승인</button></> : null}
            {cD ? <button className="btn sm danger" onClick={() => reject(u)}>거절</button> : null}</div>)}</div> : null}
        <div className="tbl-wrap"><table className="stack"><thead><tr><th>사용자</th><th>소속</th><th>역할</th><th>상태</th><th>담당 병원</th><th>최근 작업</th><th /></tr></thead><tbody>
            {S.users.filter(u => u.status !== 'pending').map(u => <tr key={u.id}><td><div className="u-cell"><Av u={u} /><div><b>{u.name}{u.id === me.id ? <> <span className="badge f-예정" style={{ padding: '0 6px' }}>나</span></> : null}</b><small>{u.username}</small></div></div></td>
                <td className="h-sub" data-label="소속">{u.team || '—'}</td><td data-label="역할">{roleOf(u)?.name || '—'}</td><td data-label="상태"><span className={`badge ${ST_L[u.status][1]}`}>{ST_L[u.status][0]}</span></td>
                <td className="num" data-label="담당 병원">{liveH().filter(h => h.ownerId === u.id).length}</td><td className="mono h-sub" data-label="최근 작업" style={{ whiteSpace: 'nowrap' }}>{lastAct(u.id)}</td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>{cU ? <button className="icon-btn" onClick={() => { if (need('users', 'update')) { ui.modal = { type: 'user', f: { ...clone(u), password: '' } }; notify(); } }} aria-label="수정">{I.edit}</button> : null}
                    {cD && u.id !== me.id ? <button className="icon-btn" onClick={() => delUser(u)} aria-label="삭제">{I.trash}</button> : null}</td></tr>)}</tbody></table></div>
        {!cU && !cD ? <div className="ro-note" style={{ marginTop: 12 }}>{I.lock}읽기 전용 · {roleOf(me)!.name} 역할은 사용자를 조회만 할 수 있습니다</div> : null}
    </>;
}

/** 사용자 추가·수정 창 */
export function UserModal({ f0 }: { f0: any }) {
    const [f, setF] = useState<any>(f0); const [err, setErr] = useState(''); const isSelf = f.id === cur()!.id;
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
    async function saveUser() {
        if (!need('users', f.id ? 'update' : 'create')) return; const name = f.name.trim(); const username = (f.username || '').trim().toLowerCase(); const pw = f.password || '';
        if (!name) { setErr('이름을 입력하세요.'); goTo('#uf-name'); return; }
        if (!USERNAME_RE.test(username)) { setErr('아이디는 영문 소문자로 시작하고 영문 소문자·숫자·. _ - 로 4~30자여야 합니다.'); goTo('#uf-username'); return; }
        if (S.users.some(u => u.username === username && u.id !== f.id)) { setErr('이미 사용 중인 아이디입니다.'); return; }
        if (!f.id && pw.length < 8) { setErr('초기 비밀번호를 8자 이상 입력하세요.'); goTo('#uf-pw'); return; }
        if (f.id && pw && pw.length < 8) { setErr('새 비밀번호는 8자 이상이어야 합니다.'); return; }
        if (phoneErr(f.phone, 'mobile')) { setErr(phoneErr(f.phone, 'mobile')); goTo('#uf-phone'); return; }
        if (f.status === 'active' && !f.roleId) { setErr('활성 사용자는 역할이 있어야 합니다.'); return; }
        const L: Record<string, string> = { name: '이름', username: '아이디', team: '소속', phone: '연락처', roleId: '역할', status: '상태', annualLeave: '연간 연차' };
        const disp = (k: string, v: any) => (k === 'roleId' ? (S.roles.find(r => r.id === v)?.name || '') : k === 'status' ? (({ active: '활성', inactive: '비활성', pending: '승인 대기' } as any)[v] || '') : (v == null ? '' : String(v)));
        const data: any = { ...f, name, username, annualLeave: f.annualLeave === '' || f.annualLeave == null ? 15 : +f.annualLeave }; delete data.password; let id = f.id;
        if (f.id) {
            const o = userById(f.id)!; const ch = Object.keys(L).filter(k => String((o as any)[k] ?? '') !== String(data[k] ?? '')).map(k => ({ field: L[k], before: disp(k, (o as any)[k]), after: disp(k, data[k]) }));
            if (o.roleId === 'r_admin' && data.roleId !== 'r_admin' && S.users.filter(u => u.roleId === 'r_admin' && u.status === 'active').length < 2) { setErr('마지막 관리자의 역할은 바꿀 수 없습니다.'); return; }
            if (ch.length) logEntry({ entity: 'user', entityId: o.id, targetName: data.name, action: 'update', section: '사용자', changes: ch }); Object.assign(o, { ...data, phone: fmtPhone(data.phone) });
        } else {
            const u = { ...data, id: 'u_' + uid(), slot: Math.max(0, ...S.users.map(x => x.slot || 0)) + 1, phone: fmtPhone(data.phone), joinedAt: today() }; id = u.id; S.users.push(u);
            logEntry({ entity: 'user', entityId: u.id, targetName: u.name, action: 'create', section: '사용자', changes: Object.keys(L).map(k => ({ field: L[k], before: '', after: disp(k, u[k]) })).filter(c => c.after) });
        }
        ui.modal = null; notify(); const ok = await saveNow(); if (!ok) return;
        if (pw) { try { await api('POST', `/api/users/${encodeURIComponent(id)}/password`, { password: pw }); toast(f.id ? '사용자 정보와 비밀번호를 저장했습니다' : `${name} 추가됨 · 아이디 ${username}`); } catch (e: any) { toast('비밀번호를 저장하지 못했습니다: ' + e.message); } }
        else toast('사용자 정보를 저장했습니다');
    }
    return <Modal title={f.id ? '사용자 정보 수정' : '사용자 추가'} foot={<><button className="btn" onClick={() => { ui.modal = null; notify(); }}>취소</button><button className="btn primary" data-act="saveUser" onClick={saveUser}>{f.id ? '저장' : '추가'}</button></>}>
        <div className="form-grid">
            <label className="fld"><span>이름 <em>*</em></span><input id="uf-name" value={f.name} onChange={set('name')} /></label>
            <label className="fld"><span>아이디 <em>*</em> <small>로그인용 · 영문 소문자</small></span><input id="uf-username" value={f.username || ''} onChange={set('username')} autoComplete="off" autoCapitalize="off" spellCheck={false} /></label>
            <label className="fld"><span>소속 <small>목록은 설정 › 소속에서 관리</small></span><select id="uf-team" value={f.team || ''} onChange={set('team')}><option value="">선택 안 함</option>{(S.codes.teams || []).map(t => <option key={t}>{t}</option>)}{f.team && !(S.codes.teams || []).includes(f.team) ? <option value={f.team}>{f.team} (목록에 없음)</option> : null}</select></label><label className="fld"><span>연락처</span><PhoneInput id="uf-phone" kind="mobile" value={f.phone || ''} onChange={v => setF({ ...f, phone: v })} /></label>
            <label className="fld"><span>역할 <em>*</em></span><select id="uf-role" value={f.roleId} onChange={set('roleId')} disabled={isSelf}><option value="">선택</option>{S.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label className="fld"><span>연간 연차 (일)</span><input type="number" min="0" max="40" step="0.5" id="uf-leave" value={f.annualLeave ?? 15} onChange={set('annualLeave')} /></label>
            <label className="fld"><span>{f.id ? <>새 비밀번호 <small>바꿀 때만 입력</small></> : <>초기 비밀번호 <em>*</em> <small>8자 이상</small></>}</span><PasswordInput id="uf-pw" value={f.password || ''} onChange={set('password')} autoComplete="new-password" /></label>
            <label className="fld"><span>상태</span><select id="uf-status" value={f.status} onChange={set('status')} disabled={isSelf}>{[['active', '활성'], ['inactive', '비활성'], ['pending', '승인 대기']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {isSelf ? <p className="hint span2">본인의 역할과 상태는 바꿀 수 없습니다.</p> : null}{err ? <p className="err span2">{err}</p> : null}</div>
    </Modal>;
}

function RolesPanel() {
    if (!S.roles.some(r => r.id === ui.roleSel)) ui.roleSel = S.roles[0].id;
    const role = S.roles.find(r => r.id === ui.roleSel)!; const [d, setD] = useState<Role>(() => clone(role));
    const ro = !!role.locked || !can('users', 'update'); const n = S.users.filter(u => u.roleId === role.id).length;
    function perm(k: string, op: string, on: boolean) {
        const p = { ...d.perms[k] }; const ops = FEATURES.find(f => f[0] === k)![2]; p[op] = on;
        if (on) { if (op !== 'view') p.view = true; if (['create', 'update', 'delete'].includes(op)) p.read = true; }
        else { if (op === 'view') ops.forEach(o => (p[o] = false)); if (op === 'read') (['create', 'update', 'delete'] as const).forEach(o => { if (ops.includes(o)) p[o] = false; }); }
        setD({ ...d, perms: { ...d.perms, [k]: p } });
    }
    function roleSave() {
        if (!need('users', 'update')) return; const o = role; if (o.locked) return; const name = d.name.trim(); if (!name) { toast('역할 이름을 입력하세요'); return; }
        const ch: any[] = []; if (o.name !== name) ch.push({ field: '이름', before: o.name, after: name }); if ((o.desc || '') !== (d.desc || '')) ch.push({ field: '설명', before: o.desc || '', after: d.desc || '' });
        const sl: Record<string, string> = { all: '전체 병원', own: '내 담당 병원만' }; if (o.scope !== d.scope) ch.push({ field: '수정 범위', before: sl[o.scope], after: sl[d.scope] });
        const pl: Record<string, string> = { all: '모든 직원', team: '같은 소속(팀)만' }; if ((o.people || 'team') !== (d.people || 'team')) ch.push({ field: '직원 자료 범위', before: pl[o.people || 'team'], after: pl[d.people || 'team'] });
        FEATURES.forEach(([k, l, ops]) => ops.forEach(op => { const a = !!o.perms[k]?.[op], b2 = !!d.perms[k]?.[op]; if (a !== b2) ch.push({ field: `${l} · ${OPS.find(x => x[0] === op)![1]}`, before: a ? '허용' : '불가', after: b2 ? '허용' : '불가' }); }));
        if (!ch.length) { toast('바뀐 내용이 없습니다'); return; }
        logEntry({ entity: 'role', entityId: o.id, targetName: name, action: 'update', section: '역할 권한', changes: ch }); Object.assign(o, clone({ ...d, name })); save(); toast(`${name} 권한 저장 · ${fmtN(ch.length)}개 항목 변경`);
    }
    async function delRole() {
        if (!need('users', 'delete')) return; if (S.users.some(u => u.roleId === role.id)) return;
        if (!await confirmBox({ title: `‘${role.name}’ 역할을 삭제할까요?`, body: <p>이 역할을 쓰는 사용자는 없습니다.</p>, ok: '삭제', danger: true })) return;
        logEntry({ entity: 'role', entityId: role.id, targetName: role.name, action: 'delete', section: '역할', changes: [{ field: '이름', before: role.name, after: '' }] }); S.roles = S.roles.filter(r => r !== role); ui.roleSel = S.roles[0].id; save();
    }
    return <div className="two-col"><div className="role-list">{S.roles.map(r => <button key={r.id} className={`role-btn ${r.id === role.id ? 'on' : ''}`} data-act="roleSel" data-v={r.id} onClick={() => { ui.roleSel = r.id; notify(); }}><b>{r.name}</b><span className="muted num" style={{ fontSize: 12 }}>{S.users.filter(u => u.roleId === r.id).length}명</span><small>{r.desc || ''}</small></button>)}</div>
        <section className="panel"><div className="form-grid" style={{ marginBottom: 14 }}>
            <label className="fld"><span>역할 이름</span><input id="rd-name" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} disabled={ro} /></label>
            <label className="fld"><span>수정 범위 <small>병원·평가·활동·전환에 적용</small></span><select id="rd-scope" value={d.scope} onChange={e => setD({ ...d, scope: e.target.value as any })} disabled={ro}><option value="all">전체 병원</option><option value="own">내 담당 병원만</option></select></label>
            <label className="fld"><span>직원 자료 범위 <small>영업 보고·팀 성과·근태·변경 이력·코칭 메모·방문 기록·알림</small></span>{role.locked ? <select id="rd-people" value="all" disabled><option value="all">모든 직원</option></select> : <select id="rd-people" value={d.people || 'team'} onChange={e => setD({ ...d, people: e.target.value as any })} disabled={ro}><option value="team">같은 소속(팀)만</option><option value="all">모든 직원</option></select>}</label>
            <label className="fld"><span>&nbsp;</span><small className="hint" style={{ marginTop: 8 }}>‘같은 소속(팀)만’이면 사용자 목록의 소속이 같은 직원 자료만 봅니다. 소속이 비어 있으면 본인 자료만 보입니다.</small></label>
            <label className="fld span2"><span>설명</span><input id="rd-desc" value={d.desc || ''} onChange={e => setD({ ...d, desc: e.target.value })} disabled={ro} /></label></div>
            {role.locked ? <div className="ro-note" style={{ marginBottom: 12 }}>{I.lock}관리자 역할은 잠겨 있습니다. 권한 관리를 잃지 않도록 항상 모든 권한을 가집니다.</div> : ro ? <RoNote f="users" /> : null}
            <div className="tbl-wrap"><table className="perm"><thead><tr><th>기능</th>{OPS.map(o => <th key={o[0]}>{o[1]}</th>)}</tr></thead><tbody>
                {FEATURES.map(([k, l, ops, desc]) => <tr key={k}><td><b>{fmtN(l)}</b><span className="fdesc">{desc}</span></td>{OPS.map(([o]) => <td key={o}>{ops.includes(o) ? <input type="checkbox" data-perm={k} data-op={o} checked={!!d.perms[k]?.[o]} onChange={e => perm(k, o, e.target.checked)} disabled={ro} aria-label={`${l} ${o}`} /> : <span className="muted">—</span>}</td>)}</tr>)}
            </tbody></table></div>
            <p className="hint" style={{ marginTop: 8 }}>표시를 끄면 메뉴·탭이 아예 보이지 않습니다. 표시만 켜고 읽기를 끄면 메뉴는 보이지만 내용은 잠깁니다. 입력·수정·삭제를 켜면 읽기와 표시가 함께 켜집니다.</p>
            {ro ? null : <div className="d-foot" style={{ marginTop: 12 }}>{can('users', 'delete') ? <button className="btn danger" onClick={delRole} disabled={n > 0} title={n ? '사용 중인 역할은 삭제할 수 없습니다' : undefined}>{I.trash}역할 삭제{n ? ` (사용자 ${fmtN(n)}명)` : ''}</button> : <span />}
                <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => setD(clone(role))}>되돌리기</button><button className="btn primary" data-act="roleSave" onClick={roleSave}>권한 저장</button></div></div>}
        </section></div>;
}
