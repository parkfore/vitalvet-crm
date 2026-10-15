// 병원 상세(오른쪽 서랍): 단계·카테고리, 기본 정보·리드 평가·영업 활동·전환·사용·변경 이력 탭 + 병원 등록 창
import { useEffect, useState } from 'react';
import { ACT_CONTACTS, ACT_PURPOSES, ACT_REACTIONS, ACT_TYPES, EVAL_ITEMS, EVAL_TOTAL, ISSUE_TYPES, VOC_TYPES, type Feature } from '../lib/constants';
import {
    autoAdvance, blankForm, can, canEvalStage, canRead, canSee, compById, contactInfo, cur, evalN, evalSum, extrasOf, findDup, followOf, formFromH,
    getH, gradeFromSum, hasEval, invalidSel, logEntry, mutateH, need, region, roleOf, setStage, snapH, diffSnap, userName, validateForm, type ExtrasDraft, type HForm,
} from '../lib/domain';
import { I } from '../lib/icons';
import { MAIN_N, notify, S, save, STAGES, toast, ui, confirmBox, setView } from '../lib/store';
import type { Activity, Hospital } from '../lib/types';
import { clone, fd, fmtPhone, pad4, today, uid } from '../lib/utils';
import { AuditList } from './Audit';
import { HospitalFormFields, useAddress } from './HospitalForm';
import { goTo } from '../lib/ux';
import { BizBadge, DateInput, FollowBadge, GradeBadge, InfoBadges, Locked, Modal, PreBadge, RoNote, StageBadge, css } from './ui';
import { bizOf, missingOf, ORIGIN_LABEL } from '../lib/hinfo';

export function openDetail(id: string, tab?: string) {
    if (!canRead('hospital')) { toast('병원 열람 권한이 없습니다'); return; }
    const tabs = DTABS.filter(t => canSee(t[2]));
    const keep = ui.detailId === id ? ui.tab : null; const want = tab || keep;
    ui.detailId = id; ui.tab = want && tabs.some(t => t[0] === want) ? want : tabs[0]?.[0]; notify();
}
export function closeDetail() { ui.detailId = null; notify(); }
export function openRegister() { if (!need('hospital', 'create')) return; ui.modal = { type: 'register' }; notify(); }

const DTABS: [string, string, Feature][] = [['info', '기본 정보', 'hospital'], ['eval', '리드 평가', 'eval'], ['act', '영업 활동', 'activity'], ['conv', '전환·사용', 'conv'], ['hist', '변경 이력', 'history']];

/* ---------------- 병원 등록 ---------------- */
export function RegisterModal() {
    const [f, setF] = useState<HForm>(() => ({ ...blankForm(), ownerId: cur()!.id })); const [err, setErr] = useState('');
    const set = (p: Partial<HForm>) => setF(x => ({ ...x, ...p }));
    const addr = useAddress(fn => { setF(fn); setErr(''); });
    useEffect(() => { setTimeout(() => (document.getElementById('f-name') as HTMLInputElement | null)?.focus(), 30); }, []);
    const close = () => { ui.modal = null; notify(); };
    function saveNew() {
        if (!need('hospital', 'create')) return; const e = validateForm(f); setErr(e); if (e) { goTo(invalidSel(f)); return; }
        const dup = findDup({ ...f, phone: fmtPhone(f.phone) }); if (dup && !f._dupWarned) { set({ _dupWarned: true }); return; }
        S.seq++; const id = `VV-${pad4(S.seq)}`;
        const { _dupWarned, _stage, ...data } = clone(f);
        const h: Hospital = { id, ...data, phone: fmtPhone(f.phone), directorPhone: fmtPhone(f.directorPhone), vetCount: f.vetCount === '' ? '' : +f.vetCount, stage: STAGES[0], stageHistory: [], eval: {}, activities: [], next: {}, signupDate: '', usageCount: 0, lastUsedDate: '', memo: '', createdAt: today(), createdBy: cur()!.id };
        if (roleOf(cur())!.scope === 'own') h.ownerId = cur()!.id;
        S.hospitals.push(h);
        logEntry({ entity: 'hospital', entityId: id, hospitalId: id, targetName: h.name, action: 'create', section: '병원 등록', changes: diffSnap({}, snapH(h), ['status', 'score', 'n.done']) });
        save(); ui.modal = null; toast(`${id} ${h.name} 등록됨 · ${STAGES[0]}`); openDetail(id);
    }
    return <>
        <Modal title="병원 등록" foot={<><button className="btn" onClick={close}>취소</button><button className="btn primary" data-act="saveNew" onClick={saveNew}>{f._dupWarned ? '그래도 등록' : '등록'}</button></>}>
            <HospitalFormFields f={f} set={set} mode="new" err={err} openAddr={() => addr.setOpen(true)} />
        </Modal>{addr.modal}
    </>;
}

/* ---------------- 서랍 ---------------- */
export function Drawer() {
    const h = ui.detailId ? getH(ui.detailId) : undefined;
    if (!h || !cur()) return <div id="drawerLayer" />;
    return <div id="drawerLayer"><DrawerBody key={h.id} h={h} /></div>;
}

function DrawerBody({ h }: { h: Hospital }) {
    const [enter] = useState(true);
    const si = STAGES.indexOf(h.stage); const up = can('hospital', 'update', h); const hcount = S.audit.filter(e => e.hospitalId === h.id).length;
    const tabs = DTABS.filter(t => canSee(t[2]));
    const badge: Record<string, any> = { eval: canRead('eval') && evalN(h) < 3 ? `${evalN(h)}/3` : '', act: canRead('activity') ? h.activities.length : '', hist: canRead('history') ? hcount : '' };
    const doStage = (to: string) => { if (h.stage === to || !need('hospital', 'update', h)) return; mutateH(h, '영업 단계', x => setStage(x, to)); toast(`단계: ${to}`); };
    const toggleCat = (v: string) => { if (!need('hospital', 'update', h)) return; mutateH(h, '카테고리', x => { x.categoryIds = x.categoryIds.includes(v) ? x.categoryIds.filter(y => y !== v) : [...x.categoryIds, v]; }); };
    const restore = () => { if (!need('hospital', 'delete', h)) return; mutateH(h, '병원 상태', x => { delete x.deletedAt; delete x.deletedBy; }, { action: 'restore' }); toast(`${h.name} 복원됨`); };
    const showOnMap = () => { closeDetail(); Object.assign(ui.map, { cats: new Set(), stages: new Set(STAGES), biz: new Set(['영업', '휴업', '폐업']), sido: '', sigungu: '', owner: '', info: '', grade: '', viewId: '', q: '', sel: h.id, focusId: h.id }); setView('map'); };
    const tabF = DTABS.find(t => t[0] === ui.tab)?.[2];

    return <div className="drawer-wrap" onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}><aside className={`drawer ${enter ? 'enter' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dt">
        {h.deletedAt ? <div className="del-banner"><span>{fd(h.deletedAt)} {userName(h.deletedBy) || ''}님이 삭제한 병원입니다</span>{can('hospital', 'delete', h) ? <button className="btn sm" data-act="restoreH" onClick={restore}>복원</button> : null}</div> : null}
        {bizOf(h) !== '영업' && !h.deletedAt ? <div className="closed-banner">{bizOf(h) === '폐업' ? `폐업한 병원입니다${h.closedAt ? ` · 폐업일 ${fd(h.closedAt)}` : ''}` : '휴업 중인 병원입니다'} · 지도에서는 기본으로 숨겨집니다</div> : null}
        {(() => { const m = missingOf(h); return m.length && !h.deletedAt ? <div className="miss-banner"><span><b>필수 정보 미완성</b> · {m.map(x => x[1]).join(', ')}</span>{up && canSee('hospital') ? <button className="btn sm" data-act="fillMissing" onClick={() => { ui.tab = 'info'; notify(); goTo(m[0][2]); }}>채우기</button> : null}</div> : null; })()}
        <header><div style={{ minWidth: 0 }}><div className="d-id">{h.id} · 등록 {fd(h.createdAt)} {userName(h.createdBy)} · 담당 {userName(h.ownerId) || '미지정'}</div><h2 id="dt">{h.name}</h2><div className="d-sub">{[h.grade, h.specialty, region(h)].filter(Boolean).join(' · ')} <BizBadge h={h} /> <InfoBadges h={h} origin /></div></div>
            <div style={{ display: 'flex', gap: 4 }}>{h.lat && canRead('map') && !h.deletedAt ? <button className="btn sm" onClick={showOnMap}>{I.pin}지도</button> : null}<button className="icon-btn" data-act="closeDetail" onClick={closeDetail} aria-label="닫기">{I.x}</button></div></header>
        <div className="d-meta">
            <div><div className="stepper">{STAGES.slice(0, MAIN_N).map((s, i) => <button key={s} className={`step ${i === si ? 'cur' : si < MAIN_N && i < si ? 'done' : ''}`} style={css({ '--c': S.stages.find(x => x.name === s)?.color })} disabled={!up} onClick={() => doStage(s)}>{s}</button>)}</div>
                <div className="step-side" style={{ marginTop: 8 }}><PreBadge h={h} />{canRead('eval') && canEvalStage(h) ? <GradeBadge h={h} /> : null} {canRead('activity') ? <FollowBadge h={h} /> : null} <span style={{ marginLeft: 'auto' }}>이탈 처리</span>
                    {STAGES.slice(MAIN_N).map(s => <button key={s} className={`step ${h.stage === s ? 'cur' : ''}`} style={css({ '--c': S.stages.find(x => x.name === s)?.color, flex: 'none' })} disabled={!up} onClick={() => doStage(s)}>{s}</button>)}</div></div>
            <div className="chips">{S.categories.map(c => <button key={c.id} className={`chip-toggle ${h.categoryIds.includes(c.id) ? 'on' : ''}`} style={css({ '--cc': c.color })} disabled={!up} onClick={() => toggleCat(c.id)}><i />{c.name}</button>)}{h.categoryIds.length ? null : <span className="cat-chip none">미분류</span>}</div>
        </div>
        <nav className="tabs">{tabs.map(([k, l]) => <button key={k} className={`tab ${ui.tab === k ? 'on' : ''}`} data-v={k} onClick={() => { ui.tab = k; notify(); }}>{l}{badge[k] !== '' && badge[k] != null && badge[k] !== 0 ? <span className="n">{badge[k]}</span> : null}</button>)}</nav>
        <div className="d-body">{!ui.tab ? <Locked f="hospital" /> : !tabF || !can(tabF, 'read') ? <section className="panel"><Locked f={tabF || 'hospital'} /></section>
            : ui.tab === 'info' ? <InfoTab h={h} /> : ui.tab === 'eval' ? <EvalTab h={h} /> : ui.tab === 'act' ? <ActTab h={h} /> : ui.tab === 'conv' ? <ConvTab h={h} /> : <HistTab h={h} />}</div>
    </aside></div>;
}

/* ---------------- 기본 정보 ---------------- */
function InfoTab({ h }: { h: Hospital }) {
    const ro = !can('hospital', 'update', h); const [f, setF] = useState<HForm>(() => formFromH(h)); const [err, setErr] = useState('');
    const set = (p: Partial<HForm>) => setF(x => ({ ...x, ...p }));
    const addr = useAddress(fn => { setF(fn); setErr(''); });
    // 카테고리 칩을 위에서 바꾸면 폼에도 반영
    useEffect(() => { setF(x => ({ ...x, categoryIds: clone(h.categoryIds) })); }, [h.categoryIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
    function saveInfo() {
        if (!need('hospital', 'update', h)) return; const e = validateForm(f); setErr(e); if (e) { goTo(invalidSel(f)); return; }
        mutateH(h, '기본 정보', x => {
            (['name', 'zip', 'address', 'jibun', 'addressDetail', 'sido', 'sigungu', 'lat', 'lng', 'grade', 'specialty', 'director', 'ownerId', 'compId', 'compUntil', 'pre', 'bizStatus', 'closedAt'] as const).forEach(k => { (x as any)[k] = (f as any)[k]; });
            x.sources = clone(f.sources || []); x.phone = fmtPhone(f.phone); x.directorPhone = fmtPhone(f.directorPhone); x.vetCount = f.vetCount === '' ? '' : +f.vetCount; x.categoryIds = clone(f.categoryIds);
        });
        setF(formFromH(h)); toast('기본 정보를 저장했습니다');
    }
    async function delH() {
        if (!need('hospital', 'delete', h)) return;
        const r = await confirmBox({ title: '병원을 삭제할까요?', body: <p><b>{h.name}</b> ({h.id})를 삭제 목록으로 옮깁니다. 목록·지도·통계에서 빠지지만 기록과 변경 이력은 남고, 삭제 권한이 있는 사람이 복원할 수 있습니다.</p>, ok: '삭제', danger: true, input: '삭제 사유 (이력에 남습니다)' });
        if (!r) return;
        mutateH(h, '병원 상태', x => { x.deletedAt = today(); x.deletedBy = cur()!.id; }, { action: 'delete', summary: r.v ? `사유: ${r.v}` : '' });
        ui.map.route = ui.map.route.filter(x => x !== h.id); if (ui.map.sel === h.id) ui.map.sel = null; closeDetail(); toast(`${h.name} 삭제됨 · 삭제된 병원에서 복원할 수 있습니다`);
    }
    const srcNote = h.importedFrom || h.extId ? <p className="hint" style={{ marginBottom: 10 }}>{h.importedFrom ? `${ORIGIN_LABEL[h.importedFrom]}로 등록된 병원` : ''}{h.importedFrom && h.extId ? ' · ' : ''}{h.extId ? <>인허가 관리번호 <span className="mono">{h.extId}</span></> : null}{h.bizDetail ? <> · 상세 영업 상태 <b>{h.bizDetail}</b></> : null}{h.srcUpdatedAt ? <> · 데이터 기준 <span className="mono">{h.srcUpdatedAt.slice(0, 10)}</span></> : null}</p> : null;
    return <>{ro ? <RoNote f="hospital" h={h} /> : null}<section className="panel">{srcNote}<HospitalFormFields f={f} set={set} mode="edit" ro={ro} err={err} openAddr={() => addr.setOpen(true)} /></section>
        <div className="d-foot">{can('hospital', 'delete', h) && !h.deletedAt ? <button className="btn danger" data-act="delH" onClick={delH}>{I.trash}병원 삭제</button> : <span />}
            {ro ? null : <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => { setF(formFromH(h)); setErr(''); }}>되돌리기</button><button className="btn primary" data-act="saveInfo" onClick={saveInfo}>기본 정보 저장</button></div>}</div>
        {addr.modal}</>;
}

/* ---------------- 리드 평가 (항목별 0~5점) ---------------- */
export function ScoreCard({ e }: { e: any }) {
    const sum = evalSum(e); const g = gradeFromSum(sum); const pt = (k: string) => (hasEval(e[k]) ? +e[k] : 0);
    return <><div className="score-top"><span className={`badge g-${g}`} style={{ fontSize: 15, padding: '4px 12px' }}>{sum != null ? '리드 ' : ''}{g}</span><b>{sum ?? '—'}</b><small>/ {EVAL_TOTAL}점</small></div>
        <div className="sum-bar">{EVAL_ITEMS.map(([k, l]) => <div key={k}><span>{l}</span><b>{hasEval(e[k]) ? `${pt(k)}점` : '미입력'}</b></div>)}</div>
        <p className="hint">세 항목을 각각 <b>0~5점</b>으로 평가해 더한 뒤(최대 15점) <b>11~15점 상</b> / <b>6~10점 중</b> / <b>0~5점 하</b>로 분류합니다. 세 항목 중 하나라도 비어 있으면 ‘미평가’입니다.</p></>;
}
function EvalTab({ h }: { h: Hospital }) {
    const [e, setE] = useState<any>(() => clone(h.eval || {}));
    const has = evalN(h) > 0; const ro = !(has ? can('eval', 'update', h) : can('eval', 'create', h));
    if (!canEvalStage(h) && !has) return <section className="panel ev-lock"><h2>리드 평가 <small>1차 방문 이후에 평가할 수 있습니다</small></h2>
        <p>현재 단계는 <StageBadge s={h.stage} />입니다. 병원을 직접 방문해 본 뒤 수용도·호감도·마취 규모를 판단할 수 있도록, 리드 평가는 <b>1차 방문 이후</b>에 열립니다.</p>
        <p className="hint">영업 활동 탭에서 ‘방문’을 기록하면 자동으로 1차 방문 단계가 되고 평가가 열립니다.</p>
        {can('activity', 'create', h) ? <button className="btn primary" onClick={() => { ui.tab = 'act'; notify(); }}>영업 활동 기록하러 가기</button> : null}</section>;
    function saveEval() {
        const nv: any = { adoption: hasEval(e.adoption) ? +e.adoption : '', favor: hasEval(e.favor) ? +e.favor : '', surgeries: hasEval(e.surgeries) ? +e.surgeries : '', surgeryCount: hasEval(e.surgeryCount) ? +e.surgeryCount : '', scale: 5 };
        const empty = !hasEval(nv.adoption) && !hasEval(nv.favor) && !hasEval(nv.surgeries); const op = !has ? 'create' : empty ? 'delete' : 'update';
        if (!has && empty) { toast('입력한 값이 없습니다'); return; }
        if (!empty && !canEvalStage(h)) { toast('리드 평가는 1차 방문 이후에 할 수 있습니다'); return; } if (!need('eval', op, h)) return;
        if (nv.surgeryCount !== '' && (nv.surgeryCount < 0 || !Number.isFinite(nv.surgeryCount))) { toast('실제 건수는 0 이상 숫자로 입력하세요'); return; }
        mutateH(h, '리드 평가', x => { x.eval = empty ? {} : { ...nv, date: today() }; }, { action: op }); setE(clone(h.eval));
        const s = evalSum(h.eval); toast(`평가 저장 · ${gradeFromSum(s)}${s != null ? ` (${s}/${EVAL_TOTAL}점)` : ''}`);
    }
    async function delEval() {
        if (!need('eval', 'delete', h)) return;
        if (!await confirmBox({ title: '리드 평가를 삭제할까요?', body: <p>세 항목과 종합 등급이 지워지고 ‘미평가’로 바뀝니다. 이전 값은 변경 이력에 남습니다.</p>, ok: '삭제', danger: true })) return;
        mutateH(h, '리드 평가', x => { x.eval = {}; }, { action: 'delete' }); setE({}); toast('평가를 삭제했습니다');
    }
    const seg = (k: string) => <div className="seg lv-seg">{[0, 1, 2, 3, 4, 5].map(v => <button key={v} type="button" className={String(e[k] ?? '') === String(v) ? 'on' : ''} data-act="setEval" data-v={v} data-k={k} disabled={ro} onClick={() => setE({ ...e, [k]: v })}>{v}</button>)}
        <button type="button" className={hasEval(e[k]) ? '' : 'on'} disabled={ro} onClick={() => setE({ ...e, [k]: '' })} title="값 비우기">미입력</button></div>;
    return <>{ro ? <RoNote f="eval" h={h} /> : null}<section className="panel"><h2>리드 평가 <small>{h.eval?.date ? `최근 평가 ${fd(h.eval.date)}` : '아직 평가 전'}</small></h2><div style={{ display: 'grid', gap: 18 }}>
        {EVAL_ITEMS.map(([k, l, d]) => <div key={k} className="ev-item"><span><b>{l}</b> <small>{d}</small></span>{seg(k)}
            {k === 'surgeries' ? <label className="fld" style={{ maxWidth: 240 }}><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>실제 건수 (참고, 선택)</span><input type="number" min="0" data-ev="surgeryCount" value={e.surgeryCount ?? ''} onChange={ev => setE({ ...e, surgeryCount: ev.target.value })} placeholder="예: 24" disabled={ro} /></label> : null}</div>)}
    </div></section>
        <section className="panel score-card" id="scorePreview"><ScoreCard e={e} /></section>
        <div className="d-foot">{has && can('eval', 'delete', h) ? <button className="btn danger" onClick={delEval}>평가 삭제</button> : <span className="hint" style={{ alignSelf: 'center' }}>세 항목을 모두 고르면 종합 등급이 정해집니다.</span>}
            {ro ? null : <button className="btn primary" data-act="saveEval" onClick={saveEval}>{has ? '평가 수정' : '평가 저장'}</button>}</div></>;
}

/* ---------------- 영업 활동 ---------------- */
export type ActDraft = { id?: string; type: string; date: string; purpose: string; contact: string; reaction: string; note: string } & ExtrasDraft;
export const blankAct = (date = today(), type = '방문'): ActDraft => ({ type, date, purpose: '', contact: '', reaction: '', note: '', vocType: VOC_TYPES[0], vocText: '', compId: '', compText: '', issType: ISSUE_TYPES[0], issText: '' });
export const extrasDraft = (x: Activity): ExtrasDraft => ({ vocType: x.voc?.type || VOC_TYPES[0], vocText: x.voc?.text || '', compId: x.comp?.competitorId || '', compText: x.comp?.text || '', issType: x.issue?.type || ISSUE_TYPES[0], issText: x.issue?.text || '' });
export const actExtras = (a: ExtrasDraft) => extrasOf(a, VOC_TYPES[0], ISSUE_TYPES[0]);

/** 활동 기록의 '보고서 항목' (고객의 소리·경쟁사 언급·지원 요청) */
export function ExtrasFields({ a, set }: { a: ExtrasDraft; set: (p: Partial<ExtrasDraft>) => void }) {
    const any = a.vocText || a.compId || a.compText || a.issText;
    return <details className="act-extra" open={!!any}><summary>보고서 항목 (선택) <small>여기 적으면 그날 영업 보고서에 자동으로 들어갑니다</small></summary><div className="ax-grid">
        <b>고객의 소리</b><select value={a.vocType} onChange={e => set({ vocType: e.target.value })}>{VOC_TYPES.map(t => <option key={t}>{t}</option>)}</select><input value={a.vocText} onChange={e => set({ vocText: e.target.value })} placeholder="고객이 한 말, 요청 내용" />
        <b>경쟁사 언급</b><select value={a.compId} onChange={e => set({ compId: e.target.value })}><option value="">경쟁사 선택</option>{(S.competitors || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input value={a.compText} onChange={e => set({ compText: e.target.value })} placeholder="제안 조건, 병원 반응" />
        <b>지원 요청</b><select value={a.issType} onChange={e => set({ issType: e.target.value })}>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}</select><input value={a.issText} onChange={e => set({ issText: e.target.value })} placeholder="필요한 지원과 이유" />
    </div></details>;
}
export const ExtrasChips = ({ x }: { x: Activity }) => <>{x.voc ? <span className="cat-chip">VOC · {x.voc.type}</span> : null}{x.comp ? <span className="cat-chip">경쟁사 · {compById(x.comp.competitorId)?.name || '미지정'}</span> : null}{x.issue ? <span className="cat-chip">지원 요청 · {x.issue.type}</span> : null}</>;

function ActTab({ h }: { h: Hospital }) {
    const [n, setN] = useState<any>(() => clone(h.next || {})); const [a, setA] = useState<ActDraft>(() => blankAct());
    const sa = (p: Partial<ActDraft>) => setA(x => ({ ...x, ...p }));
    const fs = followOf(h); const ci = contactInfo(h);
    const hasNext = !!(h.next?.date || h.next?.todo); const nro = !(hasNext ? can('activity', 'update', h) : can('activity', 'create', h));
    const cC = can('activity', 'create', h), cU = can('activity', 'update', h), cD = can('activity', 'delete', h);
    const sys = (h.stageHistory || []).map(x => ({ date: x.date, sys: true, type: `단계 변경 · ${x.from} → ${x.to}` }));
    const items: any[] = ([...h.activities.map(x => ({ ...x })), ...sys] as any[]).sort((p, q) => q.date.localeCompare(p.date) || (p.sys ? 1 : -1)); const editing = !!a.id;
    function saveNext() { const has = !!(h.next?.date || h.next?.todo); if (!need('activity', has ? 'update' : 'create', h)) return; mutateH(h, '영업 활동', x => { x.next = clone(n); }, { action: has ? 'update' : 'create' }); toast('다음 액션을 저장했습니다'); }
    function clearNext() { if (!need('activity', 'delete', h)) return; mutateH(h, '영업 활동', x => { x.next = {}; }, { action: 'delete' }); setN({}); toast('다음 액션을 지웠습니다'); }
    function addAct() {
        if (!need('activity', 'create', h)) return; if (!a.date) { toast('날짜를 선택하세요'); goTo('#ac-date'); return; } if (a.date > today()) { toast('미래 날짜에는 기록할 수 없습니다'); return; }
        let mv = ''; mutateH(h, '영업 활동', x => { x.activities.push({ id: uid(), type: a.type, date: a.date, purpose: a.purpose || '', contact: a.contact || '', reaction: a.reaction || '', note: a.note.trim(), authorId: cur()!.id, ...actExtras(a) }); mv = autoAdvance(x); }, { action: 'create' });
        setA({ ...blankAct(), type: a.type }); toast(mv ? `기록 추가 · 단계가 ‘${mv}’(으)로 바뀌었습니다` : '기록을 추가했습니다');
    }
    function saveAct() {
        if (!need('activity', 'update', h)) return; let mv = '';
        mutateH(h, '영업 활동', x => { const t = x.activities.find(y => y.id === a.id)!; Object.assign(t, { type: a.type, date: a.date, purpose: a.purpose || '', contact: a.contact || '', reaction: a.reaction || '', note: a.note.trim() }); delete t.voc; delete t.comp; delete t.issue; Object.assign(t, actExtras(a)); mv = autoAdvance(x); });
        setA(blankAct()); toast(mv ? `수정 · 단계가 ‘${mv}’(으)로 바뀌었습니다` : '기록을 수정했습니다');
    }
    async function delAct(id: string) {
        if (!need('activity', 'delete', h)) return;
        if (!await confirmBox({ title: '기록을 삭제할까요?', body: <p>삭제한 내용은 변경 이력에 남습니다. 영업 단계는 자동으로 내려가지 않습니다.</p>, ok: '삭제', danger: true })) return;
        mutateH(h, '영업 활동', x => { x.activities = x.activities.filter(y => y.id !== id); }, { action: 'delete' });
    }
    const editAct = (x: Activity) => { setA({ id: x.id, type: x.type, date: x.date, note: x.note || '', purpose: x.purpose || '', contact: x.contact || '', reaction: x.reaction || '', ...extrasDraft(x) }); setTimeout(() => (document.getElementById('ac-note') as HTMLTextAreaElement | null)?.focus(), 20); };
    return <>
        <div className="stats"><div><span>최초 접촉일</span><b>{fd(ci.first) || '—'}</b></div><div><span>최근 접촉일</span><b>{fd(ci.last) || '—'}</b></div><div><span>1차 방문일</span><b>{fd(ci.v1) || '—'}</b></div><div><span>2차 방문일</span><b>{fd(ci.v2) || '—'}</b></div></div>
        {!cC && !cU ? <RoNote f="activity" h={h} /> : null}
        <section className="panel"><h2>다음 액션 {fs !== '없음' ? <span className={`badge f-${fs}`}>{fs}</span> : null}</h2><div style={{ display: 'grid', gap: 10 }}>
            <div className="row-2"><label className="fld"><span>다음 액션일</span><DateInput id="nx-date" value={n.date || ''} onChange={v => setN({ ...n, date: v })} disabled={nro} /></label>
                <div className="fld"><span>처리</span><label className="check" style={{ paddingTop: 6 }}><input type="checkbox" id="nx-done" checked={!!n.done} onChange={e => setN({ ...n, done: e.target.checked })} disabled={nro} />완료함</label></div></div>
            <label className="fld"><span>팔로우업 할 사항</span><textarea id="nx-todo" rows={2} placeholder="예: 2차 방문 때 태블릿 시연" value={n.todo || ''} onChange={e => setN({ ...n, todo: e.target.value })} disabled={nro} /></label>
            {nro ? null : <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{hasNext && cD ? <button className="btn ghost" onClick={clearNext}>다음 액션 지우기</button> : null}<button className="btn primary" data-act="saveNext" onClick={saveNext}>다음 액션 저장</button></div>}</div></section>
        {cC || editing ? <section className="panel"><h2>{editing ? '활동 기록 수정' : '활동 기록 추가'} <small>작성자 {cur()!.name} · 방문을 기록하면 1차·2차 방문일이 자동으로 채워집니다</small></h2><div style={{ display: 'grid', gap: 10 }}>
            <div className="act-fields"><label className="fld"><span>유형</span><select id="ac-type" value={a.type} onChange={e => sa({ type: e.target.value })}>{ACT_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
                <label className="fld"><span>날짜</span><DateInput id="ac-date" value={a.date} max={today()} onChange={v => sa({ date: v })} /></label>
                <label className="fld"><span>목적</span><select id="ac-purpose" value={a.purpose} onChange={e => sa({ purpose: e.target.value })}><option value="">선택</option>{ACT_PURPOSES.map(t => <option key={t}>{t}</option>)}</select></label>
                <label className="fld"><span>면담자</span><select id="ac-contact" value={a.contact} onChange={e => sa({ contact: e.target.value })}><option value="">선택</option>{ACT_CONTACTS.map(t => <option key={t}>{t}</option>)}</select></label></div>
            <div className="fld"><span>반응</span><div className="seg">{ACT_REACTIONS.map(t => <button key={t} type="button" className={a.reaction === t ? 'on' : ''} data-act="acReact" data-v={t} onClick={() => sa({ reaction: a.reaction === t ? '' : t })}>{t}</button>)}</div></div>
            <textarea id="ac-note" rows={3} placeholder="주요 코멘트/피드백" value={a.note} onChange={e => sa({ note: e.target.value })} />
            <ExtrasFields a={a} set={sa} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{editing ? <><button className="btn" onClick={() => setA(blankAct())}>취소</button><button className="btn primary" onClick={saveAct}>수정 저장</button></> : <button className="btn primary" data-act="addAct" onClick={addAct}>{I.plus}기록 추가</button>}</div>
        </div></section> : null}
        <section className="panel"><h2>활동 이력 <small>{h.activities.length}건</small></h2>{items.length ? <ul className="timeline">{items.map((x, i) => <li key={x.id || 'sys' + i} className={x.sys ? 'sys' : ''}><span className="tl-date">{fd(x.date)}</span><span className="tl-dot" /><div>
            <div className="tl-type">{x.type}{x.purpose ? ` · ${x.purpose}` : ''}{x.authorId ? <> <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {userName(x.authorId) || '탈퇴 사용자'}</span></> : null}</div>
            {x.contact || x.reaction || x.voc || x.comp || x.issue ? <div className="tl-meta">{x.contact ? <span className="cat-chip">면담 {x.contact}</span> : null}{x.reaction ? <span className={`badge re-${x.reaction}`}>{x.reaction}</span> : null}<ExtrasChips x={x} /></div> : null}
            {x.note ? <div className="tl-note">{x.note}</div> : null}</div>
            {x.sys ? <span /> : <span style={{ display: 'flex' }}>{cU ? <button className="icon-btn" onClick={() => editAct(x)} aria-label="기록 수정">{I.edit}</button> : null}{cD ? <button className="icon-btn" onClick={() => delAct(x.id)} aria-label="기록 삭제">{I.trash}</button> : null}</span>}</li>)}</ul>
            : <div className="empty">아직 접촉 기록이 없습니다</div>}</section>
    </>;
}

/* ---------------- 전환·사용 ---------------- */
function ConvTab({ h }: { h: Hospital }) {
    const [c, setC] = useState<any>(() => ({ signupDate: h.signupDate, usageCount: h.usageCount, lastUsedDate: h.lastUsedDate, memo: h.memo }));
    const has = !!(h.signupDate || +h.usageCount || h.lastUsedDate || h.memo); const ro = !(has ? can('conv', 'update', h) : can('conv', 'create', h));
    function saveConv() {
        if (!need('conv', has ? 'update' : 'create', h)) return; let mv = '';
        mutateH(h, '전환·사용', x => { x.signupDate = c.signupDate || ''; x.usageCount = +c.usageCount || 0; x.lastUsedDate = c.lastUsedDate || ''; x.memo = c.memo || ''; mv = autoAdvance(x); }, { action: has ? 'update' : 'create' });
        toast(mv ? `저장 · 단계가 ‘${mv}’(으)로 바뀌었습니다` : '저장했습니다');
    }
    async function delConv() {
        if (!need('conv', 'delete', h)) return;
        if (!await confirmBox({ title: '전환·사용 정보를 삭제할까요?', body: <p>회원가입일, 사용 건수, 최근 사용일, 비고가 비워집니다. 이전 값은 변경 이력에 남습니다.</p>, ok: '삭제', danger: true })) return;
        mutateH(h, '전환·사용', x => { x.signupDate = ''; x.usageCount = 0; x.lastUsedDate = ''; x.memo = ''; }, { action: 'delete' }); setC({ signupDate: '', usageCount: 0, lastUsedDate: '', memo: '' });
    }
    return <>{ro ? <RoNote f="conv" h={h} /> : null}<section className="panel"><h2>회원가입 · 사용 <small>실서비스에서는 VitalVET 플랫폼에서 자동 연동 권장</small></h2><div className="form-grid">
        <label className="fld"><span>회원가입일</span><DateInput id="cv-sign" value={c.signupDate || ''} onChange={v => setC({ ...c, signupDate: v })} disabled={ro} /></label>
        <label className="fld"><span>VitalVET 누적 사용 건수</span><input type="number" min="0" id="cv-use" value={c.usageCount ?? 0} onChange={e => setC({ ...c, usageCount: e.target.value })} disabled={ro} /></label>
        <label className="fld"><span>최근 사용일</span><DateInput id="cv-last" value={c.lastUsedDate || ''} onChange={v => setC({ ...c, lastUsedDate: v })} disabled={ro} /></label><div />
        <label className="fld span2"><span>비고</span><textarea id="cv-memo" rows={4} value={c.memo || ''} onChange={e => setC({ ...c, memo: e.target.value })} disabled={ro} /></label></div></section>
        <div className="d-foot">{has && can('conv', 'delete', h) ? <button className="btn danger" onClick={delConv}>전환 정보 삭제</button> : <span className="hint" style={{ alignSelf: 'center' }}>가입일이나 사용 건수를 넣으면 단계가 자동으로 올라갑니다.</span>}
            {ro ? null : <button className="btn primary" onClick={saveConv}>저장</button>}</div></>;
}

/* ---------------- 변경 이력 ---------------- */
function HistTab({ h }: { h: Hospital }) {
    const [F, setF] = useState({ user: '', section: '' });
    const all = S.audit.filter(e => e.hospitalId === h.id); const users = [...new Map(all.map(e => [e.userId, e.userName])).entries()]; const secs = [...new Set(all.map(e => e.section))];
    const items = all.filter(e => (!F.user || e.userId === F.user) && (!F.section || e.section === F.section)).sort((a, b) => b.ts.localeCompare(a.ts));
    return <><div className="toolbar" style={{ margin: 0 }}>
        <select id="ht-user" value={F.user} onChange={e => setF({ ...F, user: e.target.value })} aria-label="작성자"><option value="">작성자 전체</option>{users.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select id="ht-sec" value={F.section} onChange={e => setF({ ...F, section: e.target.value })} aria-label="구분"><option value="">구분 전체</option>{secs.map(s => <option key={s}>{s}</option>)}</select><span className="hint">{items.length}건 · 최신순</span></div>
        <AuditList items={items} showTarget={false} /></>;
}
