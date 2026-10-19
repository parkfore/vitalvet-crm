// 목표 대비 실적 (월) · 영업 단계 전환율·소요 기간
import { useState } from 'react';
import { Modal } from './ui';
import { api } from '../lib/api';
import { can, liveH, reporters, sc, userName } from '../lib/domain';
import { DEFAULT_GOAL, funnel, GOAL_KEYS, goalOf, goals, monthActual, monthPace, recentMonths, thisMonth, type GoalSet } from '../lib/goals';
import { I } from '../lib/icons';
import { notify, reloadState, S, toast, ui } from '../lib/store';
import { fmtN } from '../lib/utils';

const ymLabel = (ym: string) => `${ym.slice(0, 4)}년 ${+ym.slice(5)}월`;
const barCol = (p: number, pace: number) => p >= 1 ? 'var(--ok)' : p >= pace * .8 ? 'var(--accent)' : 'var(--warn)';

export function GoalBar({ k, act, goal, pace }: { k: string; act: number; goal: number; pace: number }) {
    const p = goal ? act / goal : 1;
    return <div className="goal-bar" title={goal ? `${k} ${fmtN(act)} / ${fmtN(goal)} (${Math.round(p * 100)}%)` : ''}>
        <div className="gb-top"><span>{k}</span><b>{fmtN(act)}<small> / {goal ? fmtN(goal) : '—'}</small></b></div>
        <div className="meter"><i style={{ width: `${Math.min(100, p * 100)}%`, background: barCol(p, pace) }} />{pace < 1 ? <em style={{ left: `${pace * 100}%` }} /> : null}</div></div>;
}

/** 팀 성과 › 이번 달 목표 대비 실적 */
export function GoalPanel() {
    const [ym, setYm] = useState(thisMonth()); const pace = monthPace(ym); const rs = reporters();
    const rows = rs.map(u => ({ u, g: goalOf(u.id), a: monthActual(u.id, ym) }));
    const sum = (f: (r: typeof rows[0]) => number) => rows.reduce((s, r) => s + f(r), 0);
    return <section className="panel" id="goalPanel" style={{ marginBottom: 16 }}><h2>목표 대비 실적 <small>{ymLabel(ym)}{pace < 1 ? ` · 오늘까지 ${Math.round(pace * 100)}% 지남 (막대의 세로선)` : ''}</small>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><select id="goal-ym" value={ym} onChange={e => setYm(e.target.value)} style={{ width: 'auto' }}>{recentMonths(6).map(m => <option key={m} value={m}>{ymLabel(m)}</option>)}</select>
            {can('team', 'update') ? <button className="btn sm" data-act="goalEdit" onClick={() => { ui.modal = { type: 'goalEdit' }; notify(); }}>{I.edit}목표 정하기</button> : null}</span></h2>
        {rows.length ? <div className="tbl-wrap"><table className="goal-tbl"><thead><tr><th>영업사원</th>{GOAL_KEYS.map(([k, l, d]) => <th key={k} title={d}>{l}</th>)}</tr></thead><tbody>
            {rows.map(r => <tr key={r.u.id}><td><b>{r.u.name}</b></td>{GOAL_KEYS.map(([k, l]) => <td key={k}><GoalBar k={l} act={r.a[k]} goal={r.g[k]} pace={pace} /></td>)}</tr>)}
            {rows.length > 1 ? <tr className="avg-row"><td>팀 합계</td>{GOAL_KEYS.map(([k, l]) => <td key={k}><GoalBar k={l} act={sum(r => r.a[k])} goal={sum(r => r.g[k])} pace={pace} /></td>)}</tr> : null}
        </tbody></table></div> : <div className="empty">보고서를 쓰는 영업 담당자가 없습니다</div>}
        <p className="hint" style={{ marginTop: 8 }}>방문은 같은 병원·같은 날을 1회로 셉니다. 회원가입·사용 전환은 그달에 해당 날짜가 있는 담당 병원 수입니다.</p></section>;
}

export function GoalEditModal() {
    const g = goals(); const rs = reporters();
    const [def, setDef] = useState<GoalSet>({ ...DEFAULT_GOAL, ...g.default });
    const [us, setUs] = useState<Record<string, Partial<GoalSet>>>(JSON.parse(JSON.stringify(g.users || {})));
    const [busy, setBusy] = useState(false);
    const setU = (id: string, k: keyof GoalSet, v: string) => setUs(p => { const n = { ...p, [id]: { ...(p[id] || {}) } }; if (v === '') delete n[id][k]; else n[id][k] = Math.max(0, +v || 0); if (!Object.keys(n[id]).length) delete n[id]; return n; });
    async function saveG() {
        setBusy(true);
        try { await api('POST', '/api/goals', { default: def, users: us }); await reloadState(false); ui.modal = null; toast('목표를 저장했습니다'); } catch (e: any) { toast(e.message); } finally { setBusy(false); }
    }
    return <Modal title="월 목표 정하기" size="wide" foot={<><button className="btn" onClick={() => { ui.modal = null; notify(); }}>취소</button><button className="btn primary" data-act="goalSave" disabled={busy} onClick={saveG}>저장</button></>}>
        <p className="hint" style={{ marginTop: 0 }}>기본 목표는 모든 영업사원에게 적용됩니다. 사람마다 다르게 하려면 아래 칸에 숫자를 넣으세요 (비우면 기본값).</p>
        <div className="tbl-wrap"><table className="goal-edit"><thead><tr><th></th>{GOAL_KEYS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead><tbody>
            <tr className="avg-row"><td><b>기본 (매월)</b></td>{GOAL_KEYS.map(([k]) => <td key={k}><input id={`gd-${k}`} type="number" min={0} inputMode="numeric" value={def[k]} onChange={e => setDef({ ...def, [k]: Math.max(0, +e.target.value || 0) })} /></td>)}</tr>
            {rs.map(u => <tr key={u.id}><td>{u.name}</td>{GOAL_KEYS.map(([k]) => <td key={k}><input id={`gu-${u.id}-${k}`} type="number" min={0} inputMode="numeric" placeholder={String(def[k])} value={us[u.id]?.[k] ?? ''} onChange={e => setU(u.id, k, e.target.value)} /></td>)}</tr>)}
        </tbody></table></div></Modal>;
}

/** 오늘 할 일 › 이번 달 내 목표 */
export function MyGoalStrip({ uid }: { uid: string }) {
    const ym = thisMonth(); const g = goalOf(uid); const a = monthActual(uid, ym); const pace = monthPace(ym);
    if (!GOAL_KEYS.some(([k]) => g[k])) return null;
    return <section className="panel goal-strip" id="myGoal"><h2>이번 달 목표 <small>{ymLabel(ym)} · 세로선은 오늘까지 지난 날짜 비율</small></h2>
        <div className="gs-row">{GOAL_KEYS.map(([k, l]) => <GoalBar key={k} k={l} act={a[k]} goal={g[k]} pace={pace} />)}</div></section>;
}

/** 대시보드 › 단계 전환율 · 소요 기간 */
export function FunnelPanel() {
    const [owner, setOwner] = useState(''); const all = liveH();
    const H = owner === '__none' ? all.filter(h => !h.ownerId) : owner ? all.filter(h => h.ownerId === owner) : all;
    const F = funnel(H); const top = F[0]?.reached || 1;
    const owners = S.users.filter(u => all.some(h => h.ownerId === u.id));
    return <section className="panel" id="funnelPanel"><h2>단계 전환율·소요 기간<small>등록부터 각 단계까지 온 병원 · 앞 단계 대비 비율 · 평균 걸린 날</small>
        <select id="fn-owner" value={owner} onChange={e => setOwner(e.target.value)} style={{ marginLeft: 'auto', width: 'auto' }}><option value="">전체 담당</option>{owners.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}<option value="__none">담당 미지정</option></select></h2>
        <div className="tbl-wrap" style={{ border: 0 }}><table className="fn-tbl"><thead><tr><th>단계</th><th>도달</th><th>전환율</th><th>평균 소요</th><th title="지금 이 단계에 30일 넘게 머문 병원">30일+ 정체</th></tr></thead><tbody>
            {F.map((r, i) => <tr key={r.stage}><td><span className="fn-name" style={{ ['--c' as any]: sc(r.stage) }}><i />{r.stage}</span></td>
                <td><div className="fn-bar"><span><i style={{ width: `${r.reached / top * 100}%`, background: sc(r.stage) }} /></span><b>{fmtN(r.reached)}</b></div></td>
                <td className="num">{r.rate == null ? '—' : <span className={r.rate >= .5 ? 'txt-ok' : r.rate >= .2 ? '' : 'txt-warn'}>{fmtN(Math.round(r.rate * 1000) / 10)}%</span>}</td>
                <td className="num">{i === 0 ? '—' : r.avgDays == null ? '—' : `${fmtN(Math.round(r.avgDays))}일`}</td>
                <td className="num">{r.stuck ? <b className="txt-warn">{fmtN(r.stuck)}곳</b> : <span className="muted">0</span>}<small className="muted"> / {fmtN(r.now)}</small></td></tr>)}
        </tbody></table></div>
        <p className="hint" style={{ marginTop: 8 }}>{owner ? `${owner === '__none' ? '담당 미지정' : userName(owner)} 병원 ${fmtN(H.length)}곳 기준. ` : ''}단계를 건너뛴 병원은 앞 단계를 같은 날 지난 것으로 봅니다. 평균 소요는 앞 단계에 들어온 날부터 계산합니다.</p></section>;
}
