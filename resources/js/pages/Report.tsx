// 영업 보고: 보고서 작성 · 제출 현황 · 분석 + 보고서 보기·검토 창 + 빠른 활동 기록 창
import { useEffect, useState } from 'react';
import { AuditList } from '../components/Audit';
import { Chart, Legend, TableView, type HbarSpec, type LineSpec } from '../components/charts';
import { actExtras, blankAct, ExtrasFields, openDetail, type ActDraft } from '../components/HospitalDrawer';
import { HospitalPicker } from '../components/HospitalPicker';
import { appendText, Av, CheckInButton, DateInput, Modal, VoiceButton } from '../components/ui';
import { ACT_CONTACTS, ACT_PURPOSES, ACT_REACTIONS, ACT_TYPES, ATT, ATT_ST, EXP_TYPES, ISSUE_TYPES, REP_ST, VOC_TYPES, WORK_TYPES } from '../lib/constants';
import {
    attOn, autoAdvance, bizDays, canComp, canRead, canRep, canReview, compById, cur, diffSnap, expTotal, getH, goalFor, hName, holMap, holName, isOffDay, liveH, logEntry,
    mutateH, need, newReport, nextBiz, prevBiz, repRange, reporters, repStats, roleOf, setPreset, snapRep, syncAutoRows, userById, userColor, userName,
    peopleScope,
} from '../lib/domain';
import { I } from '../lib/icons';
import { confirmBox, notify, promptBox, S, save, saveNow, setView, toast, ui } from '../lib/store';
import type { Report as Rep } from '../lib/types';
import { clearDraft, loadDraft, saveDraft } from '../lib/actdraft';
import { clone, fd, fmtN, fmtTs, today, uid, WD, won } from '../lib/utils';
import { goTo, wonText } from '../lib/ux';
import { exportActivities, exportReports } from '../lib/exporter';

/** 특정 날짜 보고서 작성 화면으로 */
export function openReportAt(date: string) { ui.modal = null; ui.rep.tab = 'write'; ui.rep.date = date; ui.rep.draftKey++; setView('report'); }
export const openRep = (id: string) => { const r = S.reports.find(x => x.id === id); if (!r) return; if (!canRep('read', r)) { toast('이 보고서를 볼 권한이 없습니다'); return; } ui.rep.review = ''; ui.modal = { type: 'repView', id }; notify(); };

export function Report() {
    const R = ui.rep; const tabs = ([canRep('create') && ['write', '보고서 작성'], ['status', '제출 현황'], ['anal', '분석']].filter(Boolean)) as [string, string][];
    if (!tabs.some(t => t[0] === R.tab)) R.tab = tabs[0][0];
    const pend = S.reports.filter(r => r.status === 'submitted' && canReview(r)).length;
    return <>
        <div className="page-head"><div><h1>영업 보고</h1><p>하루 활동은 병원별 활동 기록에서 자동으로 모이고, 영업사원은 고객 반응·경쟁사·지원 요청·내일 계획을 더해 제출합니다.{pend ? <> 검토 대기 <b>{fmtN(pend)}건</b>.</> : null}</p></div></div>
        <div className="sub-tabs">{tabs.map(([k, l]) => <button key={k} className={`tab ${R.tab === k ? 'on' : ''}`} data-act="repTab" data-v={k} onClick={() => { R.tab = k; notify(); }}>{l}{k === 'status' && pend ? <span className="n">{pend}</span> : null}</button>)}</div>
        {R.tab === 'write' ? <ReportWrite key={`${R.date}:${R.draftKey}`} /> : R.tab === 'status' ? <ReportStatus /> : <ReportAnal />}
    </>;
}

/* ---------------- 공통 조각 ---------------- */
function StatTiles({ st, goal }: { st: any; goal: number }) {
    const pct = goal ? Math.min(100, Math.round(st.visits / goal * 100)) : 0;
    return <div className="rep-kpis"><div className="rk wide"><span>방문</span><b>{fmtN(st.visits)}<small> / 목표 {goal}</small></b><div className="meter"><i style={{ width: `${pct}%`, background: st.visits >= goal ? 'var(--ok)' : 'var(--accent)' }} /></div></div>
        {[['통화', st.calls], ['문자·메일', st.msgs], ['시연', st.demos], ['신규 등록', st.newHosp], ['리드 평가', st.evals], ['단계 진전', st.stageUps], ['회원가입', st.signups]].map(([l, v]) => <div key={l} className="rk"><span>{l}</span><b>{fmtN(v)}</b></div>)}</div>;
}
function ActsTable({ acts, editable }: { acts: any[]; editable: boolean }) {
    if (!acts.length) return <div className="empty">이날 기록된 방문·접촉이 없습니다{editable ? '. 아래 버튼으로 바로 기록하세요' : ''}</div>;
    return <div className="tbl-wrap"><table className="acts"><thead><tr><th>병원</th><th>유형</th><th>목적</th><th>면담</th><th>반응</th><th>내용</th></tr></thead><tbody>
        {acts.map((a, i) => <tr key={a.id || i}><td><button className="au-target" onClick={() => { ui.modal = null; openDetail(a.hospitalId); }}>{a.hospitalName}</button></td><td>{a.type}</td><td>{a.purpose || '—'}</td><td>{a.contact || '—'}</td><td>{a.reaction ? <span className={`badge re-${a.reaction}`}>{a.reaction}</span> : '—'}</td><td className="h-sub" style={{ minWidth: 180 }}>{a.note || ''}</td></tr>)}</tbody></table></div>;
}

/* ---------------- 작성 ---------------- */
type RowKey = 'voc' | 'comp' | 'issues' | 'exp';
function RowsEditor({ k, d, setD, ro0, dayIds }: { k: RowKey; d: Rep; setD: (fn: (d: Rep) => void) => void; ro0: boolean; dayIds: string[] }) {
    const rows: any[] = (d as any)[k] || []; const autoN = rows.filter(x => x.src).length;
    const up = (i: number, p: any) => setD(x => { (x as any)[k][i] = { ...(x as any)[k][i], ...p }; });
    const cells = (x: any, i: number, ro: boolean) => {
        const sel = (f: string, opts: string[]) => <select value={x[f] ?? ''} disabled={ro} onChange={e => up(i, { [f]: e.target.value })}>{opts.map(o => <option key={o}>{o}</option>)}</select>;
        const hs = ro ? <input value={hName(x.hospitalId) || '—'} disabled /> : <HospitalPicker value={x.hospitalId || ''} onPick={id => up(i, { hospitalId: id })} placeholder="병원 검색 (선택)" dayIds={dayIds} />;
        const tx = (f: string, ph: string) => <input value={x[f] || ''} placeholder={ph} disabled={ro} onChange={e => up(i, { [f]: e.target.value })} />;
        if (k === 'voc') return <>{sel('type', VOC_TYPES)}{hs}{tx('text', '고객이 한 말, 요청 내용')}</>;
        if (k === 'comp') return <><select value={x.competitorId || ''} disabled={ro} onChange={e => up(i, { competitorId: e.target.value, name: compById(e.target.value)?.name || '' })}><option value="">경쟁사 선택</option>{(S.competitors || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}{x.name && !x.competitorId ? <option value="">{x.name} (미등록)</option> : null}</select>{hs}{tx('text', '제안 조건, 병원 반응')}</>;
        if (k === 'issues') return <>{sel('type', ISSUE_TYPES)}<select value={x.urgency} disabled={ro0} onChange={e => up(i, { urgency: e.target.value })}>{['보통', '긴급'].map(o => <option key={o}>{o}</option>)}</select>{tx('text', '필요한 지원과 이유')}</>;
        return <>{sel('type', EXP_TYPES)}<input type="number" min="0" step="1000" value={x.amount || ''} placeholder="금액(원)" disabled={ro} onChange={e => up(i, { amount: e.target.value })} />{tx('note', '메모 (선택)')}</>;
    };
    const def: Record<RowKey, any> = { voc: { type: VOC_TYPES[0], hospitalId: '', text: '' }, comp: { name: '', hospitalId: '', text: '' }, issues: { type: ISSUE_TYPES[0], urgency: '보통', text: '' }, exp: { type: EXP_TYPES[0], amount: '', note: '' } };
    return <div className="rr-list">{rows.map((x, i) => x.src
        ? <div key={'a' + x.src} className={`rr rr-${k} auto`} title="영업 활동 기록에서 자동으로 들어온 내용입니다. 수정은 병원 상세 › 영업 활동에서 하세요.">{cells(x, i, true)}<span className="auto-tag">영업 활동</span></div>
        : <div key={'r' + i} className={`rr rr-${k}`} data-row={`${k}-${i}`}>{cells(x, i, ro0)}{ro0 ? null : <button className="icon-btn" onClick={() => setD(y => { (y as any)[k].splice(i, 1); })} aria-label="행 삭제">{I.x}</button>}{k === 'exp' && +x.amount ? <small className="exp-ko">{wonText(x.amount)}</small> : null}</div>)}
        {ro0 ? null : <button className="btn sm" onClick={() => setD(y => { (y as any)[k].push({ ...def[k] }); })}>{I.plus}추가</button>}
        {autoN && !ro0 ? <p className="hint">영업 활동에서 {autoN}건이 자동으로 들어왔습니다. 수정은 병원 상세 › 영업 활동에서 하세요.</p> : null}{ro0 && !rows.length ? <p className="hint">없음</p> : null}</div>;
}

/* 작성 중인 보고서를 이 기기(브라우저)에 보관: 서버 저장이 실패하거나 화면을 옮겨도 내용이 사라지지 않게 */
const EDIT_KEYS = ['workType', 'region', 'mileage', 'highlights', 'voc', 'comp', 'issues', 'plan', 'exp', 'memo'] as const;
const editPart = (r?: Partial<Rep> | null) => JSON.stringify(EDIT_KEYS.map(k => (r as any)?.[k] ?? null));
const draftKeyOf = (uid: string, date: string) => `vv-rep-draft:${uid}:${date}`;
function readDraft(k: string): { d: Rep; at: string } | null { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function writeDraft(k: string, d: Rep | null) { try { if (d) localStorage.setItem(k, JSON.stringify({ d, at: new Date().toISOString() })); else localStorage.removeItem(k); } catch { /* 저장 불가한 브라우저 */ } }

function ReportWrite() {
    const R = ui.rep; const me = cur()!; const lk = draftKeyOf(me.id, R.date);
    const [restored, setRestored] = useState(false);
    const [d, setDraft] = useState<Rep>(() => {
        const ex = S.reports.find(r => r.authorId === me.id && r.date === R.date); const loc = readDraft(lk);
        // 서버에 없는(또는 다른) 작성 내용이 이 기기에 남아 있으면 그것을 불러온다 (확인된 보고서는 제외)
        if (loc?.d && ex?.status !== 'confirmed' && editPart(loc.d) !== editPart(ex || newReport(me.id, R.date))) { setTimeout(() => setRestored(true)); return { ...(ex ? clone(ex) : newReport(me.id, R.date)), ...Object.fromEntries(EDIT_KEYS.map(k => [k, (loc.d as any)[k]])) } as Rep; }
        return ex ? clone(ex) : newReport(me.id, R.date);
    });
    const [err, setErr] = useState('');
    const setD = (fn: (d: Rep) => void) => setDraft(x => { const y = clone(x); fn(y); return y; });
    syncAutoRows(d);
    const saved = S.reports.find(r => r.id === d.id) || S.reports.find(r => r.authorId === me.id && r.date === d.date); const status = saved?.status;
    // 바뀐 내용이 서버 것과 다르면 이 기기에 보관, 같아지면 지운다
    useEffect(() => { if (status === 'confirmed') return; writeDraft(lk, editPart(d) !== editPart(saved || newReport(me.id, d.date)) ? d : null); }, [d, saved, status]); // eslint-disable-line react-hooks/exhaustive-deps
    const ro = status === 'confirmed' || !(saved ? canRep('update', saved) : canRep('create'));
    const st = status === 'confirmed' ? { ...saved!.stats, acts: saved!.acts } : repStats(me.id, d.date); const goal = saved?.goal ?? goalFor(me.id, d.date);
    const dayIds = [...new Set((st.acts || []).map((a: any) => a.hospitalId))] as string[]; const nb = nextBiz(d.date);
    const sug = liveH().filter(h => h.ownerId === me.id && h.next?.date && !h.next.done && h.next.date <= nb && !d.plan.hospitalIds.includes(h.id));
    const go = (date: string) => { if (date > today()) return; R.date = date; R.draftKey++; notify(); };
    function repSave(submit: boolean) {
        if (saved?.status === 'confirmed') return; if (!(saved ? canRep('update', saved) : canRep('create'))) { toast('보고서 작성 권한이 없습니다'); return; }
        const x = clone(d);
        if (submit) {
            if (x.workType !== '휴가' && !String(x.highlights || '').trim()) { setErr('오늘 요약을 입력해야 제출할 수 있습니다.'); goTo('[data-rp=highlights]'); return; }
            const bad = (x.voc || []).some(v => !String(v.text || '').trim()) || (x.comp || []).some(v => !String(v.name || '').trim()) || (x.issues || []).some(v => !String(v.text || '').trim());
            if (bad) { setErr('내용이 빈 VOC·경쟁사·지원 요청 행이 있습니다. 채우거나 삭제하세요.'); const kb = (['voc', 'comp', 'issues'] as const).map(k => [k, (x[k] || []).findIndex((v: any) => !String((k === 'comp' ? v.name : v.text) || '').trim())] as const).find(([, i]) => i >= 0); if (kb) goTo(`[data-row="${kb[0]}-${kb[1]}"]`); return; }
        }
        setErr(''); const s = repStats(me.id, x.date); const { acts, ...rest } = s; x.stats = rest; x.acts = acts; x.goal = goalFor(me.id, x.date);
        x.exp = (x.exp || []).map(e => ({ ...e, amount: +e.amount || 0 })); x.mileage = x.mileage === '' ? '' : +x.mileage; x.plan.goal = x.plan.goal === '' ? '' : +x.plan.goal;
        const prev = saved ? snapRep(saved) : {}; const wasSt = saved?.status;
        if (submit) { x.status = 'submitted'; x.submittedAt = new Date().toISOString(); x.reviewerId = saved?.reviewerId && wasSt === 'returned' ? saved.reviewerId : ''; } else if (!saved) x.status = 'draft';
        const ch = diffSnap(prev, snapRep(x));
        if (ch.length || !saved) logEntry({ entity: 'report', entityId: x.id, targetName: `${me.name} ${x.date} 일일 보고`, action: saved ? 'update' : 'create', section: submit ? '보고서 제출' : '영업 보고', changes: ch });
        if (saved) Object.assign(saved, clone(x)); else S.reports.push(clone(x));
        writeDraft(lk, x); R.draftKey++; notify();
        saveNow().then(ok => {
            if (ok) { writeDraft(lk, null); toast(submit ? (wasSt === 'returned' ? '다시 제출했습니다' : '보고서를 제출했습니다') : '저장했습니다'); }
            else toast('보고서를 저장하지 못했습니다. 작성한 내용은 이 기기에 보관돼 있으니 다시 저장해 주세요');
        });
    }
    async function repDelete() {
        if (!saved || !canRep('delete', saved)) { toast('보고서 삭제 권한이 없습니다'); return; }
        if (!await confirmBox({ title: '임시 저장한 보고서를 삭제할까요?', body: <p>{fd(d.date)} 보고서 초안이 삭제됩니다. 활동 기록은 그대로 남습니다.</p>, ok: '삭제', danger: true })) return;
        logEntry({ entity: 'report', entityId: saved.id, targetName: `${userName(saved.authorId)} ${saved.date} 일일 보고`, action: 'delete', section: '영업 보고', changes: diffSnap(snapRep(saved), {}) });
        S.reports = S.reports.filter(r => r !== saved); writeDraft(lk, null); R.draftKey++; save(); toast('초안을 삭제했습니다');
    }
    const at = attOn(me.id, d.date, ['approved', 'requested']);
    const set = (k: keyof Rep) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD(x => { (x as any)[k] = e.target.value; });
    return <>
        {restored ? <div className="notice warn" style={{ marginBottom: 12 }}><span>저장되지 않은 작성 내용을 이 기기에서 불러왔습니다. 확인한 뒤 ‘임시 저장’ 또는 ‘제출’을 눌러 주세요.</span>
            <button className="btn sm ghost" onClick={() => { writeDraft(lk, null); setRestored(false); R.draftKey++; notify(); }}>서버에 저장된 내용으로 되돌리기</button></div> : null}
        <div className="rep-bar"><button className="icon-btn" onClick={() => go(prevBiz(d.date))} aria-label="이전 근무일">‹</button>
            <DateInput id="rp-date" value={d.date} max={today()} onChange={v => { if (v) go(v > today() ? today() : v); }} />
            <button className="icon-btn" onClick={() => go(nextBiz(d.date))} aria-label="다음 근무일" disabled={d.date >= today()}>›</button>
            <b className="rep-day">{fd(d.date)}{holName(d.date) ? ` · ${holName(d.date)}` : ''}</b><span className={`badge ${status ? REP_ST[status][1] : 'f-없음'}`}>{status ? REP_ST[status][0] : '작성 전'}</span>
            {saved?.reviewerId ? <span className="hint">{status === 'returned' ? '반려' : '검토'} {userName(saved.reviewerId)} · {saved.reviewedAt ? fmtTs(saved.reviewedAt) : ''}</span> : null}</div>
        {at ? <div className={`notice ${at.status === 'requested' ? 'warn' : ''}`} style={{ marginBottom: 12 }}><span>{at.type} · {ATT_ST[at.status][0]}{ATT[at.type]?.off ? ' · 이 날은 보고서를 쓰지 않아도 됩니다' : ` · 방문 목표 ${goalFor(me.id, d.date)}곳`}</span></div> : null}
        {status === 'returned' && saved!.reviewComment ? <div className="warnbox" style={{ marginBottom: 12 }}><b>반려 사유</b> · {saved!.reviewComment}</div> : null}
        {status === 'confirmed' ? <div className="ro-note" style={{ marginBottom: 12 }}>{I.lock}확인 완료된 보고서는 수정할 수 없습니다{saved!.reviewComment ? ` · 검토 의견: ${saved!.reviewComment}` : ''}</div> : null}
        <div className="rep-grid">
            <section className="panel span2"><h2>오늘 활동 요약 <small>{status === 'confirmed' ? '제출 시점 값' : '병원별 활동 기록·변경 이력에서 자동 집계'}</small></h2><StatTiles st={st} goal={goal} /></section>
            <section className="panel span2"><h2>방문·접촉 내역 <small>{fmtN((st.acts || []).length)}건</small></h2><ActsTable acts={st.acts || []} editable={!ro} />
                {ro || d.date > today() ? null : <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn sm" data-act="quickAct" onClick={() => { ui.modal = { type: 'quickAct', f: { ...blankAct(d.date), hospitalId: '' } }; notify(); }}>{I.plus}방문·접촉 기록 추가</button><span className="hint" style={{ alignSelf: 'center' }}>여기서 기록해도 병원 상세의 영업 활동과 변경 이력에 함께 남습니다</span></div>}</section>
            <section className="panel"><h2>근무 정보</h2><div style={{ display: 'grid', gap: 12 }}><div className="fld"><span>근무 형태</span><div className="seg">{WORK_TYPES.map(w => <button key={w} type="button" className={d.workType === w ? 'on' : ''} disabled={ro} onClick={() => setD(x => { x.workType = w; })}>{w}</button>)}</div></div>
                <div className="row-2"><label className="fld"><span>방문 지역</span><input value={d.region} onChange={set('region')} placeholder={[...new Set(dayIds.map(id => getH(id)?.sigungu).filter(Boolean))].join(', ') || '예: 강남구, 서초구'} disabled={ro} /></label>
                    <label className="fld"><span>이동 거리 (km)</span><input type="number" min="0" value={d.mileage} onChange={set('mileage')} disabled={ro} /></label></div></div></section>
            <section className="panel"><h2><span>오늘 요약 <em className="req" title="제출 시 필수">*</em></span><small>성과·진척, 팀장에게 알릴 핵심</small></h2><textarea data-rp="highlights" rows={5} value={d.highlights} onChange={set('highlights')} placeholder="예: 해솔 동물병원 2차 시연 후 원장님 가입 의사 확인. 다음 주 화요일 계약 예정." disabled={ro} />
                {ro ? null : <div className="note-tools" style={{ marginTop: 6 }}><VoiceButton onText={t => setD(x => { x.highlights = appendText(x.highlights || '', t); })} /></div>}</section>
            <section className="panel span2"><h2>고객의 소리 (VOC) <small>제품·가격·교육에 대한 병원 의견. 제품팀에 전달됩니다</small></h2><RowsEditor k="voc" d={d} setD={setD} ro0={ro} dayIds={dayIds} /></section>
            <section className="panel"><h2>경쟁사 동향 {canComp('read') ? <button className="link-btn" onClick={() => setView('comp')}>경쟁사 목록</button> : null}</h2><RowsEditor k="comp" d={d} setD={setD} ro0={ro} dayIds={dayIds} /></section>
            <section className="panel"><h2>지원 요청·이슈</h2><RowsEditor k="issues" d={d} setD={setD} ro0={ro} dayIds={dayIds} /></section>
            <section className="panel"><h2>다음 근무일 계획 <small>{fd(nb)}</small></h2><div style={{ display: 'grid', gap: 10 }}>
                <div className="chips">{d.plan.hospitalIds.length ? d.plan.hospitalIds.map(id => <span key={id} className="cat-chip plan-chip">{hName(id)}{ro ? null : <button onClick={() => setD(x => { x.plan.hospitalIds = x.plan.hospitalIds.filter(y => y !== id); })} aria-label="빼기">{I.x}</button>}</span>) : <span className="hint">방문할 병원을 추가하세요</span>}</div>
                {ro ? null : <>{sug.length ? <div className="hint">추천 · 다음 액션일이 다가온 병원: {sug.map(h => <button key={h.id} className="link-btn" onClick={() => setD(x => { x.plan.hospitalIds.push(h.id); })}>+ {h.name}</button>)}</div> : null}
                    <HospitalPicker value="" planMode exclude={d.plan.hospitalIds} onPick={id => { if (id) setD(x => { if (!x.plan.hospitalIds.includes(id)) x.plan.hospitalIds.push(id); }); }} placeholder="방문할 병원 검색해서 추가 (병원명·지역·원장)" /></>}
                <div className="row-2"><label className="fld"><span>목표 방문 수</span><input type="number" min="0" value={d.plan.goal} onChange={e => setD(x => { x.plan.goal = e.target.value as any; })} disabled={ro} /></label><div /></div>
                <label className="fld"><span>메모</span><input value={d.plan.note || ''} onChange={e => setD(x => { x.plan.note = e.target.value; })} placeholder="예: 오전 분당 권역, 오후 사무실 교육" disabled={ro} /></label></div></section>
            <section className="panel"><h2>경비 <small>합계 {wonText(expTotal(d))}</small></h2><RowsEditor k="exp" d={d} setD={setD} ro0={ro} dayIds={dayIds} /></section>
            <section className="panel span2"><h2>특이사항</h2><textarea rows={2} value={d.memo} onChange={set('memo')} placeholder="건의, 개인 일정, 기타" disabled={ro} /></section>
        </div>
        {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
        {ro ? null : <div className="d-foot rep-foot">{saved && status === 'draft' && canRep('delete', saved) ? <button className="btn danger" onClick={repDelete}>임시 저장 삭제</button> : <span />}
            <div style={{ display: 'flex', gap: 8 }}>{status === 'submitted' ? <button className="btn primary" onClick={() => repSave(false)}>수정 내용 저장</button> : <><button className="btn" data-act="rpSave" onClick={() => repSave(false)}>임시 저장</button><button className="btn primary" data-act="rpSubmit" onClick={() => repSave(true)}>{status === 'returned' ? '다시 제출' : '제출'}</button></>}</div></div>}
    </>;
}

/* ---------------- 기간 선택 ---------------- */
function RangeBar({ withStatus }: { withStatus: boolean }) {
    const R = ui.rep; const [from, to] = repRange(); const own = peopleScope() === 'self';
    return <div className="toolbar">{[['week', '이번 주'], ['2w', '최근 2주'], ['month', '이번 달'], ['30', '최근 30일']].map(([k, l]) => <button key={k} className={`btn sm ${R.preset === k ? 'primary' : ''}`} onClick={() => { setPreset(k); notify(); }}>{l}</button>)}
        <DateInput value={from} max={to} aria-label="시작일" onChange={v => { R.from = v; R.preset = ''; notify(); }} /><span className="muted">~</span><DateInput value={to} min={from} max={today()} aria-label="종료일" onChange={v => { R.to = v; R.preset = ''; notify(); }} />
        {own ? null : <select value={R.user} onChange={e => { R.user = e.target.value; notify(); }} aria-label="영업사원"><option value="">영업사원 전체</option>{reporters().map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
        {withStatus ? <select value={R.status} onChange={e => { R.status = e.target.value; notify(); }} aria-label="상태"><option value="">상태 전체</option>{Object.entries(REP_ST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select> : null}</div>;
}

/* ---------------- 제출 현황 ---------------- */
function ReportStatus() {
    const R = ui.rep; const [from, to] = repRange(); const days = bizDays(from, to); const users = reporters().filter(u => !R.user || u.id === R.user); const me = cur()!;
    const cell = (u: any, d: string) => {
        const r = S.reports.find(x => x.authorId === u.id && x.date === d); let cls: string, txt: any, tp: string;
        const at = attOn(u.id, d);
        if (at && ATT[at.type]?.off && !r) { cls = 'rc-leave'; txt = ATT[at.type].short; tp = at.type; }
        else if (r) { cls = 'rc-' + r.status; txt = r.stats?.visits ?? repStats(u.id, d).visits; tp = `${REP_ST[r.status][0]} · 방문 ${txt}`; }
        else if (d === today()) { cls = 'rc-todo'; txt = '·'; tp = '오늘 작성 전'; } else { cls = 'rc-missing'; txt = '!'; tp = '미제출'; }
        const click = r ? () => openRep(r.id) : u.id === me.id && canRep('create') ? () => openReportAt(d) : undefined;
        return <td key={d}><button className={`rc ${cls}`} onClick={click} data-tip={[`${u.name} · ${fd(d)}`, tp].join('\n')}>{txt}</button></td>;
    };
    const rate = (u: any) => { const rs = S.reports.filter(r => r.authorId === u.id && r.date >= from && r.date <= to); const due = days.filter(d => d < today() && !isOffDay(u.id, d)).length; const ok = rs.filter(r => r.workType !== '휴가' && r.date < today() && ['submitted', 'confirmed'].includes(r.status)).length; return due > 0 ? Math.round(ok / due * 100) : null; };
    const list = S.reports.filter(r => r.date >= from && r.date <= to && users.some(u => u.id === r.authorId) && (!R.status || r.status === R.status) && r.workType !== '휴가').sort((a, b) => b.date.localeCompare(a.date) || userName(a.authorId).localeCompare(userName(b.authorId), 'ko'));
    const hols = Object.entries(holMap()).filter(([d]) => d >= from && d <= to);
    return <><RangeBar withStatus />
        <section className="panel"><h2>영업사원 × 날짜 <small>{fd(from)} ~ {fd(to)} · 숫자는 방문 수 · 칸을 누르면 보고서가 열립니다</small></h2>
            <div className="rc-legend">{[['rc-confirmed', '확인'], ['rc-submitted', '제출·검토 대기'], ['rc-returned', '반려'], ['rc-draft', '임시 저장'], ['rc-missing', '미제출'], ['rc-leave', '연차·병가 등']].map(([c, l]) => <span key={c}><i className={`rc ${c}`} />{l}</span>)}</div>
            <div className="tbl-wrap"><table className="rc-table"><thead><tr><th>영업사원</th>{days.map(d => <th key={d} title={fd(d)}>{+d.slice(5, 7)}/{+d.slice(8)}<small>{WD[new Date(d + 'T00:00:00').getDay()]}</small></th>)}<th>제출률</th></tr></thead>
                <tbody>{users.map(u => { const rt = rate(u); return <tr key={u.id}><td><div className="u-cell"><Av u={u} cls="sm" /><b>{u.name}</b></div></td>{days.map(d => cell(u, d))}<td className="num"><b>{rt == null ? '—' : rt + '%'}</b></td></tr>; })}</tbody></table></div>
            {hols.length ? <p className="hint" style={{ marginTop: 8 }}>공휴일 제외: {hols.map(([d, n]) => `${fd(d)} ${n}`).join(', ')}</p> : null}</section>
        <section className="panel" style={{ marginTop: 16 }}><h2>보고서 목록 <small>{fmtN(list.length)}건</small><span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn sm" disabled={!list.length} onClick={() => exportReports(list).then(() => toast(`보고서 ${fmtN(list.length)}건을 엑셀로 내보냈습니다`)).catch(e => toast(e.message))}>{I.download}보고서 엑셀</button>
            {canRead('activity') ? <button className="btn sm" onClick={() => exportActivities(liveH(), from, to, R.user).then(n => toast(`활동 ${fmtN(n)}건을 엑셀로 내보냈습니다`)).catch(e => toast(e.message))}>{I.download}활동 내역 엑셀</button> : null}</span></h2>
            {list.length ? <div className="tbl-wrap"><table className="stack"><thead><tr><th>날짜</th><th>작성자</th><th>근무</th><th>방문/목표</th><th>통화</th><th>신규</th><th>단계 진전</th><th>가입</th><th>VOC</th><th>경비</th><th>상태</th></tr></thead><tbody>
                {list.map(r => {
                    const st = r.stats || repStats(r.authorId, r.date); const g = r.goal ?? S.settings.visitGoal;
                    return <tr key={r.id} className="row" onClick={() => openRep(r.id)}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fd(r.date)}</td><td className="full"><div className="u-cell"><Av u={userById(r.authorId) || { name: '?' }} cls="sm" />{userName(r.authorId)}</div></td><td data-label="근무">{r.workType}</td>
                        <td className="num" data-label="방문/목표" style={{ whiteSpace: 'nowrap' }}><b className={st.visits >= g ? 'ok-t' : ''}>{st.visits}</b> / {g}</td><td className="num" data-label="통화">{st.calls}</td><td className="num" data-label="신규">{st.newHosp}</td><td className="num" data-label="단계 진전">{st.stageUps}</td><td className="num" data-label="가입">{st.signups}</td><td className="num" data-label="VOC">{(r.voc || []).length}</td>
                        <td className="num" data-label="경비" style={{ whiteSpace: 'nowrap' }}>{expTotal(r) ? won(expTotal(r)) : '—'}</td><td className="right"><span className={`badge ${REP_ST[r.status][1]}`}>{REP_ST[r.status][0]}</span></td></tr>;
                })}</tbody></table></div> : <div className="empty">이 기간에 보고서가 없습니다</div>}</section></>;
}

/* ---------------- 지원 요청: 긴급도 조정(관리자·팀장·작성자)·내용 수정(작성자) ---------------- */
const canUrg = (r: Rep) => r.status !== 'draft' && (canReview(r) || (r.authorId === cur()?.id && canRep('update', r)));
async function setIssue(r: Rep, i: number, patch: Record<string, string>) {
    const x = r.issues[i]; if (!x) return; const before = [x.type, x.urgency, x.text].join(' · ');
    if (patch.text !== undefined && !patch.text.trim()) { toast('내용을 입력하세요'); return; }
    r.issues = r.issues.map((y, j) => (j === i ? { ...y, ...patch } : y)); const n = r.issues[i];
    logEntry({ entity: 'report', entityId: r.id, targetName: `${userName(r.authorId)} ${r.date} 일일 보고`, action: 'update', section: '지원 요청', changes: [{ field: `지원 요청 ${i + 1}`, before, after: [n.type, n.urgency, n.text].join(' · ') }] });
    save(); toast(patch.urgency ? `긴급도를 ‘${patch.urgency}’(으)로 바꿨습니다` : '지원 요청을 고쳤습니다');
}
/** 지원 요청 한 줄: 긴급도 바꾸기 버튼 + (작성자) 내용 고치기 */
export function IssueItem({ r, i, meta }: { r: Rep; i: number; meta?: React.ReactNode }) {
    const x = r.issues[i]; const can = canUrg(r); const mine = r.authorId === cur()?.id && canRep('update', r) && r.status !== 'draft';
    return <li className="iss-item"><div className="iss-urg">{can ? <div className="seg iss-seg" role="group" aria-label="긴급도">{['보통', '긴급'].map(u => <button key={u} type="button" data-act="issUrg" className={`${x.urgency === u ? 'on' : ''} ${u === '긴급' ? 'urg' : ''}`} onClick={() => x.urgency !== u && setIssue(r, i, { urgency: u })}>{u}</button>)}</div>
        : <span className={`badge ${x.urgency === '긴급' ? 'a-delete' : 'f-없음'}`}>{x.urgency}</span>}</div>
        <div style={{ minWidth: 0 }}><div><b>{x.type}</b> · {x.text}{mine ? <button className="link-btn" style={{ marginLeft: 6 }} onClick={async () => { const t = await promptBox('지원 요청 내용 고치기', x.text); if (t != null && t !== x.text) setIssue(r, i, { text: t }); }}>고치기</button> : null}</div>{meta ? <div className="h-sub">{meta}</div> : null}</div></li>;
}

/* ---------------- 보기·검토 ---------------- */
export function RepViewModal({ id }: { id: string }) {
    const r = S.reports.find(x => x.id === id); const [review, setReview] = useState(ui.rep.review || '');
    if (!r) return null;
    const st = r.stats || repStats(r.authorId, r.date); const acts = r.acts || (st as any).acts || []; const u = userById(r.authorId); const g = r.goal ?? S.settings.visitGoal;
    const list = (arr: any[] | undefined, fn: (x: any, i: number) => React.ReactNode) => arr?.length ? <ul className="plain">{arr.map(fn)}</ul> : <p className="hint">없음</p>;
    const hist = S.audit.filter(e => e.entity === 'report' && e.entityId === r.id).sort((a, b) => b.ts.localeCompare(a.ts));
    function repReview(ok: boolean) {
        if (!canReview(r)) { toast('검토 권한이 없습니다'); return; } const c = review.trim(); if (!ok && !c) { toast('반려 사유를 입력하세요'); document.getElementById('rv-comment')?.focus(); return; }
        const before = snapRep(r!); r!.status = ok ? 'confirmed' : 'returned'; r!.reviewerId = cur()!.id; r!.reviewedAt = new Date().toISOString(); r!.reviewComment = c;
        logEntry({ entity: 'report', entityId: r!.id, targetName: `${userName(r!.authorId)} ${r!.date} 일일 보고`, action: 'update', section: '보고서 검토', changes: diffSnap(before, snapRep(r!)) });
        ui.rep.review = ''; ui.modal = null; save(); toast(ok ? '확인했습니다' : '반려했습니다 · 작성자에게 사유가 표시됩니다');
    }
    return <Modal title="일일 보고서" size="wide" headExtra={r.authorId === cur()!.id && r.status !== 'confirmed' && canRep('update', r) ? <button className="btn sm" onClick={() => openReportAt(r.date)}>수정하기</button> : undefined}>
        <div className="rv-head"><Av u={u || { name: '?' }} /><div><b>{userName(r.authorId)}</b> <span className="muted">{roleOf(u)?.name || ''}</span><div className="au-meta"><span className="mono">{fd(r.date)}</span><span>{r.workType}</span>{r.region ? <span>{r.region}</span> : null}{r.mileage ? <span>{r.mileage}km</span> : null}<span className={`badge ${REP_ST[r.status][1]}`}>{REP_ST[r.status][0]}</span>{r.submittedAt ? <span>제출 {fmtTs(r.submittedAt)}</span> : null}</div></div></div>
        {r.workType === '휴가' ? <div className="empty">휴가</div> : <><StatTiles st={st} goal={g} />
            <h3 className="rv-h">방문·접촉 내역</h3><ActsTable acts={acts} editable={false} />
            <h3 className="rv-h">오늘 요약</h3><p className="rv-p">{r.highlights || '—'}</p>
            <div className="rv-2"><div><h3 className="rv-h">고객의 소리</h3>{list(r.voc, (x, i) => <li key={i}><span className="badge f-없음">{x.type}</span> {x.hospitalId ? <><b>{hName(x.hospitalId)}</b> · </> : null}{x.text}</li>)}</div>
                <div><h3 className="rv-h">경쟁사 동향</h3>{list(r.comp, (x, i) => <li key={i}><b>{x.name}</b>{x.hospitalId ? ` · ${hName(x.hospitalId)}` : ''} · {x.text}</li>)}</div>
                <div><h3 className="rv-h">지원 요청{canUrg(r) ? <small className="muted" style={{ fontWeight: 400 }}> · 긴급도를 눌러 바꿀 수 있습니다</small> : null}</h3>{r.issues?.length ? <ul className="plain iss-list">{r.issues.map((_, i) => <IssueItem key={i} r={r} i={i} />)}</ul> : <p className="hint">없음</p>}</div>
                <div><h3 className="rv-h">다음 근무일 계획 · 목표 {r.plan?.goal ?? ''}곳</h3><div className="chips">{(r.plan?.hospitalIds || []).length ? r.plan.hospitalIds.map(id => <span key={id} className="cat-chip">{hName(id)}</span>) : <span className="hint">없음</span>}</div>{r.plan?.note ? <p className="rv-p">{r.plan.note}</p> : null}</div>
                <div><h3 className="rv-h">경비 · {won(expTotal(r))}</h3>{list(r.exp, (x, i) => <li key={i}>{x.type} {won(+x.amount || 0)}{x.note ? ` · ${x.note}` : ''}</li>)}</div>
                <div><h3 className="rv-h">특이사항</h3><p className="rv-p">{r.memo || '—'}</p></div></div></>}
        {r.reviewComment ? <div className="ro-note" style={{ marginTop: 12 }}><b>{userName(r.reviewerId)}</b> 검토 의견 · {r.reviewComment}</div> : null}
        {canReview(r) && r.status === 'submitted' ? <div className="review-box"><label className="fld"><span>검토 의견</span><textarea id="rv-comment" rows={2} placeholder="확인 시 선택, 반려 시 필수" value={review} onChange={e => { setReview(e.target.value); ui.rep.review = e.target.value; }} /></label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn danger" data-act="repReturn" onClick={() => repReview(false)}>반려</button><button className="btn primary" data-act="repConfirm" onClick={() => repReview(true)}>확인</button></div></div> : null}
        {hist.length && canRead('history') ? <details style={{ marginTop: 12 }}><summary className="hint" style={{ cursor: 'pointer' }}>이 보고서의 변경 이력 {fmtN(hist.length)}건</summary><AuditList items={hist} showTarget={false} /></details> : null}
    </Modal>;
}

/* ---------------- 빠른 활동 기록 (보고서·오늘 할 일에서) ---------------- */
export function QuickActModal({ f0 }: { f0: ActDraft & { hospitalId: string } }) {
    // 빠른 기록도 '기록'을 누르기 전 내용을 이 기기에 임시 저장 (같은 병원·또는 병원을 아직 안 골랐을 때 이어서)
    const qkey = `${cur()?.id}:quick`;
    const [f, setF] = useState(() => { const d = loadDraft<typeof f0>(qkey); return d && (!f0.hospitalId || !d.hospitalId || d.hospitalId === f0.hospitalId) ? { ...f0, ...d, hospitalId: f0.hospitalId || d.hospitalId, date: f0.date } : f0; });
    useEffect(() => { saveDraft(qkey, f); }, [f, qkey]);
    const [err, setErr] = useState(''); const sf = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
    const dayIds = [...new Set(S.hospitals.filter(h => (h.activities || []).some(a => a.authorId === cur()!.id && a.date === f.date)).map(h => h.id))];
    function qaSave() {
        const h = getH(f.hospitalId); if (!h) { setErr('병원을 선택하세요.'); goTo('#qa-h'); return; } if (!need('activity', 'create', h)) return; let mv = '';
        mutateH(h, '영업 활동', x => { x.activities.push({ id: uid(), type: f.type, date: f.date, purpose: f.purpose, contact: f.contact, reaction: f.reaction, note: f.note.trim(), authorId: cur()!.id, ...actExtras(f), ...(f.geo && f.type === '방문' ? { geo: f.geo } : {}) }); mv = autoAdvance(x); }, { action: 'create' });
        clearDraft(qkey); ui.modal = null; notify(); toast(mv ? `${h.name} 기록 추가 · 단계가 ‘${mv}’(으)로 바뀌었습니다` : `${h.name} 기록을 추가했습니다`);
    }
    return <Modal title={`방문·접촉 기록 · ${fd(f.date)}`} foot={<><button className="btn" onClick={() => { ui.modal = null; notify(); }}>취소</button><button className="btn primary" data-act="qaSave" onClick={qaSave}>기록</button></>}>
        <div className="form-grid"><div className="fld span2"><span>병원 <em>*</em></span><HospitalPicker id="qa-h" value={f.hospitalId} onPick={id => sf({ hospitalId: id })} dayIds={dayIds} /></div>
            <label className="fld"><span>유형</span><select value={f.type} onChange={e => sf({ type: e.target.value })}>{ACT_TYPES.map(t => <option key={t}>{t}</option>)}</select></label><label className="fld"><span>날짜</span><DateInput value={f.date} onChange={() => { }} disabled /></label>
            <label className="fld"><span>목적</span><select value={f.purpose} onChange={e => sf({ purpose: e.target.value })}><option value="">선택</option>{ACT_PURPOSES.map(t => <option key={t}>{t}</option>)}</select></label>
            <label className="fld"><span>면담자</span><select value={f.contact} onChange={e => sf({ contact: e.target.value })}><option value="">선택</option>{ACT_CONTACTS.map(t => <option key={t}>{t}</option>)}</select></label>
            <div className="fld span2"><span>반응</span><div className="seg">{ACT_REACTIONS.map(t => <button key={t} type="button" className={f.reaction === t ? 'on' : ''} onClick={() => sf({ reaction: f.reaction === t ? '' : t })}>{t}</button>)}</div></div>
            <label className="fld span2"><span>내용</span><textarea rows={3} placeholder="주요 코멘트/피드백" value={f.note} onChange={e => sf({ note: e.target.value })} /></label>
            <div className="note-tools span2"><VoiceButton onText={t => setF(x => ({ ...x, note: appendText(x.note, t) }))} />{f.type === '방문' ? <CheckInButton h={getH(f.hospitalId)} geo={f.geo} onGeo={g => sf({ geo: g })} /> : null}</div>
            <div className="span2"><ExtrasFields a={f} set={sf} /></div>{err ? <p className="err span2">{err}</p> : null}</div>
    </Modal>;
}

/* ---------------- 분석 ---------------- */
function ReportAnal() {
    const R = ui.rep; const [from, to] = repRange(); const days = bizDays(from, to); const users = reporters().filter(u => !R.user || u.id === R.user); const goal = S.settings.visitGoal || 4;
    const reps = S.reports.filter(r => r.date >= from && r.date <= to && users.some(u => u.id === r.authorId) && ['submitted', 'confirmed'].includes(r.status) && r.workType !== '휴가');
    const st = (r: Rep): any => r.stats || repStats(r.authorId, r.date); const sum = (arr: Rep[], f: (s: any, r: Rep) => number) => arr.reduce((a, r) => a + f(st(r), r), 0);
    const leave = users.reduce((a, u) => a + days.filter(d => d < today() && isOffDay(u.id, d)).length, 0);
    const due = users.length * days.filter(d => d < today()).length - leave;
    const visits = sum(reps, s => s.visits); const react = ['긍정', '보통', '부정', '부재'].map(k => sum(reps, s => s.react?.[k] || 0)); const answered = react[0] + react[1] + react[2];
    const k: [string, any, string][] = [['보고서 제출률', due > 0 ? Math.round(reps.filter(r => r.date < today()).length / due * 100) + '%' : '—', `${fmtN(reps.length)}건 제출 · 휴가 ${leave}일 제외`], ['총 방문', fmtN(visits), `통화 ${fmtN(sum(reps, s => s.calls))} · 문자·메일 ${fmtN(sum(reps, s => s.msgs))}`],
    ['1인 일평균 방문', reps.length ? (visits / reps.length).toFixed(1) : '—', `목표 ${fmtN(goal)}곳`], ['목표 달성일', reps.length ? Math.round(reps.filter(r => st(r).visits >= (r.goal ?? goal)).length / reps.length * 100) + '%' : '—', '방문 목표를 채운 날의 비율'],
    ['신규 등록', sum(reps, s => s.newHosp), '새로 등록한 병원'], ['단계 진전', sum(reps, s => s.stageUps), `회원가입 전환 ${sum(reps, s => s.signups)}건`], ['긍정 반응률', answered ? Math.round(react[0] / answered * 100) + '%' : '—', '부재 제외 방문·통화 기준'], ['경비 합계', won(reps.reduce((a, r) => a + expTotal(r), 0)), `VOC ${reps.reduce((a, r) => a + (r.voc || []).length, 0)}건`]];
    const line: LineSpec = { type: 'line', h: 240, title: '일별 방문 수', labels: days.map(d => d.slice(5).replace('-', '/')), full: days.map(d => fd(d)), goal, unit: '곳', series: users.map(u => ({ name: u.name, color: userColor(u.id), values: days.map(d => { const r = reps.find(x => x.authorId === u.id && x.date === d); return r ? st(r).visits : null; }) })) };
    const AC: [string, string, string][] = [['방문', 'visits', 'var(--v1)'], ['통화', 'calls', 'var(--v2)'], ['문자·메일', 'msgs', 'var(--v3)']];
    const act: HbarSpec = { type: 'hbar', title: '영업사원별 활동량', unit: '건', rows: users.map(u => { const rs = reps.filter(r => r.authorId === u.id); return { label: u.name, segs: AC.map(([n, key, c]) => ({ name: n, color: c, value: sum(rs, s => s[key]) })) }; }) };
    const RC: [string, string][] = [['긍정', 'var(--ok)'], ['보통', 'var(--s1)'], ['부정', 'var(--danger)'], ['부재', 'var(--none)']];
    const rea: HbarSpec = { type: 'hbar', percent: true, title: '방문·통화 반응', unit: '건', rows: users.map(u => { const rs = reps.filter(r => r.authorId === u.id); const v = RC.map(([n]) => sum(rs, s => s.react?.[n] || 0)); const a = v[0] + v[1] + v[2]; return { label: u.name, note: a ? `긍정 ${Math.round(v[0] / a * 100)}%` : '', segs: RC.map(([n, c], i) => ({ name: n, color: c, value: v[i] })) }; }) };
    const vocAll = reps.flatMap(r => (r.voc || []).map(v => ({ ...v, date: r.date, author: r.authorId }))); const vocT = VOC_TYPES.map(t => ({ label: t, segs: [{ name: '건수', color: 'var(--v1)', value: vocAll.filter(v => v.type === t).length }] }));
    const compAll = reps.flatMap(r => (r.comp || []).map(v => ({ ...v, name: compById(v.competitorId)?.name || v.name, date: r.date, author: r.authorId })));
    const cn = [...new Set(compAll.map(c => c.name))].map(n => ({ label: n, segs: [{ name: '언급', color: 'var(--v1)', value: compAll.filter(c => c.name === n).length }] })).sort((a, b) => b.segs[0].value - a.segs[0].value).slice(0, 6);
    const issAll = reps.flatMap(r => (r.issues || []).map((v, i) => ({ ...v, i, r, date: r.date, author: r.authorId }))).sort((a, b) => (+(b.urgency === '긴급') - +(a.urgency === '긴급')) || b.date.localeCompare(a.date));
    const perf = users.map(u => { const rs = reps.filter(r => r.authorId === u.id); const v = sum(rs, s => s.visits); const avg = rs.length ? v / rs.length : 0; return { u, rs, avg, hit: rs.length ? Math.round(rs.filter(r => st(r).visits >= (r.goal ?? goal)).length / rs.length * 100) : null, nh: sum(rs, s => s.newHosp), up: sum(rs, s => s.stageUps), sg: sum(rs, s => s.signups), ev: sum(rs, s => s.evals), exp: rs.reduce((a, r) => a + expTotal(r), 0) }; });
    const vmax = Math.max(goal * 1.5, ...perf.map(p => p.avg));
    return <><RangeBar withStatus={false} />
        <div className="kpis">{k.map(([l, v, s]) => <div key={l} className="kpi"><span>{l}</span><b>{fmtN(v)}</b><small>{s}</small></div>)}</div>
        <section className="panel"><h2>일별 방문 수 <small>제출·확인된 보고서 기준 · 점선은 목표</small></h2><Legend series={line.series} /><Chart spec={line} /><TableView head={['날짜', ...users.map(u => u.name)]} rows={days.map((d, i) => [fd(d), ...line.series.map(s => s.values[i] == null ? '—' : s.values[i])])} /></section>
        <div className="dash-grid" style={{ marginTop: 16 }}>
            <section className="panel"><h2>영업사원별 활동량 <small>기간 합계</small></h2><Legend series={AC.map(([n, , c]) => ({ name: n, color: c }))} /><Chart spec={act} /><TableView head={['영업사원', ...AC.map(a => a[0])]} rows={act.rows.map(r => [r.label, ...r.segs.map(s => s.value)])} /></section>
            <section className="panel"><h2>방문·통화 반응 <small>비율</small></h2><Legend series={RC.map(([n, c]) => ({ name: n, color: c }))} /><Chart spec={rea} /><TableView head={['영업사원', ...RC.map(r => r[0])]} rows={rea.rows.map(r => [r.label, ...r.segs.map(s => s.value)])} /></section></div>
        <section className="panel" style={{ marginTop: 16 }}><h2>영업사원별 성과 <small>막대는 일평균 방문, 세로선은 목표 {fmtN(goal)}곳</small></h2><div className="tbl-wrap"><table className="perf"><thead><tr><th>영업사원</th><th>보고</th><th style={{ minWidth: 180 }}>일평균 방문</th><th>목표 달성일</th><th>신규 등록</th><th>리드 평가</th><th>단계 진전</th><th>회원가입</th><th>경비</th></tr></thead><tbody>
            {perf.map(p => <tr key={p.u.id}><td><div className="u-cell"><span className="sw-dot" style={{ background: userColor(p.u.id) }} /><b>{p.u.name}</b></div></td><td className="num">{p.rs.length}</td>
                <td><div className="ibar"><div className="ibar-track"><i style={{ width: `${p.avg / vmax * 100}%`, background: userColor(p.u.id) }} /><em style={{ left: `${goal / vmax * 100}%` }} /></div><b className="num">{fmtN(p.avg.toFixed(1))}</b></div></td>
                <td className="num">{p.hit == null ? '—' : p.hit + '%'}</td><td className="num">{p.nh}</td><td className="num">{p.ev}</td><td className="num">{p.up}</td><td className="num">{p.sg}</td><td className="num" style={{ whiteSpace: 'nowrap' }}>{won(p.exp)}</td></tr>)}</tbody></table></div></section>
        <div className="dash-grid" style={{ marginTop: 16 }}>
            <section className="panel"><h2>고객의 소리 유형 <small>{fmtN(vocAll.length)}건</small></h2><Chart spec={{ type: 'hbar', title: 'VOC 유형', rows: vocT, unit: '건', labelW: 80 }} />
                <ul className="feed">{vocAll.length ? [...vocAll].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((v, i) => <li key={i}><span className="badge f-없음">{v.type}</span><div><div>{v.text}</div><div className="h-sub">{hName(v.hospitalId) || '병원 미지정'} · {userName(v.author)} · {fd(v.date)}</div></div></li>) : <li className="hint">없음</li>}</ul></section>
            <section className="panel"><h2>경쟁사 언급 <small>{fmtN(compAll.length)}건</small></h2>{cn.length ? <Chart spec={{ type: 'hbar', title: '경쟁사 언급', rows: cn, unit: '회', labelW: 150 }} /> : <div className="empty">언급 없음</div>}
                <ul className="feed">{[...compAll].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((v, i) => <li key={i}><span className="badge f-없음">{v.name.split(' ')[0] + ' ' + (v.name.split(' ')[1] || '')}</span><div><div>{v.text}</div><div className="h-sub">{hName(v.hospitalId) || '병원 미지정'} · {userName(v.author)} · {fd(v.date)}</div></div></li>)}</ul></section></div>
        <section className="panel" style={{ marginTop: 16 }}><h2>지원 요청 <small>{fmtN(issAll.length)}건 · 긴급 먼저</small></h2>{issAll.length ? <ul className="feed iss-list">{issAll.slice(0, 20).map(v => <IssueItem key={v.r.id + ':' + v.i} r={v.r} i={v.i} meta={<>{userName(v.author)} · {fd(v.date)} · <button className="link-btn" style={{ padding: 0, fontSize: 'inherit' }} onClick={() => openRep(v.r.id)}>보고서 보기</button></>} />)}</ul> : <div className="empty">요청 없음</div>}</section>
    </>;
}
