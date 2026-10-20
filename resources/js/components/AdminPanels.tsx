// 관리자 전용: 백업(자동·내려받기), 접속·이용 기록
import { Fragment, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { I } from '../lib/icons';
import { confirmBox, notify, S, toast } from '../lib/store';
import { fmtTs, today, fmtN } from '../lib/utils';

type B = { name: string; size: number; at: string; kind: string };
const KIND: Record<string, string> = { auto: '자동', manual: '직접', prerestore: '되돌리기 전' };
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function BackupPanel() {
    const [d, setD] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const load = () => api('GET', '/api/admin/backups').then(setD).catch(e => setErr(e.message));
    useEffect(() => { load(); }, []);
    async function now() { setBusy(true); try { const r = await api<any>('POST', '/api/admin/backups'); toast(`백업했습니다 · ${r.name}`); await load(); } catch (e: any) { toast(e.message); } finally { setBusy(false); } }
    const ping = d?.scheduler ? new Date(d.scheduler) : null; const cronOk = ping && Date.now() - +ping < 3 * 3600e3;
    const last = d?.last;
    return <section className="panel span-all" id="set-backup"><h2>백업 <small>관리자만 보입니다 · 매일 자동 · {d?.keepDays || 30}일 보관</small></h2>
        {err ? <p className="err">{err}</p> : !d ? <p className="hint">불러오는 중…</p> : <div style={{ display: 'grid', gap: 12 }}>
            <div className="imp-sum">
                <div><b style={{ fontSize: 15 }}>{last ? fmtTs(last.at) : '아직 없음'}</b><small>마지막 백업{last ? ` · ${KIND[last.kind] || last.kind}` : ''}</small></div>
                <div><b style={{ fontSize: 15 }}>{last?.counts ? `병원 ${(last.counts.hospitals || 0).toLocaleString('ko-KR')}곳` : '—'}</b><small>{last?.counts ? `보고서 ${last.counts.reports || 0} · 사용자 ${last.counts.users || 0} · 이력 ${last.counts.audit_logs || 0}` : '백업에 든 내용'}</small></div>
                <div><b style={{ fontSize: 15 }}>{fmtN(cronOk ? '매일 03:00' : '하루 첫 접속 때')}</b><small>{cronOk ? `서버 예약 실행 동작 중 (${fmtTs(d.scheduler)})` : '서버 예약 실행(cron)이 확인되지 않아 첫 접속 때 자동 백업'}</small></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn primary" disabled={busy} onClick={now}>{I.upload}지금 백업</button><button className="btn ghost" onClick={load}>새로고침</button></div>
            {d.list.length ? <div className="tbl-wrap"><table><thead><tr><th>백업 시각</th><th>종류</th><th>크기</th><th>파일</th><th /></tr></thead><tbody>
                {(d.list as B[]).map(b => <tr key={b.name}><td className="mono">{b.at}</td><td><span className={`badge ${b.kind === 'auto' ? 'f-완료' : 'f-예정'}`}>{KIND[b.kind] || b.kind}</span></td><td className="num">{kb(b.size)}</td><td className="mono h-sub">{b.name}</td>
                    <td><a className="btn sm" href={`/api/admin/backups/${encodeURIComponent(b.name)}`} download>내려받기</a></td></tr>)}</tbody></table></div> : <p className="hint">아직 백업이 없습니다. ‘지금 백업’을 누르거나 내일 새벽까지 기다리세요.</p>}
            <p className="hint">백업에는 병원·영업 활동·보고서·근태·사용자(비밀번호는 암호화된 값)·역할·설정·변경 이력이 들어 있습니다(.json.gz). 파일을 안전한 곳에 보관하세요. 이 백업으로 되돌릴 때는 서버에서 <span className="mono">php8.3 artisan crm:restore 파일이름</span> 을 실행합니다 (되돌리기 전 지금 상태를 먼저 백업합니다).</p>
        </div>}</section>;
}

type L = { id: number; at: string; userId?: string; username?: string; name?: string; event: string; detail?: string; ip?: string; ua?: string };
const EV_CLS: Record<string, string> = { login: 'f-완료', login_fail: 'a-delete', logout: 'f-없음', backup_download: 'f-오늘', password_reset: 'f-오늘', import: 'f-예정' };
const device = (ua = '') => (/iphone|android|mobile/i.test(ua) ? '휴대폰' : /ipad|tablet/i.test(ua) ? '태블릿' : ua ? 'PC' : '');
const browser = (ua = '') => (/edg\//i.test(ua) ? 'Edge' : /whale/i.test(ua) ? 'Whale' : /samsungbrowser/i.test(ua) ? '삼성 인터넷' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : /firefox/i.test(ua) ? 'Firefox' : '');

export function AccessLogPanel() {
    const [f, setF] = useState({ user: '', event: '', from: '', to: today(), q: '' }); const [page, setPage] = useState(1); const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
    useEffect(() => {
        const qs = new URLSearchParams({ ...f, page: String(page) } as any).toString();
        api('GET', '/api/admin/logs?' + qs).then(x => { setD(x); setErr(''); }).catch(e => setErr(e.message));
    }, [f, page]);
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setPage(1); setF({ ...f, [k]: e.target.value }); };
    const pages = d ? Math.max(1, Math.ceil(d.total / 100)) : 1;
    return <section className="panel" style={{ display: 'grid', gap: 12 }}><h2>접속·이용 기록 <small>관리자만 보입니다 · 1년 보관</small></h2>
        {d ? <div className="imp-sum"><div><b>{fmtN(d.today.logins)}</b><small>오늘 로그인</small></div><div><b style={{ color: d.today.fails ? 'var(--danger)' : undefined }}>{fmtN(d.today.fails)}</b><small>오늘 로그인 실패</small></div><div><b>{fmtN(d.today.users)}</b><small>오늘 이용한 사람</small></div></div> : null}
        <div className="toolbar" style={{ margin: 0 }}>
            <select value={f.user} onChange={set('user')} aria-label="사용자"><option value="">사용자 전체</option>{S.users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}</select>
            <select value={f.event} onChange={set('event')} aria-label="종류"><option value="">종류 전체</option>{Object.entries(d?.events || {}).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}</select>
            <input type="date" value={f.from} onChange={set('from')} aria-label="시작일" /><input type="date" value={f.to} onChange={set('to')} aria-label="종료일" />
            <label className="search">{I.search}<input type="search" placeholder="IP·아이디·내용 검색" value={f.q} onChange={set('q')} /></label></div>
        {err ? <p className="err">{err}</p> : !d ? <p className="hint">불러오는 중…</p> : d.rows.length ? <>
            <div className="tbl-wrap"><table><thead><tr><th>시각</th><th>사용자</th><th>종류</th><th>내용</th><th>IP</th><th>기기</th></tr></thead><tbody>
                {(d.rows as L[]).map(x => <tr key={x.id}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTs(x.at)}</td><td style={{ whiteSpace: 'nowrap' }}>{x.name || <span className="muted">{x.username || '—'}</span>}{x.name && x.username ? <small className="h-sub"> {x.username}</small> : null}</td>
                    <td><span className={`badge ${EV_CLS[x.event] || 'f-없음'}`}>{d.events[x.event] || x.event}</span></td><td className="h-sub">{x.detail || ''}</td><td className="mono h-sub">{x.ip || ''}</td><td className="h-sub" title={x.ua || ''}>{[device(x.ua), browser(x.ua)].filter(Boolean).join(' · ')}</td></tr>)}</tbody></table></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button><span className="hint num">{page} / {pages} · 전체 {d.total.toLocaleString('ko-KR')}건</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>다음</button></div>
        </> : <p className="hint">조건에 맞는 기록이 없습니다.</p>}
    </section>;
}

/** 오류 기록: 서버 오류 + 화면 오류 (같은 오류는 한 줄 · 횟수) */
export function ErrorLogPanel() {
    const [src, setSrc] = useState(''); const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [open, setOpen] = useState<number | null>(null); const [tick, setTick] = useState(0);
    useEffect(() => { api('GET', '/api/admin/errors?source=' + src).then(x => { setD(x); setErr(''); }).catch(e => setErr(e.message)); }, [src, tick]);
    async function clear(ids?: number[]) {
        if (!ids && !(await confirmBox({ title: '오류 기록을 모두 지울까요?', body: '확인한 오류만 지우세요. 지운 기록은 되돌릴 수 없습니다.', ok: '모두 지우기', danger: true }))) return;
        try { const r = await api('POST', '/api/admin/errors/clear', { ids: ids || [] }); toast(`${fmtN(r.deleted)}건 지웠습니다`); if (S) (S as any).errorCount = Math.max(0, ((S as any).errorCount || 0) - r.deleted); setTick(tick + 1); notify(); } catch (e: any) { toast(e.message); }
    }
    const rows: any[] = d?.rows || [];
    return <section className="panel" id="errPanel" style={{ display: 'grid', gap: 12 }}><h2>오류 기록 <small>관리자만 보입니다 · 서버 오류와 사용자 화면에서 난 오류를 자동으로 모읍니다 · 90일 보관</small></h2>
        {d ? <div className="imp-sum"><div><b style={{ color: d.recent ? 'var(--danger)' : undefined }}>{fmtN(d.recent)}</b><small>최근 24시간 (종류)</small></div><div><b>{fmtN(rows.length)}</b><small>전체 종류</small></div><div><b>{fmtN(rows.reduce((s, r) => s + r.count, 0))}</b><small>전체 발생 횟수</small></div></div> : null}
        <div className="toolbar" style={{ margin: 0 }}><div className="seg" style={{ width: 'auto' }}>{[['', '전체'], ['server', '서버'], ['client', '화면']].map(([k, l]) => <button key={k} type="button" className={src === k ? 'on' : ''} onClick={() => setSrc(k)}>{l}</button>)}</div>
            <button className="btn sm" onClick={() => setTick(tick + 1)}>새로 고침</button>{rows.length ? <button className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => clear()}>모두 지우기</button> : null}</div>
        {err ? <div className="notice warn">{err}</div> : !d ? <div className="empty">불러오는 중…</div> : !rows.length ? <div className="empty">기록된 오류가 없습니다 👍</div> :
            <div className="tbl-wrap"><table className="err-tbl"><thead><tr><th>마지막 발생</th><th>구분</th><th>내용</th><th>횟수</th><th></th></tr></thead><tbody>
                {rows.map(r => <Fragment key={r.id}><tr className="row" onClick={() => setOpen(open === r.id ? null : r.id)}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTs(r.lastAt)}</td><td><span className={`badge ${r.source === 'server' ? 'a-delete' : 'f-오늘'}`}>{r.source === 'server' ? '서버' : '화면'}</span></td>
                    <td className="err-msg"><b>{r.message}</b><small className="h-sub">{r.url}{r.userName ? ` · ${r.userName}` : ''}</small></td><td className="num"><b>{fmtN(r.count)}</b></td>
                    <td><button className="btn sm" onClick={e => { e.stopPropagation(); clear([r.id]); }}>확인함</button></td></tr>
                    {open === r.id ? <tr><td colSpan={5}><pre className="err-detail">처음 발생 {fmtTs(r.firstAt)}{'\n'}{r.detail}</pre></td></tr> : null}</Fragment>)}
            </tbody></table></div>}
        <p className="hint">줄을 누르면 자세한 위치가 보입니다. 매일 아침 서버 점검이 자동으로 돌고, 새 오류가 있으면 GitHub 이 메일로 알려 줍니다.</p></section>;
}

/** 알림 기본값(역할별)·고정 + 사람별 알림 상태 */
export function NotifAdminPanel() {
    const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [rid, setRid] = useState(''); const [ed, setEd] = useState<{ roles: Record<string, any>; locked: Record<string, string[]> } | null>(null); const [busy, setBusy] = useState(false);
    const load = (x: any) => { setD(x); setEd({ roles: Object.fromEntries(Object.entries(x.roles).map(([k, v]: any) => [k, JSON.parse(JSON.stringify(v.base))])), locked: Object.fromEntries(Object.entries(x.roles).map(([k, v]: any) => [k, [...v.locked]])) }); setRid(r => r || Object.keys(x.roles)[0] || ''); };
    useEffect(() => { api('GET', '/api/admin/notif').then(x => { load(x); setErr(''); }).catch(e => setErr(e.message)); }, []);
    if (err) return <section className="panel"><div className="notice warn">{err}</div></section>;
    if (!d || !ed || !S.notif) return <section className="panel"><div className="empty">불러오는 중…</div></section>;
    const T = S.notif.types; const R = ed.roles[rid]; const L = new Set(ed.locked[rid] || []); const roleName = (id: string) => S.roles.find(r => r.id === id)?.name || id;
    const setR = (p: any) => setEd({ ...ed, roles: { ...ed.roles, [rid]: { ...R, ...p } } });
    const setT = (k: string, v: boolean) => setR({ types: { ...R.types, [k]: v } });
    const setL = (k: string, v: boolean) => setEd({ ...ed, locked: { ...ed.locked, [rid]: v ? [...L, k] : [...L].filter(x => x !== k) } });
    async function saveD() { setBusy(true); try { const x = await api('POST', '/api/admin/notif', ed); load(x); toast('알림 기본값을 저장했습니다'); } catch (e: any) { toast(e.message); } finally { setBusy(false); } }
    const label = (k: string) => T.find(t => t.key === k)?.label || k;
    const diff = (u: any) => {
        const m = u.mine || {}; const base = d.roles[u.roleId]?.base; const out: string[] = [];
        if (!base) return out;
        Object.entries(m.types || {}).forEach(([k, v]) => { if (v === false && base.types[k]) out.push(`${label(k)} 끔`); else if (v === true && !base.types[k]) out.push(`${label(k)} 켬`); });
        if (m.morning !== undefined && m.morning !== base.morning) out.push(`아침 ${m.morning || '안 받음'}`);
        if (m.evening !== undefined && m.evening !== base.evening) out.push(`저녁 ${m.evening || '안 받음'}`);
        if (m.quietOn !== undefined && m.quietOn !== base.quietOn) out.push(m.quietOn ? '조용한 시간 켬' : '조용한 시간 없음');
        if ((m.quietFrom && m.quietFrom !== base.quietFrom) || (m.quietTo && m.quietTo !== base.quietTo)) out.push(`조용한 시간 ${m.quietFrom || base.quietFrom}~${m.quietTo || base.quietTo}`);
        if (m.weekend !== undefined && m.weekend !== base.weekend) out.push(m.weekend ? '주말 받음' : '주말 안 받음');
        return out;
    };
    const users = [...d.users].sort((a: any, b: any) => (+!!b.mine?.off - +!!a.mine?.off) || diff(b).length - diff(a).length);
    return <div style={{ display: 'grid', gap: 16 }}>
        <section className="panel" id="notifDefaults"><h2>알림 기본값 <small>역할마다 처음 받을 알림을 정합니다 · 🔒고정하면 직원이 끌 수 없습니다</small></h2>
            <div className="seg" style={{ width: 'auto', marginBottom: 12 }}>{Object.keys(d.roles).map(k => <button key={k} type="button" className={rid === k ? 'on' : ''} onClick={() => setRid(k)}>{roleName(k)}</button>)}</div>
            <div className="tbl-wrap"><table className="nd-tbl"><thead><tr><th>알림</th><th>기본으로 받기</th><th>🔒 끌 수 없게 고정</th></tr></thead><tbody>
                {(['mine', 'team', 'brief'] as const).map(g => <Fragment key={g}><tr className="avg-row"><td colSpan={3}>{({ mine: '내 일', team: '팀 소식 (관리자·팀장이 받음)', brief: '하루 요약' } as any)[g]}</td></tr>
                    {T.filter(t => t.group === g).map(t => <tr key={t.key}><td><b>{t.label}</b><small className="h-sub" style={{ display: 'block' }}>{t.desc}</small>
                        {t.key === 'morning' || t.key === 'evening' ? <input type="time" id={`nd-${t.key}-at`} value={R[t.key]} onChange={e => setR({ [t.key]: e.target.value })} style={{ marginTop: 4, width: 130 }} /> : null}</td>
                        <td><input type="checkbox" id={`nd-${t.key}`} checked={L.has(t.key) || !!R.types[t.key]} disabled={L.has(t.key)} onChange={e => setT(t.key, e.target.checked)} /></td>
                        <td><input type="checkbox" id={`nl-${t.key}`} checked={L.has(t.key)} onChange={e => setL(t.key, e.target.checked)} /></td></tr>)}</Fragment>)}
            </tbody></table></div>
            <div className="np-quiet" style={{ marginTop: 12 }}><label><input type="checkbox" id="nd-quiet" checked={R.quietOn} onChange={e => setR({ quietOn: e.target.checked })} /><b>조용한 시간</b></label>
                <input type="time" id="nd-qfrom" value={R.quietFrom} disabled={!R.quietOn} onChange={e => setR({ quietFrom: e.target.value })} /><span>~</span><input type="time" id="nd-qto" value={R.quietTo} disabled={!R.quietOn} onChange={e => setR({ quietTo: e.target.value })} />
                <label style={{ marginLeft: 16 }}><input type="checkbox" id="nd-weekend" checked={R.weekend} onChange={e => setR({ weekend: e.target.checked })} /><b>주말·공휴일에도 받기</b></label></div>
            <p className="hint">직원은 고정되지 않은 알림을 끄거나 시간을 바꿀 수 있습니다. 직원이 자기 알림을 꺼도, 그 직원이 한 일(보고서 제출·단계 상승·지원 요청 등)은 관리자·팀장에게 계속 알림이 갑니다.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn primary" data-act="ndSave" disabled={busy} onClick={saveD}>기본값 저장</button></div></section>
        <section className="panel" id="notifPeople"><h2>사람별 알림 상태 <small>누가 어떤 알림을 껐는지 · 알림 받는 기기 · 최근 7일 보냄 {fmtN(d.week?.sent || 0)}건{d.week?.nodevice ? ` · 기기 없어 못 보냄 ${fmtN(d.week.nodevice)}건` : ''}</small></h2>
            <div className="tbl-wrap"><table><thead><tr><th>이름</th><th>역할</th><th>알림 기기</th><th>바꾼 설정</th><th>마지막 변경</th></tr></thead><tbody>
                {users.map((u: any) => { const df = diff(u); return <tr key={u.id}><td><b>{u.name}</b></td><td>{roleName(u.roleId)}</td>
                    <td>{u.devices ? <span className="badge f-완료">{fmtN(u.devices)}대</span> : <span className="badge a-delete">없음</span>}{u.lastOk ? <small className="h-sub" style={{ display: 'block' }}>마지막 수신 {fmtTs(u.lastOk)}</small> : null}</td>
                    <td>{u.mine?.off ? <span className="badge a-delete" style={{ marginRight: 4 }}>모두 끔</span> : null}{df.length ? df.join(' · ') : u.mine?.off ? '' : <span className="muted">기본값 그대로</span>}</td>
                    <td className="mono">{u.mine?.at ? fmtTs(u.mine.at) : '—'}</td></tr>; })}
            </tbody></table></div>
            <p className="hint">알림 기기가 "없음"이면 그 사람은 휴대폰·PC에서 아직 "이 기기에서 알림 받기"를 누르지 않은 것입니다. 바꾼 내용은 변경 이력에도 남습니다.</p></section>
    </div>;
}
