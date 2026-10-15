// 병원 정보 가져오기 창: 엑셀·CSV 파일 업로드 / 공공데이터 API 연동
// 이미 등록된 병원은 새로 만들지 않고 영업 상태(폐업 등)만 바꾸고, 없는 병원은 주소로 좌표를 찾아 새로 등록한다.
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { can } from '../lib/domain';
import { I } from '../lib/icons';
import { preview, readFile, runApi, runFile, type Counts, type Preview, type Progress, type Sheet } from '../lib/importer';
import { notify, reloadState, S, setView, toast, ui, waitSync } from '../lib/store';
import { fmtTs } from '../lib/utils';
import { Modal } from './ui';
import { openDetail } from './HospitalDrawer';

const GEO_LABEL: Record<string, string> = { kakao: '카카오 로컬 API', naver: '네이버 Geocoding' };

export function GeoNote() {
    const g = S.geocoder;
    return g ? <p className="hint">주소 → 지도 좌표: 서버의 <b>{GEO_LABEL[g]}</b>로 찾습니다. 찾지 못하면 파일·API 에 들어 있는 좌표(중부원점 TM)를 씁니다.</p>
        : <div className="warnbox">서버 <span className="mono">.env</span> 에 <span className="mono">KAKAO_REST_KEY</span>(또는 <span className="mono">NAVER_MAP_CLIENT_ID</span>·<span className="mono">NAVER_MAP_CLIENT_SECRET</span>)가 없어 주소로 좌표를 찾지 못합니다. 지금은 파일·API 에 들어 있는 좌표만 씁니다. 키를 넣은 뒤 설정에서 ‘좌표 다시 찾기’를 누르세요.</div>;
}

function Summary({ n, running }: { n: Counts; running?: boolean }) {
    const box = (v: number, l: string, sub?: string) => <div><b>{v.toLocaleString('ko-KR')}</b><small>{l}{sub ? ` · ${sub}` : ''}</small></div>;
    return <div style={{ display: 'grid', gap: 10 }}>
        <div className="imp-sum">{box(n.created, '새로 등록')}{box(n.updated, '영업 상태 변경')}{box(n.exists, '이미 등록됨', '그대로 둠')}{n.older ? box(n.older, '더 최근 정보가 있어 반영 안 함') : null}{box(n.skippedClosed, '폐업이라 등록 안 함')}{n.invalid ? box(n.invalid, '병원명·주소 없음') : null}{n.noGeo ? box(n.noGeo, '좌표 못 찾음') : null}</div>
        {!running && n.changes.length ? <details open><summary className="hint" style={{ cursor: 'pointer' }}>영업 상태가 바뀐 병원 {n.updated}곳</summary>
            <ul className="code-list" style={{ marginTop: 6, maxHeight: 220, overflow: 'auto' }}>{n.changes.map(c => <li key={c.id}><button className="link-btn" onClick={() => { ui.modal = null; openDetail(c.id); }}>{c.name}</button><small className="mono">{c.id}</small><span className={`badge ${c.after === '폐업' ? 'a-delete' : c.after === '휴업' ? 'f-오늘' : 'f-완료'}`}>{c.before} → {c.after}</span></li>)}</ul></details> : null}
        {!running && n.errors.length ? <details><summary className="hint" style={{ cursor: 'pointer' }}>건너뛴 줄 {n.invalid}개</summary><ul className="hint" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{n.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></details> : null}
    </div>;
}

function Bar({ p }: { p: Progress }) {
    const pct = p.total ? Math.round(p.done / p.total * 100) : 0;
    return <div style={{ display: 'grid', gap: 6 }}><div className="imp-prog"><i style={{ width: `${pct}%` }} /></div><span className="hint num">{p.done.toLocaleString('ko-KR')} / {p.total.toLocaleString('ko-KR')}줄 ({pct}%){p.label ? ` · ${p.label}` : ''}</span></div>;
}

function SampleTable({ pv }: { pv: Preview }) {
    if (!pv.sample.length) return null;
    return <div className="tbl-wrap"><table className="imp-sample"><thead><tr><th>병원명</th><th>주소</th><th>상세주소</th><th>전화</th><th>영업 상태</th><th>폐업일</th><th>파일 좌표</th></tr></thead>
        <tbody>{pv.sample.map((r, i) => <tr key={i}><td>{r.name || <span className="err">없음</span>}</td><td>{r.address || <span className="err">없음</span>}</td><td>{r.addressDetail}</td><td className="mono">{r.phone}</td>
            <td>{r.bizStatus ? <span className={`badge ${r.bizStatus === '폐업' ? 'a-delete' : r.bizStatus === '휴업' ? 'f-오늘' : 'f-완료'}`}>{r.bizStatus}</span> : <span className="muted">—</span>}</td><td className="mono">{r.closedAt}</td><td>{r.geo ? '있음' : '—'}</td></tr>)}</tbody></table></div>;
}

/** 열 연결: 항목마다 파일의 어느 열을 쓸지 */
function MappingGrid({ pv, headers, onChange, ro }: { pv: Preview; headers: string[]; onChange: (f: string, h: string) => void; ro?: boolean }) {
    const hasAddr = ['road', 'jibun', 'address'].some(k => pv.mapping[k]);
    return <div className="imp-map">{pv.fields.map(([k, l]) => {
        const need = (k === 'name' && !pv.mapping.name) || (['road', 'jibun', 'address'].includes(k) && !hasAddr);
        return [<span key={k + 'l'} className={need ? 'need' : ''}>{l}{k === 'name' || k === 'road' ? ' *' : ''}</span>,
        <select key={k} value={pv.mapping[k] || ''} disabled={ro} onChange={e => onChange(k, e.target.value)}><option value="">{need ? '— 열을 고르세요 —' : '사용 안 함'}</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>];
    })}</div>;
}

export function ImportModal({ tab0 }: { tab0?: 'file' | 'api' }) {
    const [tab, setTab] = useState<'file' | 'api'>(tab0 || 'file');
    const [sheet, setSheet] = useState<Sheet | null>(null); const [pv, setPv] = useState<Preview | null>(null); const [err, setErr] = useState('');
    const [createClosed, setCreateClosed] = useState(false); const [prog, setProg] = useState<Progress | null>(null); const [done, setDone] = useState<{ n: Counts; summary: string } | null>(null);
    const [busy, setBusy] = useState(false); const [over, setOver] = useState(false); const [test, setTest] = useState<Preview | null>(null);
    const stopRef = useRef(false); const fileIn = useRef<HTMLInputElement>(null);
    const cfg = S.publicApi;
    useEffect(() => { if (ui.modal) ui.modal.busy = busy; }, [busy]);
    const close = () => { if (busy) { toast('가져오는 중입니다. 중지를 누른 뒤 닫으세요'); return; } ui.modal = null; notify(); };

    async function pick(f?: File | null) {
        if (!f) return; setErr(''); setPv(null); setSheet(null); setDone(null); setProg(null);
        try {
            const sh = await readFile(f); if (!sh.rows.length) { setErr('파일에 내용이 없습니다'); return; }
            setSheet(sh); setPv(await preview(sh.headers, sh.rows));
        } catch (e: any) { setErr(e.message || '파일을 읽지 못했습니다'); }
    }
    async function remap(f: string, h: string) {
        if (!sheet || !pv) return; const m = { ...pv.mapping, [f]: h };
        try { setPv(await preview(sheet.headers, sheet.rows, m)); } catch (e: any) { setErr(e.message); }
    }
    async function start(kind: 'file' | 'api') {
        if (busy) return; setErr(''); setDone(null); stopRef.current = false; setBusy(true);
        setProg({ done: 0, total: kind === 'file' ? sheet!.rows.length : 0, n: { created: 0, updated: 0, exists: 0, older: 0, skippedClosed: 0, invalid: 0, noGeo: 0, changes: [], errors: [] } });
        try {
            await waitSync();
            const r = kind === 'file' ? await runFile(sheet!, pv!.mapping, createClosed, setProg, () => stopRef.current) : await runApi(createClosed, setProg, () => stopRef.current);
            setDone(r); toast(stopRef.current ? '가져오기를 중지했습니다' : '가져오기를 마쳤습니다');
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); await reloadState(true); }
    }
    async function doTest() {
        setErr(''); setTest(null); setBusy(true);
        try { setTest(await api<Preview>('POST', '/api/import/api/test')); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    }
    const showIncomplete = () => { ui.modal = null; Object.assign(ui.list, { info: 'imported', q: '', deleted: false }); setView('list'); };

    const canRun = !!pv && !!pv.mapping.name && ['road', 'jibun', 'address'].some(k => pv.mapping[k]);
    const opts = <label className="check-row"><input type="checkbox" checked={createClosed} disabled={busy} onChange={e => setCreateClosed(e.target.checked)} /> <span>폐업한 병원도 새로 등록 <small className="hint">끄면 등록되지 않은 폐업 병원은 건너뛰고, 이미 등록된 병원만 ‘폐업’으로 바꿉니다</small></span></label>;
    const result = prog ? <section className="panel" style={{ display: 'grid', gap: 12 }}><h2>{busy ? '가져오는 중…' : done ? '가져오기 결과' : '진행 상황'}</h2>{busy || !done ? <Bar p={prog} /> : null}<Summary n={done?.n || prog.n} running={busy} />
        {done && !busy ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn" onClick={showIncomplete}>가져온 병원 목록 보기</button><button className="btn" onClick={() => { ui.modal = null; setView('map'); }}>{I.map}지도에서 보기</button></div> : null}</section> : null;

    const foot = busy ? <><span className="hint" style={{ marginRight: 'auto' }}>창을 닫지 말고 기다려 주세요</span><button className="btn danger" onClick={() => { stopRef.current = true; }}>중지</button></>
        : <><button className="btn" onClick={close}>닫기</button>
            {done ? null : tab === 'file' ? <button className="btn primary" disabled={!canRun} onClick={() => start('file')}>{I.upload}{sheet ? `${sheet.rows.length.toLocaleString('ko-KR')}줄 가져오기` : '가져오기'}</button>
                : <button className="btn primary" disabled={!cfg?.url || !cfg?.hasKey} onClick={() => start('api')}>{I.sync}지금 연동</button>}</>;

    return <Modal title="병원 정보 가져오기" size="wide" onClose={close} foot={foot}>
        <div style={{ display: 'grid', gap: 14 }}>
            <div className="sub-tabs"><button className={`tab ${tab === 'file' ? 'on' : ''}`} disabled={busy} onClick={() => setTab('file')}>엑셀·CSV 파일</button><button className={`tab ${tab === 'api' ? 'on' : ''}`} disabled={busy} onClick={() => setTab('api')}>공공데이터 API 연동</button></div>
            <p className="hint">이미 등록된 병원(이름+주소, 이름+전화, 인허가 관리번호가 같은 병원)은 <b>새로 등록하지 않고</b>, 파일·API 의 영업 상태가 다르면 <b>영업 상태만 바꿉니다</b>(예: 폐업). 같은 병원이 여러 줄이면 <b>데이터 갱신일이 가장 최근인 줄</b>을 따르고, 이미 더 최근 정보로 반영된 병원은 예전 정보로 되돌리지 않습니다. 등록되지 않은 병원은 <b>주소로 지도 좌표를 찾아</b> 새로 등록하고, 필수 정보가 비어 있으면 <span className="badge info-miss">정보 미완성</span>으로 표시합니다.</p>
            <GeoNote />
            {tab === 'file' ? <>
                {!prog ? <label className={`imp-drop ${over ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}>
                    {I.upload}<b>{sheet ? `${sheet.name} · ${sheet.rows.length.toLocaleString('ko-KR')}줄` : '파일을 끌어다 놓거나 눌러서 고르세요'}</b>
                    <span className="hint">엑셀(.xlsx) 또는 CSV · 공공데이터포털 ‘동물병원’ 파일을 그대로 올려도 됩니다 (EUC-KR·UTF-8 모두 가능)</span>
                    <input ref={fileIn} type="file" accept=".csv,.xlsx,.xlsm,.xls,.txt" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label> : null}
                {pv && sheet && !prog ? <section className="panel" style={{ display: 'grid', gap: 12 }}><h2>열 연결 <small>자동으로 찾은 열이 맞는지 확인하세요 · 병원명과 주소(도로명·지번 중 하나)는 꼭 있어야 합니다</small></h2>
                    <MappingGrid pv={pv} headers={sheet.headers} onChange={remap} /><h3 className="rv-h" style={{ margin: 0 }}>미리보기 (처음 5줄)</h3><SampleTable pv={pv} />{opts}</section> : null}
            </> : <>
                <section className="panel" style={{ display: 'grid', gap: 10 }}><h2>공공데이터 API <small>{cfg?.url ? '설정됨' : '아직 설정 안 됨'}</small></h2>
                    {cfg?.url ? <dl className="mc-grid"><dt>요청 주소</dt><dd className="mono" style={{ wordBreak: 'break-all' }}>{cfg.url}</dd><dt>인증키</dt><dd>{cfg.hasKey ? <>저장됨 <span className="mono">…{cfg.keyTail}</span></> : <span className="err">없음</span>}</dd>
                        {cfg.params ? <><dt>추가 조건</dt><dd className="mono">{cfg.params}</dd></> : null}<dt>마지막 연동</dt><dd>{cfg.last ? <>{fmtTs(cfg.last.at)} · {cfg.last.by}<br /><small className="hint">{cfg.last.summary}</small></> : '—'}</dd></dl>
                        : <p className="hint">설정 › 병원 정보 연동에서 공공데이터포털의 요청 주소(End Point)와 인증키를 먼저 저장하세요.</p>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{cfg?.url && cfg.hasKey ? <button className="btn" disabled={busy} onClick={doTest}>연결 테스트</button> : null}
                        {can('settings', 'view') ? <button className="btn ghost" disabled={busy} onClick={() => { ui.modal = null; setView('settings'); setTimeout(() => document.getElementById('set-import')?.scrollIntoView({ behavior: 'smooth' }), 60); }}>API 설정 열기</button> : null}</div>
                    {test ? <div style={{ display: 'grid', gap: 8 }}><p className="hint">전체 <b>{(test.total || 0).toLocaleString('ko-KR')}</b>건 · 받은 항목 {test.keys?.length || 0}개 · 병원명 {test.mapping.name ? <b>{test.mapping.name}</b> : <span className="err">못 찾음</span>} · 주소 {test.mapping.road || test.mapping.jibun || test.mapping.address ? <b>{test.mapping.road || test.mapping.jibun || test.mapping.address}</b> : <span className="err">못 찾음</span>} · 영업 상태 {test.mapping.status || test.mapping.statusCode ? <b>{test.mapping.status || test.mapping.statusCode}</b> : <span className="err">못 찾음</span>}</p><SampleTable pv={test} /></div> : null}
                    {cfg?.url && cfg.hasKey && !prog ? opts : null}</section>
            </>}
            {err ? <p className="err">{err}</p> : null}
            {result}
        </div>
    </Modal>;
}
