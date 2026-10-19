// 팀 성과: 7개 지표 비교(레이더·히트맵), 영업사원 상세, 코칭 메모
import { useState } from 'react';
import { Chart, Legend, Radar, Spark, type HbarSpec, type LineSpec } from '../components/charts';
import { openDetail } from '../components/HospitalDrawer';
import { GoalPanel } from '../components/Goals';
import { InfoBtn } from '../components/InfoPop';
import { Av, Modal, CHECKIN_OK_M, geoDist } from '../components/ui';
import { AXES } from '../lib/constants';
import { can, cur, gradeOfScore, lastContact, liveH, logEntry, repAlerts, roleOf, sc, teamData, userById, userColor, userName, weeklyVisits } from '../lib/domain';
import { I } from '../lib/icons';
import { confirmBox, notify, S, save, STAGES, toast, ui } from '../lib/store';
import { fd, fmtN, fmtTs, uid } from '../lib/utils';

const openTeam = (id: string) => { ui.modal = { type: 'teamView', id }; notify(); };

export function Team() {
    const T = ui.team; const D = teamData(T.weeks); const { M, avg } = D; const goal = S.settings.visitGoal || 4;
    const alerts = M.reduce((s, m) => s + repAlerts(m).filter(a => a[0] === 'crit' || a[0] === 'warn').length, 0); const teamAvg = M.length ? M.reduce((s, m) => s + m.total, 0) / M.length : 0;
    const k: [string, any, string, boolean, string][] = [['팀 평균 종합 점수', `${Math.round(teamAvg)}점`, gradeOfScore(teamAvg)[1], false, 'total'], ['기간 방문', fmtN(M.reduce((s, m) => s + m.visits, 0)), `통화 ${fmtN(M.reduce((s, m) => s + m.calls, 0))}`, false, 'visitsKpi'],
    ['단계 진전', M.reduce((s, m) => s + m.ups, 0), `회원가입 전환 ${M.reduce((s, m) => s + m.signups, 0)}건`, false, 'upsKpi'], ['주의 항목', alerts, '지연·미제출·방치 리드 등', alerts > 0, 'alerts']];
    const cell = (v: number | null, key: string) => v == null ? <td key={key} className="hm">—</td> : <td key={key} className="hm" style={{ background: `color-mix(in srgb,${v >= 80 ? 'var(--ok)' : v >= 50 ? 'var(--warn)' : 'var(--danger)'} ${Math.round(10 + (v >= 80 ? v - 60 : v >= 50 ? 40 : 70 - v) * .5)}%,transparent)` }}>{Math.round(v)}</td>;
    const sorted = [...M].sort((a, b) => b.total - a.total);
    return <>
        <div className="page-head"><div><h1>팀 성과</h1><p>{fd(D.from)} ~ {fd(D.to)} · 활동량, 관리 범위, 단계 진척, 팔로우업, 보고 성실도, 고객 반응, 평가 입력 7가지로 영업사원을 비교합니다. 점선은 팀 평균입니다.</p></div>
            <div className="seg" style={{ width: 'auto' }}>{[2, 4, 8].map(w => <button key={w} type="button" className={T.weeks === w ? 'on' : ''} onClick={() => { T.weeks = w; notify(); }}>최근 {w}주</button>)}</div></div>
        <div className="kpis">{k.map(([l, v, s, al, ik]) => <div key={l} className={`kpi ${al ? 'alert' : ''}`}><span className="lbl-i">{l}<InfoBtn k={ik} /></span><b>{fmtN(v)}</b><small>{s}</small></div>)}</div>
        <GoalPanel />
        <div className="team-grid">{sorted.length ? sorted.map(m => {
            const g = gradeOfScore(m.total); const col = userColor(m.u.id); const wv = weeklyVisits(m.u.id); const al = repAlerts(m);
            return <article key={m.u.id} className="team-card"><div className="tc-head"><Av u={m.u} /><div style={{ minWidth: 0 }}><b>{m.u.name}</b><small>{roleOf(m.u)?.name || ''} · {m.u.team || ''}</small></div><div className={`tc-score ${g[2]}`}><b>{fmtN(g[0])}</b><span>{Math.round(m.total)}점 · {g[1]}</span></div><InfoBtn k="total" u={m.u.id} /></div>
                <Radar vals={m.scores} avg={avg} color={col} size={260} compact />
                <div className="tc-nums"><div><b>{fmtN(m.avg.toFixed(1))}</b><span>일평균 방문<br />목표 {goal}</span></div><div><b>{fmtN(m.own)}</b><span>담당 병원<br />(진행 중)</span></div><div><b>{fmtN(m.ups)}</b><span>단계 진전</span></div><div><b>{fmtN(m.signups)}</b><span>회원가입</span></div></div>
                <div className="tc-trend"><span className="h-sub">주간 방문 8주</span><Spark vals={wv.vals} color={col} /><b className="num">{wv.vals.at(-1)}</b></div>
                <div className="lbl-i h-sub" style={{ marginBottom: -4 }}>주의 항목<InfoBtn k="alerts" /></div>
                <ul className="tc-alerts">{al.length ? al.slice(0, 4).map(([lv, t], i) => <li key={i} className={`al-${lv}`}>{t}</li>) : <li className="al-good">특이 사항 없음</li>}</ul>
                <button className="btn sm" data-act="teamOpen" onClick={() => openTeam(m.u.id)}>자세히 보기 · 코칭 메모</button></article>;
        }) : <div className="panel empty">보고서를 쓰는 영업 담당자가 없습니다</div>}</div>
        <section className="panel" style={{ marginTop: 16 }}><h2>항목별 비교 <small>0~100점 · 초록 80 이상, 주황 50~79, 빨강 50 미만 · ⓘ를 누르면 계산 기준</small></h2>
            <div className="tbl-wrap"><table className="heat"><thead><tr><th>영업사원</th>{AXES.map(([k2, l]) => <th key={k2}><span className="lbl-i">{l}<InfoBtn k={k2} /></span></th>)}<th><span className="lbl-i">종합<InfoBtn k="total" /></span></th></tr></thead><tbody>
                {sorted.map(m => <tr key={m.u.id} className="row" onClick={e => { if (!(e.target as Element).closest('.info-btn')) openTeam(m.u.id); }}><td><div className="u-cell"><span className="sw-dot" style={{ background: userColor(m.u.id) }} /><b>{m.u.name}</b></div></td>{AXES.map(([k2]) => cell(m.scores[k2], k2))}<td><span className={`badge ${gradeOfScore(m.total)[2]}`}>{gradeOfScore(m.total)[0]} {Math.round(m.total)}</span></td></tr>)}
                <tr className="avg-row"><td>팀 평균</td>{AXES.map(([k2]) => <td key={k2} className="num">{M.some(x => x.scores[k2] != null) ? Math.round(avg[k2]) : '—'}</td>)}<td className="num">{Math.round(teamAvg)}</td></tr></tbody></table></div></section>
    </>;
}

export function TeamViewModal({ id }: { id: string }) {
    const D = teamData(ui.team.weeks); const m = D.M.find(x => x.u.id === id); const [txt, setTxt] = useState('');
    if (!m) return <Modal title="영업사원 상세" size="wide"><div className="empty">데이터 없음</div></Modal>;
    const col = userColor(id); const g = gradeOfScore(m.total); const wv = weeklyVisits(id); const team = D.M.map(x => weeklyVisits(x.u.id).vals);
    const tAvg = wv.ws.map((_, i) => +(team.reduce((s, v) => s + v[i], 0) / Math.max(1, team.length)).toFixed(1));
    const line: LineSpec = { type: 'line', h: 200, labels: wv.ws.map(w => w.slice(5).replace('-', '/')), full: wv.ws.map(w => `${fd(w)} 시작 주`), unit: '곳', series: [{ name: m.u.name, color: col, values: wv.vals }, { name: '팀 평균', color: 'var(--muted)', values: tAvg }] };
    const own = liveH().filter(h => h.ownerId === id); const pipe: HbarSpec = { type: 'hbar', rows: STAGES.map(s => ({ label: s, segs: [{ name: '병원', color: sc(s), value: own.filter(h => h.stage === s).length }] })), unit: '곳', labelW: 96 };
    const notes = (S.coaching || []).filter(n => n.userId === id).sort((a, b) => b.ts.localeCompare(a.ts)); const ce = can('team', 'create');
    function coachAdd() {
        if (!can('team', 'create')) { toast('코칭 메모 권한이 없습니다'); return; } const t = txt.trim(); if (!t) { document.getElementById('coach-text')?.focus(); return; }
        const n = { id: 'co_' + uid(), userId: id, authorId: cur()!.id, authorName: cur()!.name, ts: new Date().toISOString(), text: t }; (S.coaching ||= []).push(n);
        logEntry({ entity: 'user', entityId: n.userId, targetName: userName(n.userId), action: 'create', section: '코칭 메모', changes: [{ field: '메모', before: '', after: t }] }); setTxt(''); save(); toast('코칭 메모를 남겼습니다');
    }
    async function coachDel(nid: string) {
        const n = S.coaching.find(x => x.id === nid); if (!n || !can('team', 'delete')) return;
        if (!await confirmBox({ title: '메모를 삭제할까요?', body: <p>삭제 내역은 변경 이력에 남습니다.</p>, ok: '삭제', danger: true })) return;
        S.coaching = S.coaching.filter(x => x !== n); logEntry({ entity: 'user', entityId: n.userId, targetName: userName(n.userId), action: 'delete', section: '코칭 메모', changes: [{ field: '메모', before: n.text, after: '' }] }); save();
    }
    const rows: [string, string][] = [['activity', `방문 ${m.visits} / 목표 ${m.goalSum} (근무 ${m.worked}일)`], ['coverage', `${m.contacted} / ${fmtN(m.own)}곳`], ['progress', `단계 진전 ${fmtN(m.ups)}건`], ['followup', `지연 ${m.overdue.length} / 진행 중 ${fmtN(m.withNext)}건`], ['report', `제출 ${m.subm} / ${m.due}일`], ['response', `긍정 ${m.re.긍정} · 보통 ${m.re.보통} · 부정 ${m.re.부정}`], ['quality', `${m.evalOk} / ${fmtN(m.elig)}곳`]];
    const open = (hid: string) => { ui.modal = null; openDetail(hid); };
    return <Modal title="영업사원 상세" size="wide">
        <div className="rv-head"><Av u={m.u} /><div><b>{m.u.name}</b> <span className="muted">{roleOf(m.u)?.name || ''} · {m.u.team || ''}</span><div className="au-meta"><span>{fd(D.from)} ~ {fd(D.to)}</span>{(() => { const v = S.hospitals.flatMap(h => (h.activities || []).filter(a => a.type === '방문' && a.authorId === id && a.date >= D.from && a.date <= D.to).map(a => ({ a, h }))); const ok = v.filter(x => { const d = geoDist(x.a.geo, x.h); return d != null && d <= CHECKIN_OK_M; }).length; return v.length ? <span title="방문 기록 중 병원 300m 안에서 체크인한 기록">현장 확인 방문 {fmtN(ok)} / {fmtN(v.length)}건</span> : null; })()}<span className={`badge ${g[2]}`}>{g[0]} · {Math.round(m.total)}점 · {g[1]}</span></div></div></div>
        <div className="td-top"><div><Radar vals={m.scores} avg={D.avg} color={col} size={340} /><p className="hint" style={{ textAlign: 'center', margin: 0 }}>실선 {m.u.name} · 점선 팀 평균</p></div>
            <div className="tbl-wrap"><table><thead><tr><th>항목</th><th>점수</th><th>팀 평균</th><th>근거</th></tr></thead><tbody>
                {rows.map(([k, t]) => <tr key={k}><td><span className="lbl-i">{AXES.find(a => a[0] === k)![1]}<InfoBtn k={k} u={id} /></span></td><td className="num"><b>{m.scores[k] == null ? '—' : Math.round(m.scores[k]!)}</b></td><td className="num muted">{D.M.some(x => x.scores[k] != null) ? Math.round(D.avg[k]) : '—'}</td><td className="h-sub">{t}</td></tr>)}</tbody></table></div></div>
        <div className="rv-2"><div><h3 className="rv-h">주간 방문 추이</h3><Legend series={line.series} /><Chart spec={line} /></div><div><h3 className="rv-h">담당 병원 단계 구성 · {fmtN(own.length)}곳</h3><Chart spec={pipe} /></div></div>
        <div className="rv-2"><div><h3 className="rv-h">팔로우업 지연 · {fmtN(m.overdue.length)}건</h3>{m.overdue.length ? <ul className="plain">{[...m.overdue].sort((a, b) => a.next.date!.localeCompare(b.next.date!)).slice(0, 8).map(h => <li key={h.id}><button className="au-target" onClick={() => open(h.id)}>{h.name}</button> <span className="h-sub">{fd(h.next.date)} · {h.next.todo || ''}</span></li>)}</ul> : <p className="hint">없음</p>}</div>
            <div><h3 className="rv-h">2주 넘게 연락 없는 병원 · {fmtN(m.stale.length)}곳</h3>{m.stale.length ? <ul className="plain">{m.stale.slice(0, 8).map(h => <li key={h.id}><button className="au-target" onClick={() => open(h.id)}>{h.name}</button> <span className="h-sub">{h.stage} · 마지막 접촉 {fd(lastContact(h)) || '없음'}</span></li>)}</ul> : <p className="hint">없음</p>}</div></div>
        <h3 className="rv-h">코칭 메모 · {fmtN(notes.length)}건</h3>{ce ? <div className="inline-add" style={{ marginBottom: 10 }}><input id="coach-text" value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); coachAdd(); } }} placeholder="예: 분당 권역 2차 방문 전환율 개선 — 시연 자료 보강 함께 준비" style={{ flex: 1 }} /><button className="btn primary" data-act="coachAdd" onClick={coachAdd}>메모 남기기</button></div> : null}
        {notes.length ? <ul className="audit">{notes.map(n => <li key={n.id} className="au"><div className="au-head"><Av u={userById(n.authorId) || { name: n.authorName }} /><div style={{ flex: 1, minWidth: 0 }}><b>{userName(n.authorId) || n.authorName}</b><div className="au-meta"><span className="mono">{fmtTs(n.ts)}</span>{n.readAt ? <span className="badge f-완료" title={fmtTs(n.readAt)}>확인함</span> : <span className="badge f-없음">아직 안 봄</span>}</div><p className="au-sum" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.text}</p></div>
            {can('team', 'delete') && n.authorId === cur()!.id ? <button className="icon-btn" onClick={() => coachDel(n.id)} aria-label="삭제">{I.trash}</button> : null}</div></li>)}</ul> : <p className="hint">아직 메모가 없습니다. 1:1 면담 내용과 다음 목표를 남겨 두세요.</p>}
    </Modal>;
}
