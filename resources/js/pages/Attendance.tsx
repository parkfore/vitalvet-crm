// 근태 일정: 달력, 승인 대기, 연차 현황, 월별 목록, 회사 휴일 + 신청·등록 창, 상세 창
import { useState } from 'react';
import { Av, DateInput, Modal, css } from '../components/ui';
import { ATT, ATT_ST } from '../lib/constants';
import {
    attDays, attManager, attPeriod, canAtt, cur, holMap, holName, isBiz, leaveTotal, leaveUsed, logAtt, logEntry, roleOf, snapAtt, userById, userName,
} from '../lib/domain';
import { I } from '../lib/icons';
import { confirmBox, notify, S, save, toast, ui } from '../lib/store';
import type { Attendance as Att } from '../lib/types';
import { fd, fmtD, fmtTs, today, uid } from '../lib/utils';

const tip = (lines: string[]) => ({ 'data-tip': lines.join('\n') });

function attDecide(id: string, ok: boolean) {
    const a = S.attendance.find(x => x.id === id); if (!a || !attManager()) { toast('승인 권한이 없습니다'); return; }
    const go = (c: string) => { const b = snapAtt(a); a.status = ok ? 'approved' : 'rejected'; a.approverId = cur()!.id; a.approvedAt = new Date().toISOString(); a.comment = c || ''; logAtt(a, 'update', ok ? '근태 승인' : '근태 반려', b); save(); toast(ok ? '승인했습니다' : '반려했습니다'); };
    if (ok) go(''); else confirmBox({ title: '일정을 반려할까요?', body: <p>{userName(a.userId)} · {a.type} · {attPeriod(a)}</p>, ok: '반려', danger: true, input: '반려 사유' }).then(r => { if (r) go(r.v); });
}
function attCancel(id: string) {
    const a = S.attendance.find(x => x.id === id); if (!a) return; const own = a.userId === cur()!.id && a.status === 'requested';
    if (!(own || attManager()) || !canAtt('delete', a)) { toast('취소 권한이 없습니다'); return; }
    confirmBox({ title: own ? '신청을 취소할까요?' : '승인된 일정을 취소할까요?', body: <p>{userName(a.userId)} · {a.type} · {attPeriod(a)}. 취소 내역은 변경 이력에 남습니다.</p>, ok: '취소하기', danger: true })
        .then(ok => { if (!ok) return; const b = snapAtt(a); a.status = 'canceled'; logAtt(a, 'delete', '근태 취소', b); save(); toast('취소했습니다'); });
}
const closeM = () => { ui.modal = null; notify(); };

export function AttActions({ a, inModal }: { a: Att; inModal?: boolean }) {
    const me = cur()!; const out: React.ReactNode[] = [];
    const wrap = (fn: () => void) => () => { if (inModal) closeM(); fn(); };
    if (a.status === 'requested' && attManager() && (a.userId !== me.id || roleOf(me)!.id === 'r_admin'))
        out.push(<button key="ap" className="btn sm primary" data-act="attApprove" data-id={a.id} onClick={wrap(() => attDecide(a.id, true))}>승인</button>, <button key="rj" className="btn sm" onClick={wrap(() => attDecide(a.id, false))}>반려</button>);
    if (a.userId === me.id && a.status === 'requested' && canAtt('delete', a)) out.push(<button key="c" className="btn sm" onClick={wrap(() => attCancel(a.id))}>신청 취소</button>);
    if (attManager() && canAtt('delete', a) && a.status === 'approved') out.push(<button key="d" className="icon-btn" onClick={wrap(() => attCancel(a.id))} aria-label="일정 취소">{I.trash}</button>);
    return out.length ? <>{out}</> : null;
}

function Holidays() {
    const y = ui.att.month.slice(0, 4); const hs = Object.entries(holMap()).filter(([d]) => d.startsWith(y)).sort(); const [d, setD] = useState(''); const [n, setN] = useState('');
    function add() {
        if (!attManager()) return; const name = n.trim(); if (!d || !name) { toast('날짜와 이름을 입력하세요'); return; }
        S.holidays = { ...holMap(), [d]: name }; logEntry({ entity: 'settings', entityId: 'holiday', targetName: '회사 휴일', action: 'create', section: '회사 휴일', changes: [{ field: fd(d), before: '', after: name }] });
        save(); toast(`${fd(d)} ${name} 추가`); setD(''); setN('');
    }
    async function del(day: string) {
        if (!attManager()) return; const name = holName(day);
        if (!await confirmBox({ title: '휴일을 삭제할까요?', body: <p>{fd(day)} {name}이 근무일로 바뀝니다.</p>, ok: '삭제', danger: true })) return;
        const h = { ...holMap() }; delete h[day]; S.holidays = h; logEntry({ entity: 'settings', entityId: 'holiday', targetName: '회사 휴일', action: 'delete', section: '회사 휴일', changes: [{ field: fd(day), before: name, after: '' }] }); save();
    }
    return <section className="panel" style={{ marginTop: 16 }}><h2>회사 휴일 <small>{y}년 · 주말과 함께 근무일에서 빠집니다</small></h2>
        <ul className="code-list">{hs.length ? hs.map(([day, nm]) => <li key={day}><span className="mono" style={{ flex: 'none', width: 150 }}>{fd(day)}</span><span>{nm}</span><button className="icon-btn" onClick={() => del(day)} aria-label="삭제">{I.trash}</button></li>) : <li className="hint">등록된 휴일이 없습니다</li>}</ul>
        <div className="inline-add"><DateInput id="hol-date" aria-label="날짜" value={d} onChange={setD} /><input id="hol-name" placeholder="휴일 이름 (예: 창립기념일)" value={n} onChange={e => setN(e.target.value)} /><button className="btn" data-act="holAdd" onClick={add}>추가</button></div></section>;
}

export function Attendance() {
    const A = ui.att; const me = cur()!; const mgr = attManager(); const ym = A.month; const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7)); const cells: string[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(fmtD(d)); }
    const weeks = cells.slice(35).every(d => d.slice(0, 7) !== ym) ? cells.slice(0, 35) : cells;
    const visible = (a: Att) => mgr || a.userId === me.id || (canAtt('read') && roleOf(me)!.scope === 'all');
    const list = (S.attendance || []).filter(a => visible(a) && (!A.user || a.userId === A.user) && a.status !== 'canceled');
    const onDay = (d: string) => list.filter(a => a.from <= d && a.to >= d && a.status !== 'rejected' && isBiz(d));
    const users = S.users.filter(u => u.status === 'active' && (mgr || roleOf(me)!.scope === 'all' || u.id === me.id));
    const pend = (S.attendance || []).filter(a => a.status === 'requested' && (mgr ? a.userId !== me.id || roleOf(me)!.id === 'r_admin' : false));
    const monthList = list.filter(a => a.from.slice(0, 7) <= ym && a.to.slice(0, 7) >= ym).sort((a, b) => a.from.localeCompare(b.from));
    const year = String(y);
    const month = (v: number) => { if (!v) A.month = today().slice(0, 7); else { const d = new Date(y, m - 1 + v, 1); A.month = fmtD(d).slice(0, 7); } notify(); };
    const attNew = (self: boolean) => {
        if (!canAtt('create')) { toast('근태 일정 권한이 없습니다'); return; } const d = today();
        ui.modal = { type: 'att', self, f: { userId: self ? me.id : (A.user || S.users.find(u => u.status === 'active' && u.id !== me.id)?.id), type: '연차', from: d, to: d, reason: '' } }; notify();
    };
    const open = (id: string) => { ui.modal = { type: 'attView', id }; notify(); };
    return <>
        <div className="page-head"><div><h1>근태 일정</h1><p>연차·반차·병가·교육·출장 일정을 등록하면 영업 보고의 제출 현황과 방문 목표에 자동으로 반영됩니다.</p></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{canAtt('create') ? <button className={`btn ${mgr ? '' : 'primary'}`} data-act="attNew" data-v="me" onClick={() => attNew(true)}>{I.plus}내 일정 {mgr ? '등록' : '신청'}</button> : null}
                {mgr ? <button className="btn primary" onClick={() => attNew(false)}>{I.plus}직원 일정 등록</button> : null}</div></div>
        {pend.length ? <section className="pending-box"><b>승인 대기 {pend.length}건</b>{pend.map(a => <div key={a.id} className="pending-row"><div className="u-cell"><Av u={userById(a.userId)} /><div><b>{userName(a.userId)} · {a.type}</b><small>{attPeriod(a)} · {attDays(a)}일{a.reason ? ' · ' + a.reason : ''}</small></div></div>
            <button className="btn sm primary" data-act="attApprove" data-id={a.id} onClick={() => attDecide(a.id, true)}>승인</button><button className="btn sm danger" onClick={() => attDecide(a.id, false)}>반려</button></div>)}</section> : null}
        <div className="att-grid">
            <section className="panel"><div className="cal-head"><button className="icon-btn" onClick={() => month(-1)} aria-label="이전 달">‹</button><h2 style={{ margin: 0 }}>{y}년 {m}월</h2><button className="icon-btn" onClick={() => month(1)} aria-label="다음 달">›</button>
                <button className="btn sm" onClick={() => month(0)}>이번 달</button>{users.length > 1 ? <select value={A.user} onChange={e => { A.user = e.target.value; notify(); }} aria-label="직원"><option value="">전체 직원</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select> : null}</div>
                <div className="cal"><div className="cal-dow">{['월', '화', '수', '목', '금', '토', '일'].map((w, i) => <span key={w} className={i > 4 ? 'we' : ''}>{w}</span>)}</div>
                    <div className="cal-body">{weeks.map(d => {
                        const wd = new Date(d + 'T00:00:00').getDay(); const hol = holName(d); const items = onDay(d);
                        return <div key={d} className={`cal-cell ${d.slice(0, 7) !== ym ? 'out' : ''} ${wd === 0 || wd === 6 || hol ? 'we' : ''} ${d === today() ? 'today' : ''}`} {...tip([fd(d) + (hol ? ' · ' + hol : ''), ...items.map(a => `${userName(a.userId)} ${a.type}${a.status === 'requested' ? ' (승인 대기)' : ''}`)])}>
                            <div className="cal-d"><b>{+d.slice(8)}</b>{hol ? <small>{hol}</small> : null}</div>
                            {items.slice(0, 3).map(a => <button key={a.id} className={`att-chip ${a.status === 'requested' ? 'pending' : ''}`} style={css({ '--ac': ATT[a.type]?.color || 'var(--v1)' })} onClick={() => open(a.id)}>
                                <span className="cn-f">{userName(a.userId)} {ATT[a.type]?.short || a.type}</span><span className="cn-s">{userName(a.userId).slice(0, 1)}·{(ATT[a.type]?.short || a.type).slice(0, 1)}</span></button>)}
                            {items.length > 3 ? <span className="more">+{items.length - 3}</span> : null}</div>;
                    })}</div></div>
                <div className="legend" style={{ marginTop: 10 }}>{Object.entries(ATT).map(([k, v]) => <span key={k}><i style={{ background: v.color }} />{k}</span>)}<span><i className="dash-i" />승인 대기</span></div></section>
            <section className="panel"><h2>연차 현황 <small>{year}년 · 승인 기준</small></h2><ul className="leave-list">{users.map(u => {
                const used = leaveUsed(u.id, year), tot = leaveTotal(u); const req = (S.attendance || []).filter(a => a.userId === u.id && a.status === 'requested' && (a.type === '연차' || ATT[a.type]?.half)).reduce((s, a) => s + attDays(a), 0);
                return <li key={u.id}><div className="u-cell"><Av u={u} cls="sm" /><b>{u.name}</b></div><div className="lv-bar"><i style={{ width: `${Math.min(100, used / tot * 100)}%` }} />{req ? <em style={{ left: `${Math.min(100, used / tot * 100)}%`, width: `${Math.min(100 - used / tot * 100, req / tot * 100)}%` }} /> : null}</div>
                    <span className="num"><b>{tot - used}</b>일 남음<small> · 사용 {used}{req ? ` · 대기 ${req}` : ''}</small></span></li>;
            })}</ul><p className="hint">연차·반차만 차감합니다. 연간 연차 일수는 사용자·권한에서 바꿀 수 있습니다.</p></section></div>
        <section className="panel" style={{ marginTop: 16 }}><h2>{y}년 {m}월 일정 <small>{monthList.length}건</small></h2>{monthList.length ? <div className="tbl-wrap"><table className="stack"><thead><tr><th>직원</th><th>유형</th><th>기간</th><th>일수</th><th>상태</th><th>사유</th><th>처리</th><th /></tr></thead><tbody>
            {monthList.map(a => <tr key={a.id}><td><div className="u-cell"><Av u={userById(a.userId) || { name: '?' }} cls="sm" /><b>{userName(a.userId)}</b></div></td><td data-label="유형"><span className="att-dot" style={css({ '--ac': ATT[a.type]?.color })} />{a.type}</td>
                <td data-label="기간" style={{ whiteSpace: 'nowrap' }}>{attPeriod(a)}</td><td className="num" data-label="일수">{attDays(a)}일</td><td data-label="상태"><span className={`badge ${ATT_ST[a.status][1]}`}>{ATT_ST[a.status][0]}</span></td>
                <td className="h-sub" data-label="사유">{a.reason || '—'}</td><td className="h-sub" data-label="처리">{a.approverId ? `${userName(a.approverId)} · ${fd(a.approvedAt?.slice(0, 10))}` : '—'}</td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}><AttActions a={a} /></td></tr>)}</tbody></table></div> : <div className="empty">이 달에 등록된 일정이 없습니다</div>}</section>
        {mgr ? <Holidays /> : null}
    </>;
}

export function AttFormModal({ self, f0 }: { self: boolean; f0: any }) {
    const [f, setF] = useState<any>(f0); const [err, setErr] = useState(''); const [overOk, setOverOk] = useState(false); const mgr = attManager();
    const half = ATT[f.type]?.half; const days = f.from && f.to && f.to >= f.from ? attDays(f) : 0; const u = userById(f.userId);
    function attSave() {
        const me = cur()!; const g = { ...f }; if (ATT[g.type]?.half) g.to = g.from;
        if (!g.from || !g.to || g.to < g.from) { setErr('기간을 올바르게 선택하세요.'); return; }
        if (!attDays(g)) { setErr('선택한 기간에 근무일이 없습니다.'); return; }
        const clash = (S.attendance || []).find(a => a.userId === g.userId && ['requested', 'approved'].includes(a.status) && a.from <= g.to && a.to >= g.from);
        if (clash) { setErr(`이미 ${attPeriod(clash)}에 ${clash.type} 일정(${ATT_ST[clash.status][0]})이 있습니다.`); return; }
        if (g.userId !== me.id && !mgr) { toast('다른 직원의 일정은 등록할 수 없습니다'); return; } if (!canAtt('create')) { toast('근태 일정 등록 권한이 없습니다'); return; }
        if ((g.type === '연차' || ATT[g.type]?.half) && leaveUsed(g.userId, g.from.slice(0, 4)) + attDays(g) > leaveTotal(userById(g.userId)) && !overOk) { setErr('남은 연차보다 많습니다. 그래도 진행하려면 한 번 더 누르세요.'); setOverOk(true); return; }
        const now = new Date().toISOString();
        const a: Att = { id: 'at_' + uid(), userId: g.userId, type: g.type, from: g.from, to: g.to, reason: g.reason.trim(), status: mgr ? 'approved' : 'requested', requestedBy: me.id, requestedAt: now, ...(mgr ? { approverId: me.id, approvedAt: now } : {}) };
        (S.attendance ||= []).push(a); logAtt(a, 'create', mgr ? '근태 등록' : '근태 신청'); ui.modal = null; save(); toast(mgr ? `${userName(a.userId)} ${a.type} 등록` : `${a.type} 신청 완료 · 승인 대기`);
    }
    const setFrom = (v: string) => setF({ ...f, from: v, to: ATT[f.type]?.half || f.to < v ? v : f.to });
    return <Modal title={self ? (mgr ? '내 일정 등록' : '근태 일정 신청') : '직원 일정 등록'} foot={<><button className="btn" onClick={closeM}>취소</button><button className="btn primary" data-act="attSave" onClick={attSave}>{mgr ? '등록' : '신청'}</button></>}>
        <div className="form-grid">
            <label className="fld span2"><span>직원</span>{mgr && !self ? <select value={f.userId} onChange={e => setF({ ...f, userId: e.target.value })}>{S.users.filter(x => x.status === 'active').map(x => <option key={x.id} value={x.id}>{x.name} ({roleOf(x)?.name || ''})</option>)}</select> : <input value={userName(f.userId)} disabled />}</label>
            <div className="fld span2"><span>유형</span><div className="chips">{Object.keys(ATT).map(t => <button key={t} type="button" className={`chip-toggle ${f.type === t ? 'on' : ''}`} style={css({ '--cc': ATT[t].color })} onClick={() => { setF({ ...f, type: t, to: ATT[t]?.half ? f.from : f.to }); setOverOk(false); }}><i />{t}</button>)}</div></div>
            <label className="fld"><span>{half ? '날짜' : '시작일'}</span><DateInput data-af="from" value={f.from} onChange={setFrom} /></label>
            {half ? <div /> : <label className="fld"><span>종료일</span><DateInput data-af="to" value={f.to} min={f.from} onChange={v => setF({ ...f, to: v })} /></label>}
            <p className="hint span2" id="att-days">{days ? <>근무일 기준 <b>{days}일</b>{f.type === '연차' || half ? ` · ${u?.name || ''} 연차 ${leaveTotal(u) - leaveUsed(f.userId, f.from.slice(0, 4))}일 남음` : ''}</> : '기간을 선택하세요'} · 주말과 회사 휴일은 빠집니다</p>
            <label className="fld span2"><span>사유</span><input value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="예: 가족 행사, 제품 교육 (본사)" /></label>
            <p className="hint span2">{mgr ? '관리자가 등록하면 바로 승인 상태가 됩니다.' : '신청하면 팀장이 승인한 뒤 확정됩니다.'} {ATT[f.type]?.off ? '이 날은 일일 보고서를 쓰지 않아도 됩니다.' : half ? '이 날은 방문 목표가 절반으로 줄어듭니다.' : f.type === '교육' ? '이 날은 방문 목표가 0곳입니다.' : ''}</p>
            {err ? <p className="err span2">{err}</p> : null}</div>
    </Modal>;
}

export function AttViewModal({ id }: { id: string }) {
    const a = S.attendance.find(x => x.id === id); if (!a) return null;
    const me = cur()!;
    const has = (a.status === 'requested' && attManager() && (a.userId !== me.id || roleOf(me)!.id === 'r_admin')) || (a.userId === me.id && a.status === 'requested' && canAtt('delete', a)) || (attManager() && canAtt('delete', a) && a.status === 'approved');
    return <Modal title="근태 일정" size="sm" foot={has ? <AttActions a={a} inModal /> : <button className="btn" onClick={closeM}>닫기</button>}>
        <div className="rv-head"><Av u={userById(a.userId) || { name: '?' }} /><div><b>{userName(a.userId)}</b><div className="au-meta"><span className="att-dot" style={css({ '--ac': ATT[a.type]?.color })} /><span>{a.type}</span><span>{attPeriod(a)}</span><span>{attDays(a)}일</span><span className={`badge ${ATT_ST[a.status][1]}`}>{ATT_ST[a.status][0]}</span></div></div></div>
        <dl className="mc-grid"><dt>사유</dt><dd>{a.reason || '—'}</dd><dt>신청</dt><dd>{userName(a.requestedBy)} · {fmtTs(a.requestedAt)}</dd><dt>처리</dt><dd>{a.approverId ? `${userName(a.approverId)} · ${fmtTs(a.approvedAt!)}` : '—'}</dd>{a.comment ? <><dt>의견</dt><dd>{a.comment}</dd></> : null}</dl>
    </Modal>;
}
