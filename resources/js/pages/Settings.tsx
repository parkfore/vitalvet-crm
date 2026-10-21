// 설정: 지도(카카오/네이버 선택), 리드 등급·영업 목표, 영업 단계, 선택 목록
import { useState } from 'react';
import { Modal, PasswordInput, RoNote, css } from '../components/ui';
import { GeoNote } from '../components/ImportModal';
import { BackupPanel } from '../components/AdminPanels';
import { api } from '../lib/api';
import { REQ_OPTIONS, ALWAYS_REQ, reqKeys, isIncomplete } from '../lib/hinfo';
import { runGeocode } from '../lib/importer';
import { STAGE_COLORS, TRIGGERS } from '../lib/constants';
import { can, canImport, isAdmin, liveH, logEntry, mutateH, need, setStage } from '../lib/domain';
import { I } from '../lib/icons';
import { keyOf, mapReady, provider, switchProvider, type Provider } from '../lib/maps';
import { confirmBox, notify, promptBox, reloadState, S, save, syncStages, toast, ui, waitSync } from '../lib/store';
import type { Stage } from '../lib/types';
import { uid, fmtN } from '../lib/utils';

const PNAME: Record<Provider, string> = { kakao: '카카오맵', naver: '네이버 지도' };

function MapPanel({ ro }: { ro: boolean }) {
    const p = provider();
    function choose(v: Provider) {
        if (!need('settings', 'update') || v === p) return;
        logEntry({ entity: 'settings', entityId: 'map', targetName: '지도 연동', action: 'update', section: '설정', changes: [{ field: '사용할 지도', before: PNAME[p], after: PNAME[v] }] });
        S.settings.mapProvider = v; save(); switchProvider().then(() => toast(mapReady() ? `${PNAME[v]}에 연결했습니다` : `${PNAME[v]}을(를) 불러오지 못했습니다. .env 키와 등록 도메인을 확인하세요`));
    }
    const row = (v: Provider, env: string) => <li key={v}><span>{PNAME[v]}</span><small className="mono">{env}</small><b className={`badge ${keyOf(v) ? 'f-완료' : 'f-없음'}`} style={{ flex: 'none' }}>{fmtN(keyOf(v) ? '키 있음' : '키 없음')}</b></li>;
    return <section className="panel"><h2>지도 연동 <span className={`badge ${mapReady() ? 'f-완료' : 'f-오늘'}`}>{mapReady() ? `${PNAME[p]} 연결됨` : '미리보기 모드'}</span></h2>
        <div style={{ display: 'grid', gap: 12 }}>
            <div className="fld"><span>사용할 지도</span><div className="seg">{(['kakao', 'naver'] as Provider[]).map(v => <button key={v} type="button" className={p === v ? 'on' : ''} disabled={ro} onClick={() => choose(v)}>{PNAME[v]}</button>)}</div></div>
            <ul className="code-list">{row('kakao', 'KAKAO_JS_KEY')}{row('naver', 'NAVER_MAP_CLIENT_ID')}</ul>
            <p className="hint">지도 키는 보안을 위해 화면이 아니라 서버의 <span className="mono">.env</span> 파일에서 읽습니다. 키를 바꾼 뒤에는 서버에서 <span className="mono">php artisan optimize:clear</span> 를 실행하세요.</p>
            <ol className="steps-list">
                <li>카카오: developers.kakao.com › 내 애플리케이션에서 <b>카카오맵을 활성화</b>하고(앱 권한신청·제품 설정), <b>플랫폼 키 › JavaScript 키 › JavaScript SDK 도메인</b>에 이 주소(<span className="mono">{location.origin}</span>)를 등록한 뒤 JavaScript 키를 <span className="mono">KAKAO_JS_KEY</span> 에 넣습니다.</li>
                <li>네이버: 네이버 클라우드 플랫폼 › Maps › Application 에서 <b>Dynamic Map·Geocoding</b> 을 선택하고 Web 서비스 URL 에 이 주소를 등록한 뒤, Map 의 Client ID 를 <span className="mono">NAVER_MAP_CLIENT_ID</span>, Secret 을 <span className="mono">NAVER_MAP_CLIENT_SECRET</span> 에 넣습니다.</li>
                <li>병원 가져오기에서 주소로 좌표를 찾는 일은 서버가 합니다: <span className="mono">KAKAO_REST_KEY</span>(카카오 REST API 키) 또는 네이버 Client ID·Secret. 지금: <b>{S.geocoder === 'kakao' ? '카카오 로컬 API 사용' : S.geocoder === 'naver' ? '네이버 Geocoding 사용' : '없음'}</b></li>
                <li>주소 검색(우편번호)은 카카오 우편번호 서비스라 키 없이 동작하고, 카카오내비 안내는 카카오 키가 있을 때만 동작합니다.</li>
            </ol></div></section>;
}

function GoalPanel({ ro }: { ro: boolean }) {
    const [goal, setGoal] = useState(String(S.settings.visitGoal || 4)); const [rad, setRad] = useState(String(S.settings.checkinRadius || 300));
    function saveGrade() {
        if (!need('settings', 'update')) return; const g = +goal; if (!(g >= 1 && g <= 20)) { toast('일일 방문 목표는 1~20 사이로 입력하세요'); return; }
        if (g !== (S.settings.visitGoal || 4)) logEntry({ entity: 'settings', entityId: 'grade', targetName: '리드 등급·영업 목표', action: 'update', section: '설정', changes: [{ field: '일일 방문 목표', before: String(S.settings.visitGoal || 4), after: String(g) }] });
        const r = +rad; if (!(r >= 30 && r <= 5000)) { toast('체크인 허용 거리는 30~5,000m 사이로 입력하세요'); return; }
        if (r !== (S.settings.checkinRadius || 300)) logEntry({ entity: 'settings', entityId: 'grade', targetName: '리드 등급·영업 목표', action: 'update', section: '설정', changes: [{ field: '체크인 허용 거리', before: `${S.settings.checkinRadius || 300}m`, after: `${r}m` }] });
        S.settings.visitGoal = g; S.settings.checkinRadius = r; save(); toast('영업 목표를 저장했습니다');
    }
    return <section className="panel"><h2>리드 등급·영업 목표 <small>0~5점 3항목 합산</small></h2><div style={{ display: 'grid', gap: 12 }}>
        <p className="hint">디지털 수용도 · 서비스 호감도 · 월 마취 건수를 각각 0~5점으로 평가해 더합니다(최대 15점). <b>11~15점 상 · 6~10점 중 · 0~5점 하</b>. 평가는 1차 방문 이후 단계에서만 할 수 있습니다.</p>
        <div className="row-2"><label className="fld"><span>일일 방문 목표 <small>영업 보고 기준</small></span><input type="number" id="set-goal" value={goal} onChange={e => setGoal(e.target.value)} min="1" max="20" disabled={ro} /></label>
            <label className="fld"><span>방문 체크인 허용 거리 (m) <small>병원 주소에서 이 거리 안에서만 '현재 위치로 체크인'이 됩니다</small></span><input type="number" id="set-radius" value={rad} onChange={e => setRad(e.target.value)} min="30" max="5000" step="10" inputMode="numeric" disabled={ro} /></label></div>
        {ro ? null : <div><button className="btn primary" data-act="saveGrade" onClick={saveGrade}>기준 저장</button></div>}</div></section>;
}

type SEdit = Stage & { err?: string; isNew?: boolean };
function StagesPanel({ ro }: { ro: boolean }) {
    const L = S.stages; const [ed, setEd] = useState<SEdit | null>(null); const cnt = (n: string) => liveH().filter(h => h.stage === n).length;
    const main = L.filter(s => s.kind === 'main'), exit = L.filter(s => s.kind === 'exit');
    function stageSave() {
        const e = { ...ed!, name: (ed!.name || '').trim() }; if (!need('settings', 'update')) return;
        if (!e.name) { setEd({ ...e, err: '단계 이름을 입력하세요.' }); return; } if (S.stages.some(s => s.name === e.name && s.id !== e.id)) { setEd({ ...e, err: '같은 이름의 단계가 있습니다.' }); return; }
        if (e.kind === 'exit') e.trigger = '';
        if (!e.isNew) {
            const o = S.stages.find(s => s.id === e.id)!; const mainN = S.stages.filter(s => s.kind === 'main');
            if (o.kind === 'main' && e.kind === 'exit' && mainN.length < 2) { setEd({ ...e, err: '진행 단계는 최소 1개 있어야 합니다.' }); return; }
            const ch: any[] = []; if (o.name !== e.name) ch.push({ field: '이름', before: o.name, after: e.name }); if (o.kind !== e.kind) ch.push({ field: '구분', before: o.kind === 'main' ? '진행' : '이탈', after: e.kind === 'main' ? '진행' : '이탈' });
            if (o.trigger !== e.trigger) ch.push({ field: '자동 전환', before: TRIGGERS[o.trigger] || '없음', after: TRIGGERS[e.trigger] || '없음' }); if (o.color !== e.color) ch.push({ field: '색상', before: o.color, after: e.color });
            let moved = 0; if (o.name !== e.name) S.hospitals.forEach(h => { if (h.stage === o.name) { h.stage = e.name; moved++; } (h.stageHistory || []).forEach(x => { if (x.from === o.name) x.from = e.name; if (x.to === o.name) x.to = e.name; }); });
            if (e.trigger) S.stages.forEach(s => { if (s.trigger === e.trigger && s.id !== o.id) s.trigger = ''; });
            Object.assign(o, { name: e.name, kind: e.kind, trigger: e.trigger, color: e.color });
            if (ch.length) logEntry({ entity: 'settings', entityId: 'stage', targetName: `영업 단계 · ${e.name}`, action: 'update', section: '영업 단계', changes: ch, summary: moved ? `병원 ${moved}곳의 단계 이름 함께 변경` : '' });
            toast('단계를 저장했습니다');
        } else {
            if (e.trigger) S.stages.forEach(s => { if (s.trigger === e.trigger) s.trigger = ''; });
            const s: Stage = { id: 'st_' + uid(), name: e.name, kind: e.kind, trigger: e.trigger, color: e.color };
            const lastMain = S.stages.map(x => x.kind).lastIndexOf('main'); if (e.kind === 'main') S.stages.splice(lastMain + 1, 0, s); else S.stages.push(s);
            logEntry({ entity: 'settings', entityId: 'stage', targetName: `영업 단계 · ${s.name}`, action: 'create', section: '영업 단계', changes: [{ field: '이름', before: '', after: s.name }, { field: '구분', before: '', after: s.kind === 'main' ? '진행' : '이탈' }, ...(s.trigger ? [{ field: '자동 전환', before: '', after: TRIGGERS[s.trigger] }] : [])] });
            toast(`‘${s.name}’ 단계 추가 · 순서는 화살표로 조정하세요`);
        }
        setEd(null); syncStages(); save();
    }
    function stageMove(id: string, d: number) {
        if (!need('settings', 'update')) return; const s = L.find(x => x.id === id)!; const grp = L.filter(x => x.kind === s.kind); const t = grp[grp.indexOf(s) + d]; if (!t) return;
        const before = main.map(x => x.name).join(' → '); const a = L.indexOf(s), b = L.indexOf(t); [L[a], L[b]] = [L[b], L[a]]; syncStages();
        if (s.kind === 'main') logEntry({ entity: 'settings', entityId: 'stage', targetName: '영업 단계 순서', action: 'update', section: '영업 단계', changes: [{ field: '진행 순서', before, after: S.stages.filter(x => x.kind === 'main').map(x => x.name).join(' → ') }] });
        save();
    }
    const form = (s: SEdit) => <div className="cat-form" key="form"><div className="form-grid">
        <label className="fld"><span>단계 이름 <em>*</em></span><input id="se-name" autoFocus value={s.name} onChange={e => setEd({ ...s, name: e.target.value })} placeholder="예: 견적 발송" /></label>
        <div className="fld"><span>구분</span><div className="seg">{([['main', '진행 단계'], ['exit', '이탈 단계']] as const).map(([k, l]) => <button key={k} type="button" className={s.kind === k ? 'on' : ''} onClick={() => setEd({ ...s, kind: k, trigger: k === 'exit' ? '' : s.trigger })}>{l}</button>)}</div></div>
        <label className="fld"><span>자동 전환 <small>이 일이 생기면 이 단계로 올림</small></span><select value={s.trigger} disabled={s.kind === 'exit'} onChange={e => setEd({ ...s, trigger: e.target.value })}><option value="">없음 (직접 지정)</option>{Object.entries(TRIGGERS).map(([k, l]) => { const o = L.find(x => x.trigger === k && x.id !== s.id); return <option key={k} value={k}>{l}{o ? ` (지금: ${o.name})` : ''}</option>; })}</select></label><div />
        <div className="fld span2"><span>색상</span><div className="swatches">{STAGE_COLORS.map(c => <button key={c} type="button" className={`sw ${s.color === c ? 'on' : ''}`} style={css({ '--cc': c })} onClick={() => setEd({ ...s, color: c })} aria-label="색상" />)}</div></div>
        {!s.isNew ? <p className="hint span2">이름을 바꾸면 이 단계에 있는 병원 {cnt(L.find(x => x.id === s.id)!.name)}곳과 단계 이력에 함께 반영됩니다.</p> : null}{s.err ? <p className="err span2">{s.err}</p> : null}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn" onClick={() => setEd(null)}>취소</button><button className="btn primary" data-act="seSave" onClick={stageSave}>{!s.isNew ? '변경 저장' : '추가'}</button></div></div>;
    const row = (s: Stage, i: number, arr: Stage[]) => ed && ed.id === s.id ? form(ed) : <li key={s.id} className="st-row"><span className="st-ord mono">{s.kind === 'main' ? main.indexOf(s) + 1 : '—'}</span><span className="badge stage" style={css({ '--c': s.color })}>{s.name}</span>
        <span className="h-sub">{s.kind === 'main' && main[0] === s ? '등록 시 시작 단계' : s.trigger ? `자동: ${TRIGGERS[s.trigger]}` : s.kind === 'exit' ? '이탈 (진행 순서 밖)' : '직접 지정'}</span><span className="num h-sub">{cnt(s.name)}곳</span>
        {ro ? null : <span className="st-act"><button className="icon-btn" onClick={() => stageMove(s.id, -1)} disabled={i === 0} aria-label="위로">↑</button><button className="icon-btn" onClick={() => stageMove(s.id, 1)} disabled={i === arr.length - 1} aria-label="아래로">↓</button>
            <button className="icon-btn" data-act="seEdit" data-v={s.id} onClick={() => { if (need('settings', 'update')) setEd({ ...s }); }} aria-label="수정">{I.edit}</button>
            <button className="icon-btn" onClick={() => { if (need('settings', 'update')) { ui.modal = { type: 'stDel', id: s.id }; notify(); } }} aria-label="삭제">{I.trash}</button></span>}</li>;
    return <section className="panel span-all"><h2>영업 단계 <small>진행 단계는 위에서부터 순서대로 진행되며, 첫 단계가 병원 등록 시 시작 단계입니다</small></h2>
        <h3 className="rv-h" style={{ marginTop: 0 }}>진행 단계 · {fmtN(main.length)}개</h3><ul className="st-list">{main.map(row)}</ul>
        <h3 className="rv-h">이탈 단계 · {fmtN(exit.length)}개</h3><ul className="st-list">{exit.length ? exit.map(row) : <li className="hint">없음</li>}</ul>
        {ed && ed.isNew ? form(ed) : ro ? null : <button className="btn" style={{ marginTop: 12 }} onClick={() => { if (need('settings', 'update')) setEd({ id: '', name: '', kind: 'main', trigger: '', color: STAGE_COLORS[(S.stages.length + 2) % STAGE_COLORS.length], isNew: true }); }}>{I.plus}단계 추가</button>}</section>;
}

/** 단계 삭제 창: 그 단계에 있는 병원을 옮길 단계 고르기 */
export function StageDeleteModal({ id }: { id: string }) {
    const s = S.stages.find(x => x.id === id); const others = S.stages.filter(x => x.id !== id); const [tgt, setTgt] = useState(others[0]?.name || '');
    if (!s) return null; const n = S.hospitals.filter(h => h.stage === s.name).length;
    function stageDelete() {
        if (!need('settings', 'update')) return; const main = S.stages.filter(x => x.kind === 'main'); if (s!.kind === 'main' && main.length < 2) { toast('진행 단계는 최소 1개 있어야 합니다'); return; }
        const hs = S.hospitals.filter(h => h.stage === s!.name); S.stages = S.stages.filter(x => x !== s); syncStages();
        hs.forEach(h => mutateH(h, '영업 단계', x => setStage(x, tgt), { summary: `단계 ‘${s!.name}’ 삭제로 이동` }));
        logEntry({ entity: 'settings', entityId: 'stage', targetName: `영업 단계 · ${s!.name}`, action: 'delete', section: '영업 단계', changes: [{ field: '이름', before: s!.name, after: '' }, ...(hs.length ? [{ field: '병원 이동', before: `${fmtN(hs.length)}곳`, after: tgt }] : [])] });
        ui.modal = null; save(); toast(`‘${s!.name}’ 단계를 삭제했습니다`);
    }
    return <Modal title="영업 단계 삭제" size="sm" foot={<><button className="btn" onClick={() => { ui.modal = null; notify(); }}>취소</button><button className="btn danger solid" onClick={stageDelete}>삭제</button></>}>
        <p><span className="badge stage" style={css({ '--c': s.color })}>{s.name}</span> 단계를 삭제합니다.{s.trigger ? ` 자동 전환(${TRIGGERS[s.trigger]})도 함께 해제됩니다.` : ''}</p>
        {n ? <><label className="fld" style={{ marginTop: 12 }}><span>이 단계에 있는 병원 {n}곳을 옮길 단계</span><select id="sd-target" value={tgt} onChange={e => setTgt(e.target.value)}>{others.map(x => <option key={x.id} value={x.name}>{x.name}{x.kind === 'exit' ? ' (이탈)' : ''}</option>)}</select></label>
            <p className="hint">옮긴 내역은 각 병원 변경 이력에 남습니다. 지난 단계 이력의 이름은 그대로 둡니다.</p></> : <p className="hint">이 단계에 있는 병원이 없습니다.</p>}
    </Modal>;
}

function CodeBox({ k, title, usedBy, ro }: { k: 'grades' | 'specialties'; title: string; usedBy: 'grade' | 'specialty'; ro: boolean }) {
    const [nv, setNv] = useState(''); const tn = k === 'grades' ? '병원 등급 목록' : '전문과 목록';
    function add() {
        if (!need('settings', 'update')) return; const v = nv.trim(); if (!v) return; if (S.codes[k].includes(v)) { toast('이미 있는 항목입니다'); return; }
        S.codes[k].push(v); logEntry({ entity: 'settings', entityId: k, targetName: tn, action: 'create', section: '설정', changes: [{ field: '항목', before: '', after: v }] }); setNv(''); save();
    }
    async function ren(i: number) {
        if (!need('settings', 'update')) return; const old = S.codes[k][i]; const v = await promptBox('이름 변경', old); if (!v || v === old) return; if (S.codes[k].includes(v)) { toast('이미 있는 항목입니다'); return; }
        S.codes[k][i] = v; logEntry({ entity: 'settings', entityId: k, targetName: tn, action: 'update', section: '설정', changes: [{ field: '항목', before: old, after: v }] });
        S.hospitals.filter(h => h[usedBy] === old).forEach(h => mutateH(h, '기본 정보', x => { x[usedBy] = v; }, { summary: '선택 목록 이름 변경에 따른 일괄 반영' })); save();
    }
    async function del(i: number) {
        if (!need('settings', 'update')) return; const v = S.codes[k][i]; const used = S.hospitals.filter(h => h[usedBy] === v);
        if (!await confirmBox({ title: `‘${v}’ 항목을 삭제할까요?`, body: <p>{used.length ? `${fmtN(used.length)}개 병원에서 이 값이 비워지고 각 병원 이력에 기록됩니다.` : '사용 중인 병원이 없습니다.'}</p>, ok: '삭제', danger: true })) return;
        S.codes[k].splice(i, 1); logEntry({ entity: 'settings', entityId: k, targetName: tn, action: 'delete', section: '설정', changes: [{ field: '항목', before: v, after: '' }] });
        used.forEach(h => mutateH(h, '기본 정보', x => { x[usedBy] = ''; }, { summary: '선택 목록 항목 삭제에 따른 일괄 반영' })); save();
    }
    return <section className="panel"><h2>{title}</h2><ul className="code-list">{S.codes[k].map((v, i) => <li key={v}><span>{v}</span><small>{liveH().filter(h => h[usedBy] === v).length}곳</small>
        {ro ? null : <><button className="icon-btn" data-act="codeRen" data-k={k} data-i={i} onClick={() => ren(i)} aria-label="이름 변경">{I.edit}</button><button className="icon-btn" onClick={() => del(i)} aria-label="삭제">{I.trash}</button></>}</li>)}</ul>
        {ro ? null : <div className="inline-add"><input id={`add-${k}`} placeholder="새 항목" value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }} /><button className="btn" onClick={add}>추가</button></div>}</section>;
}

/** 병원 정보 연동: 필수 정보, 공공데이터 API, 파일 업로드, 좌표 다시 찾기 */
function ImportPanel({ ro }: { ro: boolean }) {
    const cfg = S.publicApi; const [url, setUrl] = useState(cfg?.url || ''); const [key, setKey] = useState(''); const [params, setParams] = useState(cfg?.params || ''); const [rows, setRows] = useState(String(cfg?.rows || 100));
    const [busy, setBusy] = useState(false); const [geo, setGeo] = useState(''); const imp = canImport();
    const H = liveH(); const inc = H.filter(isIncomplete).length; const noGeo = H.filter(h => !h.lat && h.address).length; const req = reqKeys();
    function toggleReq(k: string) {
        if (!need('settings', 'update') || ALWAYS_REQ.includes(k)) return;
        const before = req.map(x => REQ_OPTIONS.find(o => o[0] === x)?.[1]).join(', ');
        S.settings.requiredFields = req.includes(k) ? req.filter(x => x !== k) : [...req, k];
        logEntry({ entity: 'settings', entityId: 'required', targetName: '병원 필수 정보', action: 'update', section: '설정', changes: [{ field: '필수 정보', before, after: reqKeys().map(x => REQ_OPTIONS.find(o => o[0] === x)?.[1]).join(', ') }] });
        save();
    }
    async function saveApi(clearKey = false) {
        if (!need('settings', 'update')) return; setBusy(true);
        try { S.publicApi = await api('POST', '/api/import/api/config', { url: url.trim(), key: key.trim(), params: params.trim(), rows: +rows || 100, clearKey }); setKey(''); toast(clearKey ? '인증키를 지웠습니다' : 'API 설정을 저장했습니다'); notify(); }
        catch (e: any) { toast(e.message); } finally { setBusy(false); }
    }
    async function regeo() {
        setBusy(true); setGeo('좌표를 찾는 중…');
        try { const r = await runGeocode((d, l, f) => setGeo(`찾음 ${fmtN(d)}곳 · 남은 ${fmtN(l)}곳${f ? ` · 못 찾음 ${fmtN(f)}곳` : ''}`), () => false); setGeo(`완료 · 찾음 ${fmtN(r.done)}곳${r.failed ? ` · 못 찾음 ${fmtN(r.failed)}곳 (주소를 확인하세요)` : ''}`); await reloadState(true); }
        catch (e: any) { setGeo(e.message); } finally { setBusy(false); }
    }
    const open = (tab: 'file' | 'api') => { ui.modal = { type: 'import', tab }; notify(); };
    return <section className="panel span-all" id="set-import"><h2>병원 정보 연동 <small>공공데이터 API · 엑셀·CSV 업로드 · 필수 정보</small></h2>
        <div className="set-grid" style={{ gap: 18 }}>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <h3 className="rv-h" style={{ margin: 0 }}>병원 필수 정보 <small className="hint">직접 등록·수정할 때 꼭 넣어야 하는 항목 · 가져온 병원은 비어 있으면 ‘정보 미완성’</small></h3>
                <div className="req-grid">{REQ_OPTIONS.map(([k, l]) => <button key={k} type="button" className={`chip-toggle ${req.includes(k) ? 'on' : ''}`} style={css({ '--cc': 'var(--accent)' })} disabled={ro || ALWAYS_REQ.includes(k)} onClick={() => toggleReq(k)}><i />{l}{ALWAYS_REQ.includes(k) ? ' (항상)' : ''}</button>)}</div>
                <p className="hint">지금 정보 미완성 병원 <b className="num">{fmtN(inc)}</b>곳 · <button className="link-btn" style={{ display: 'inline', padding: 0, fontSize: 12 }} onClick={() => { Object.assign(ui.list, { info: 'incomplete', q: '', deleted: false }); ui.view = 'list'; notify(); }}>목록 보기</button></p>
                <h3 className="rv-h" style={{ margin: '8px 0 0' }}>지도 좌표</h3>
                <GeoNote />
                <p className="hint">주소는 있는데 좌표가 없는 병원 <b className="num">{fmtN(noGeo)}</b>곳 (지도에 안 나옵니다)</p>
                {imp && noGeo ? <div><button className="btn" disabled={busy || !S.geocoder} onClick={regeo}>{I.pin}좌표 다시 찾기</button></div> : null}
                {geo ? <p className="hint">{geo}</p> : null}
                {imp ? <><h3 className="rv-h" style={{ margin: '8px 0 0' }}>엑셀·CSV 업로드</h3><p className="hint">공공데이터포털에서 받은 ‘동물병원’ 파일이나 직접 만든 병원 목록을 올립니다. 병원명과 주소 열은 꼭 있어야 합니다.</p><div><button className="btn" onClick={() => open('file')}>{I.upload}파일 올리기</button></div></> : null}
            </div>
            <div className="api-form">
                <h3 className="rv-h" style={{ margin: 0 }}>공공데이터 API <small className="hint">{cfg?.last ? `마지막 연동 ${cfg.last.at.slice(0, 10)} · ${cfg.last.by}` : '아직 연동 안 함'}</small></h3>
                <label className="fld"><span>요청 주소 (End Point)</span><input id="api-url" value={url} onChange={e => setUrl(e.target.value)} disabled={ro} placeholder="https://apis.data.go.kr/…" spellCheck={false} /></label>
                <label className="fld"><span>인증키 (serviceKey) {cfg?.hasKey ? <small>저장됨 …{cfg.keyTail} · 바꿀 때만 입력</small> : <small>일반 인증키(Decoding) 권장</small>}</span><PasswordInput id="api-key" value={key} onChange={e => setKey(e.target.value)} disabled={ro} placeholder={cfg?.hasKey ? '새 키를 넣으면 바뀝니다' : '인증키'} autoComplete="off" /></label>
                <div className="row-2"><label className="fld"><span>추가 조건 <small>선택 · 예: type=json</small></span><input id="api-params" value={params} onChange={e => setParams(e.target.value)} disabled={ro} placeholder="type=json" spellCheck={false} /></label>
                    <label className="fld"><span>한 번에 받을 건수</span><input type="number" min="10" max="1000" value={rows} onChange={e => setRows(e.target.value)} disabled={ro} /></label></div>
                {ro ? null : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn primary" disabled={busy} onClick={() => saveApi()}>API 설정 저장</button>{cfg?.hasKey ? <button className="btn ghost" disabled={busy} onClick={() => saveApi(true)}>인증키 지우기</button> : null}</div>}
                {imp && cfg?.url && cfg.hasKey ? <div><button className="btn" onClick={() => open('api')}>{I.sync}연결 테스트 · 지금 연동</button></div> : null}
                <ol className="steps-list">
                    <li><b>data.go.kr</b>(공공데이터포털)에서 ‘동물병원’을 검색해 <b>행정안전부_동물_동물병원 조회서비스</b>를 활용신청합니다.</li>
                    <li>승인되면 마이페이지의 <b>일반 인증키(Decoding)</b>를 인증키 칸에, 상세 화면의 <b>요청주소(End Point)</b> 뒤에 오퍼레이션 이름까지 붙인 주소를 요청 주소 칸에 넣고 저장합니다.</li>
                    <li>‘연결 테스트’로 병원명·주소·영업 상태 항목을 찾았는지 확인한 뒤 ‘지금 연동’을 누릅니다. 이미 있는 병원은 영업 상태만 바뀝니다.</li>
                </ol>
            </div>
        </div></section>;
}

/** 소속 목록: 이름 바꾸기·지우기는 그 소속인 사용자에게도 반영 (서버에서) */
function TeamBox({ ro }: { ro: boolean }) {
    const [nv, setNv] = useState(''); const L = S.codes.teams || []; const used = (t: string) => S.users.filter(u => u.team === t).length;
    const done = () => { save(); waitSync().then(() => reloadState(false)); };
    function add() {
        if (!need('settings', 'update')) return; const v = nv.trim(); if (!v) return; if (L.includes(v)) { toast('이미 있는 소속입니다'); return; }
        S.codes.teams = [...L, v]; logEntry({ entity: 'settings', entityId: 'teams', targetName: '소속 목록', action: 'create', section: '설정', changes: [{ field: '소속', before: '', after: v }] }); setNv(''); done();
    }
    async function ren(i: number) {
        if (!need('settings', 'update')) return; const old = L[i]; const v = await promptBox('소속 이름 변경', old); if (!v || v === old) return; if (L.includes(v)) { toast('이미 있는 소속입니다'); return; }
        S.codes.teams = L.map((x, j) => (j === i ? v : x)); logEntry({ entity: 'settings', entityId: 'teams', targetName: '소속 목록', action: 'update', section: '설정', changes: [{ field: '소속', before: old, after: v }], summary: used(old) ? `사용자 ${used(old)}명의 소속 함께 변경` : '' }); done();
    }
    async function del(i: number) {
        if (!need('settings', 'update')) return; const v = L[i]; const n = used(v);
        if (!await confirmBox({ title: `‘${v}’ 소속을 삭제할까요?`, body: <p>{n ? `이 소속인 사용자 ${n}명의 소속이 비워집니다.` : '이 소속인 사용자가 없습니다.'} 회원가입 화면의 소속 목록에서도 빠집니다.</p>, ok: '삭제', danger: true })) return;
        S.codes.teams = L.filter((_, j) => j !== i); logEntry({ entity: 'settings', entityId: 'teams', targetName: '소속 목록', action: 'delete', section: '설정', changes: [{ field: '소속', before: v, after: '' }] }); done();
    }
    const move = (i: number, d: number) => { if (!need('settings', 'update')) return; const a = [...L]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; S.codes.teams = a; save(); };
    return <section className="panel"><h2>소속 <small>회원가입·사용자 등록에서 고르는 목록</small></h2><ul className="code-list">{L.map((v, i) => <li key={v}><span>{v}</span><small>{fmtN(used(v))}명</small>
        {ro ? null : <><button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">↑</button><button className="icon-btn" onClick={() => ren(i)} aria-label="이름 변경">{I.edit}</button><button className="icon-btn" onClick={() => del(i)} aria-label="삭제">{I.trash}</button></>}</li>)}</ul>
        {ro ? null : <div className="inline-add"><input id="add-teams" placeholder="새 소속 (예: 영업3팀)" value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }} /><button className="btn" onClick={add}>추가</button></div>}</section>;
}

const SET_TABS: [string, string, string][] = [
    ['basic', '영업 기준', '리드 등급 기준 · 일일 방문 목표 · 방문 체크인 허용 거리'],
    ['codes', '선택 목록', '병원 등급 · 전문과 · 소속'],
    ['stages', '영업 단계', '단계 순서·이름·색 · 자동 전환'],
    ['import', '병원 정보 연동', '공공데이터 API · 엑셀·CSV 업로드 · 필수 정보'],
    ['map', '지도', '카카오맵·네이버 지도 선택과 연결 상태'],
    ['backup', '백업', '매일 자동 백업 · 지금 백업 · 내려받기 (관리자)'],
];
const SET_KEY = 'vv-set-tab';

export function Settings() {
    const ro = !can('settings', 'update');
    const tabs = SET_TABS.filter(t => t[0] !== 'backup' || isAdmin());
    const [tab, setTab] = useState(() => { try { const v = localStorage.getItem(SET_KEY) || ''; return tabs.some(t => t[0] === v) ? v : 'basic'; } catch { return 'basic'; } });
    const go = (k: string) => { setTab(k); try { localStorage.setItem(SET_KEY, k); } catch { /* 저장 불가 */ } };
    const cur = tabs.find(t => t[0] === tab) || tabs[0];
    return <>
        <div className="page-head"><div><h1>설정</h1><p>위 탭에서 항목을 고르고, 탭마다 바꾼 내용을 저장합니다. 담당 영업사원·역할은 사용자·권한에서 관리합니다.</p></div></div>
        <div className="sub-tabs set-tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} data-act="setTab" data-v={k} onClick={() => go(k)}>{l}</button>)}</div>
        <p className="hint set-tab-desc">{cur[2]}</p>
        {ro ? <div style={{ marginBottom: 12 }}><RoNote f="settings" /></div> : null}
        <div className={`set-pane set-pane-${cur[0]}`}>
            {cur[0] === 'basic' ? <GoalPanel ro={ro} /> : null}
            {cur[0] === 'codes' ? <div className="set-grid set-codes"><CodeBox k="grades" title="병원 등급" usedBy="grade" ro={ro} /><CodeBox k="specialties" title="전문과" usedBy="specialty" ro={ro} /><TeamBox ro={ro} /></div> : null}
            {cur[0] === 'stages' ? <StagesPanel ro={ro} /> : null}
            {cur[0] === 'import' ? <ImportPanel ro={ro} /> : null}
            {cur[0] === 'map' ? <MapPanel ro={ro} /> : null}
            {cur[0] === 'backup' && isAdmin() ? <BackupPanel /> : null}
        </div>
    </>;
}
