// 설정: 지도(카카오/네이버 선택), 리드 등급·영업 목표, 영업 단계, 선택 목록
import { useState } from 'react';
import { Modal, RoNote, css } from '../components/ui';
import { STAGE_COLORS, TRIGGERS } from '../lib/constants';
import { can, liveH, logEntry, mutateH, need, setStage } from '../lib/domain';
import { I } from '../lib/icons';
import { keyOf, mapReady, provider, switchProvider, type Provider } from '../lib/maps';
import { confirmBox, notify, promptBox, S, save, syncStages, toast, ui } from '../lib/store';
import type { Stage } from '../lib/types';
import { uid } from '../lib/utils';

const PNAME: Record<Provider, string> = { kakao: '카카오맵', naver: '네이버 지도' };

function MapPanel({ ro }: { ro: boolean }) {
    const p = provider();
    function choose(v: Provider) {
        if (!need('settings', 'update') || v === p) return;
        logEntry({ entity: 'settings', entityId: 'map', targetName: '지도 연동', action: 'update', section: '설정', changes: [{ field: '사용할 지도', before: PNAME[p], after: PNAME[v] }] });
        S.settings.mapProvider = v; save(); switchProvider().then(() => toast(mapReady() ? `${PNAME[v]}에 연결했습니다` : `${PNAME[v]}을(를) 불러오지 못했습니다. .env 키와 등록 도메인을 확인하세요`));
    }
    const row = (v: Provider, env: string) => <li key={v}><span>{PNAME[v]}</span><small className="mono">{env}</small><b className={`badge ${keyOf(v) ? 'f-완료' : 'f-없음'}`} style={{ flex: 'none' }}>{keyOf(v) ? '키 있음' : '키 없음'}</b></li>;
    return <section className="panel"><h2>지도 연동 <span className={`badge ${mapReady() ? 'f-완료' : 'f-오늘'}`}>{mapReady() ? `${PNAME[p]} 연결됨` : '미리보기 모드'}</span></h2>
        <div style={{ display: 'grid', gap: 12 }}>
            <div className="fld"><span>사용할 지도</span><div className="seg">{(['kakao', 'naver'] as Provider[]).map(v => <button key={v} type="button" className={p === v ? 'on' : ''} disabled={ro} onClick={() => choose(v)}>{PNAME[v]}</button>)}</div></div>
            <ul className="code-list">{row('kakao', 'KAKAO_JS_KEY')}{row('naver', 'NAVER_MAP_CLIENT_ID')}</ul>
            <p className="hint">지도 키는 보안을 위해 화면이 아니라 서버의 <span className="mono">.env</span> 파일에서 읽습니다. 키를 바꾼 뒤에는 서버에서 <span className="mono">php artisan optimize:clear</span> 를 실행하세요.</p>
            <ol className="steps-list">
                <li>카카오: developers.kakao.com › 내 애플리케이션 › 플랫폼 › Web 에 이 주소(<span className="mono">{location.origin}</span>)를 등록하고, JavaScript 키를 <span className="mono">KAKAO_JS_KEY</span> 에 넣습니다.</li>
                <li>네이버: 네이버 클라우드 플랫폼 › Maps › Application 에서 Web 서비스 URL 에 이 주소를 등록하고, Client ID 를 <span className="mono">NAVER_MAP_CLIENT_ID</span> 에 넣습니다. (주소 → 좌표 변환은 Geocoding 도 켜야 합니다)</li>
                <li>주소 검색(우편번호)은 카카오 우편번호 서비스라 키 없이 동작하고, 카카오내비 안내는 카카오 키가 있을 때만 동작합니다.</li>
            </ol></div></section>;
}

function GoalPanel({ ro }: { ro: boolean }) {
    const [goal, setGoal] = useState(String(S.settings.visitGoal || 4));
    function saveGrade() {
        if (!need('settings', 'update')) return; const g = +goal; if (!(g >= 1 && g <= 20)) { toast('일일 방문 목표는 1~20 사이로 입력하세요'); return; }
        if (g !== (S.settings.visitGoal || 4)) logEntry({ entity: 'settings', entityId: 'grade', targetName: '리드 등급·영업 목표', action: 'update', section: '설정', changes: [{ field: '일일 방문 목표', before: String(S.settings.visitGoal || 4), after: String(g) }] });
        S.settings.visitGoal = g; save(); toast('영업 목표를 저장했습니다');
    }
    return <section className="panel"><h2>리드 등급·영업 목표 <small>0~5점 3항목 합산</small></h2><div style={{ display: 'grid', gap: 12 }}>
        <p className="hint">디지털 수용도 · 서비스 호감도 · 월 마취 건수를 각각 0~5점으로 평가해 더합니다(최대 15점). <b>11~15점 상 · 6~10점 중 · 0~5점 하</b>. 평가는 1차 방문 이후 단계에서만 할 수 있습니다.</p>
        <div className="row-2"><label className="fld"><span>일일 방문 목표 <small>영업 보고 기준</small></span><input type="number" id="set-goal" value={goal} onChange={e => setGoal(e.target.value)} min="1" max="20" disabled={ro} /></label><div /></div>
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
        <h3 className="rv-h" style={{ marginTop: 0 }}>진행 단계 · {main.length}개</h3><ul className="st-list">{main.map(row)}</ul>
        <h3 className="rv-h">이탈 단계 · {exit.length}개</h3><ul className="st-list">{exit.length ? exit.map(row) : <li className="hint">없음</li>}</ul>
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
        logEntry({ entity: 'settings', entityId: 'stage', targetName: `영업 단계 · ${s!.name}`, action: 'delete', section: '영업 단계', changes: [{ field: '이름', before: s!.name, after: '' }, ...(hs.length ? [{ field: '병원 이동', before: `${hs.length}곳`, after: tgt }] : [])] });
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
        if (!await confirmBox({ title: `‘${v}’ 항목을 삭제할까요?`, body: <p>{used.length ? `${used.length}개 병원에서 이 값이 비워지고 각 병원 이력에 기록됩니다.` : '사용 중인 병원이 없습니다.'}</p>, ok: '삭제', danger: true })) return;
        S.codes[k].splice(i, 1); logEntry({ entity: 'settings', entityId: k, targetName: tn, action: 'delete', section: '설정', changes: [{ field: '항목', before: v, after: '' }] });
        used.forEach(h => mutateH(h, '기본 정보', x => { x[usedBy] = ''; }, { summary: '선택 목록 항목 삭제에 따른 일괄 반영' })); save();
    }
    return <section className="panel"><h2>{title}</h2><ul className="code-list">{S.codes[k].map((v, i) => <li key={v}><span>{v}</span><small>{liveH().filter(h => h[usedBy] === v).length}곳</small>
        {ro ? null : <><button className="icon-btn" data-act="codeRen" data-k={k} data-i={i} onClick={() => ren(i)} aria-label="이름 변경">{I.edit}</button><button className="icon-btn" onClick={() => del(i)} aria-label="삭제">{I.trash}</button></>}</li>)}</ul>
        {ro ? null : <div className="inline-add"><input id={`add-${k}`} placeholder="새 항목" value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }} /><button className="btn" onClick={add}>추가</button></div>}</section>;
}

export function Settings() {
    const ro = !can('settings', 'update');
    return <>
        <div className="page-head"><div><h1>설정</h1><p>지도 연동, 리드 등급 기준, 선택 목록을 관리합니다. 담당 영업사원 목록은 사용자·권한에서 관리합니다.</p></div></div>
        {ro ? <div style={{ marginBottom: 12 }}><RoNote f="settings" /></div> : null}
        <div className="set-grid"><MapPanel ro={ro} /><GoalPanel ro={ro} /><StagesPanel ro={ro} />
            <CodeBox k="grades" title="병원 등급" usedBy="grade" ro={ro} /><CodeBox k="specialties" title="전문과" usedBy="specialty" ro={ro} /></div>
    </>;
}
