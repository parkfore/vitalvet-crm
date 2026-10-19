// 지도·동선: 카테고리·단계 필터, 병원 목록, 지도(카카오/네이버/미리보기), 병원 카드, 동선과 내비 안내
import { useEffect, useRef, useState } from 'react';
import { openDetail } from '../components/HospitalDrawer';
import { BizBadge, CatChips, DistBar, FollowBadge, GradeBadge, InfoBadges, StageBadge, css } from '../components/ui';
import { api } from '../lib/api';
import { BIZ, BIZ_CLS, bizOf, infoMatch, SIDO_ORDER, sidoOf } from '../lib/hinfo';
import type { MapView as MV } from '../lib/types';
import { NAV_APPS } from '../lib/constants';
import { canRead, cur, catById, chunks, contactInfo, followOf, getH, gradeOf, inCat, kakaoMapRouteUrl, liveH, nearestOrder, sc, tmapUrl, userName } from '../lib/domain';
import { I } from '../lib/icons';
import { createMap, kakaoSdkReady, mapReady, provider, type MapAdapter } from '../lib/maps';
import { confirmBox, notify, promptBox, S, STAGES, toast, ui } from '../lib/store';
import type { Hospital } from '../lib/types';
import { distKm, fd, kmTxt, uid, fmtN } from '../lib/utils';

declare const Kakao: any;
const M = () => ui.map;
/** 단계 외 조건 (지역·영업 상태·담당·정보·리드 등급·카테고리) */
/** 검색어: 병원명·주소·지번·원장님·전화·Lead #·관리번호 (띄어쓰기 무시) */
const norm = (v: string) => v.toLowerCase().replace(/[\s\-()]/g, '');
export const qMatch = (h: Hospital, q: string) => { const k = norm(q); if (!k) return true; return norm([h.name, h.address, h.jibun, h.addressDetail, h.director, h.phone, h.directorPhone, h.id, h.extId || ''].join('|')).includes(k); };
const baseMatch = (h: Hospital, anyBiz = false) => {
    const m = M(); const me = cur()?.id;
    return qMatch(h, m.q) && (!m.cats.size || [...m.cats].some(k => inCat(h, k))) && (anyBiz || m.biz.has(bizOf(h))) && (!m.sido || sidoOf(h) === m.sido) && (!m.sigungu || h.sigungu === m.sigungu)
        && (!m.owner || h.ownerId === (m.owner === '__me' ? me : m.owner === '__none' ? '' : m.owner)) && infoMatch(h, m.info) && (!m.grade || gradeOf(h) === m.grade);
};
export const mapFiltered = () => liveH().filter(h => h.lat && baseMatch(h) && M().stages.has(h.stage));

/* ---------- 내 영업 맵 (필터 조합 저장) ---------- */
const curF = () => { const m = M(); return { cats: [...m.cats], stages: m.stages.size === STAGES.length ? [] : [...m.stages], biz: [...m.biz], sido: m.sido, sigungu: m.sigungu, owner: m.owner, info: m.info, grade: m.grade }; };
function applyView(v: MV) {
    const m = M(); const f = v.f;
    m.cats = new Set(f.cats.filter(k => k === '__none' || catById(k))); const st = f.stages.filter(x => STAGES.includes(x)); m.stages = new Set(st.length ? st : STAGES);
    m.biz = new Set(f.biz.length ? f.biz : ['영업', '휴업']); m.sido = f.sido; m.sigungu = f.sigungu; m.owner = f.owner; m.info = f.info; m.grade = f.grade; m.viewId = v.id; m.sel = null; m.fitTick = 0;
}
async function putViews(views: MV[]) { const r = await api<{ views: MV[] }>('POST', '/api/me/map-views', { views }); S.mapViews = r.views; notify(); }
async function saveView() {
    const m = M(); const sug = [m.sido, m.sigungu, m.owner === '__me' ? '내 담당' : ''].filter(Boolean).join(' ') || '내 영업 맵';
    const name = await promptBox('내 영업 맵 이름', sug); if (!name) return;
    const ex = (S.mapViews || []).find(v => v.name === name);
    const v: MV = { id: ex?.id || 'mv_' + uid(), name, f: curF() };
    try { await putViews(ex ? S.mapViews.map(x => (x.id === ex.id ? v : x)) : [...(S.mapViews || []), v]); m.viewId = v.id; toast(`‘${name}’ 저장됨 · 다음에 누르면 이 조건으로 지도가 열립니다`); } catch (e: any) { toast(e.message); }
}
async function delView(v: MV) {
    if (!await confirmBox({ title: `‘${v.name}’ 영업 맵을 지울까요?`, body: <p>저장한 필터 조합만 지워지고 병원 정보는 그대로입니다.</p>, ok: '지우기', danger: true })) return;
    try { await putViews(S.mapViews.filter(x => x.id !== v.id)); if (M().viewId === v.id) M().viewId = ''; } catch (e: any) { toast(e.message); }
}
const LIST_MAX = 300;

export function MapView() {
    const canvas = useRef<HTMLDivElement>(null); const ad = useRef<MapAdapter | null>(null); const [fitReq, setFitReq] = useState(1);
    const H = liveH(); const ev = canRead('eval'), ac = canRead('activity'); const m = M();
    const list = mapFiltered(); if (m.sel && !list.some(h => h.id === m.sel)) m.sel = null; const selH = m.sel ? getH(m.sel) : undefined;
    const ready = mapReady(); const prov = provider();
    // 지도 만들기 (지도 종류·준비 상태가 바뀌면 다시)
    useEffect(() => { ad.current = createMap(canvas.current!); setFitReq(x => x + 1); return () => { ad.current?.destroy?.(); ad.current = null; }; }, [ready, prov]);
    // 표시할 병원·동선 그리기 (화면이 바뀔 때마다)
    useEffect(() => {
        const a = ad.current; if (!a) return;
        a.setMarkers(list, { sel: m.sel, route: m.route, hit: !!m.q.trim() }, id => { m.sel = id; notify(); });
        a.drawRoute(m.route.map(getH).filter(h => h && h.lat && !h.deletedAt) as Hospital[]);
    });
    // 전체 보기 / 특정 병원으로 이동
    useEffect(() => {
        const a = ad.current; if (!a) return;
        if (m.focusId) { const h = getH(m.focusId); m.focusId = ''; if (h?.lat) { a.focus(h); return; } }
        if (m.route.length && m.fitTick) { a.fit(m.route.map(getH).filter(Boolean) as Hospital[]); m.fitTick = 0; return; }
        a.fit(list);
    }, [fitReq]); // eslint-disable-line react-hooks/exhaustive-deps

    const allRows = [{ key: '', name: '전체', color: 'var(--accent)' }, ...S.categories.map(c => ({ key: c.id, name: c.name, color: c.color })), { key: '__none', name: '미분류', color: 'var(--none)' }];
    const pool = H.filter(h => h.lat && baseMatch(h));
    const geoH = H.filter(h => h.lat); const sidos = (() => { const have = new Set(geoH.map(sidoOf).filter(Boolean)); return [...SIDO_ORDER.filter(x => have.has(x)), ...[...have].filter(x => !SIDO_ORDER.includes(x)).sort()]; })();
    const sggs = m.sido ? [...new Set(geoH.filter(h => sidoOf(h) === m.sido).map(h => h.sigungu).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')) : [];
    const setF = (k: 'sido' | 'sigungu' | 'owner' | 'info' | 'grade', v: string) => { (m as any)[k] = v; if (k === 'sido') m.sigungu = ''; m.viewId = ''; setFitReq(x => x + 1); notify(); };
    const mbiz = (b: string) => { if (m.biz.has(b)) m.biz.delete(b); else m.biz.add(b); m.viewId = ''; notify(); };
    const bizPool = H.filter(h => h.lat && baseMatch(h, true));
    const sorted = [...list].sort((a, b) => selH ? distKm(selH, a) - distKm(selH, b) : a.name.localeCompare(b.name, 'ko')); const noGeo = H.filter(h => !h.lat).length;
    const catNames = m.cats.size ? [...m.cats].map(k => k === '__none' ? '미분류' : catById(k)?.name).join(', ') : '전체 카테고리';
    const mcat = (v: string) => { if (!v) m.cats.clear(); else if (m.cats.has(v)) m.cats.delete(v); else m.cats.add(v); m.viewId = ''; setFitReq(x => x + 1); notify(); };
    const mstage = (s: string) => { if (m.stages.has(s)) m.stages.delete(s); else m.stages.add(s); m.viewId = ''; notify(); };
    const select = (id: string) => { m.sel = id; notify(); const h = getH(id); if (h) ad.current?.focus(h); };
    const routeToggle = (id: string) => { m.route = m.route.includes(id) ? m.route.filter(x => x !== id) : [...m.route, id]; notify(); };
    return <div className="map-shell"><aside className="map-side">
        <MapSearch list={list} select={select} fit={() => setFitReq(x => x + 1)} />
        <div className="ms-sec" id="msViews"><h3>내 영업 맵 <button onClick={saveView}>지금 조건 저장</button></h3>
            {(S.mapViews || []).length ? <div className="mviews">{S.mapViews.map(v => <span key={v.id} className={`mview ${m.viewId === v.id ? 'on' : ''}`}><button onClick={() => { applyView(v); setFitReq(x => x + 1); notify(); }}>{v.name}</button><button className="x" aria-label={`${v.name} 지우기`} onClick={() => delView(v)}>×</button></span>)}</div>
                : <p className="hint">지역·담당·단계를 골라 ‘지금 조건 저장’을 누르면 나만의 영업 맵으로 저장됩니다.</p>}</div>
        <div className="ms-sec" id="msFilters"><h3>조건 {m.sido || m.owner || m.info || m.grade ? <button onClick={() => { m.sido = ''; m.sigungu = ''; m.owner = ''; m.info = ''; m.grade = ''; m.viewId = ''; setFitReq(x => x + 1); notify(); }}>초기화</button> : null}</h3>
            <div className="mf-grid">
                <select id="mf-sido" value={m.sido} onChange={e => setF('sido', e.target.value)} aria-label="시·도"><option value="">시·도 전체</option>{sidos.map(x => <option key={x}>{x}</option>)}</select>
                <select id="mf-sgg" value={m.sigungu} onChange={e => setF('sigungu', e.target.value)} aria-label="시·군·구" disabled={!m.sido}><option value="">시·군·구 전체</option>{sggs.map(x => <option key={x}>{x}</option>)}</select>
                <select id="mf-owner" value={m.owner} onChange={e => setF('owner', e.target.value)} aria-label="담당"><option value="">담당 전체</option><option value="__me">내 담당</option><option value="__none">담당 미지정</option>{S.users.filter(u => u.status === 'active').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                <select id="mf-info" value={m.info} onChange={e => setF('info', e.target.value)} aria-label="정보"><option value="">정보 전체</option><option value="incomplete">정보 미완성</option><option value="complete">필수 정보 완성</option><option value="imported">가져온 병원</option></select>
                {ev ? <select id="mf-grade" value={m.grade} onChange={e => setF('grade', e.target.value)} aria-label="리드 등급"><option value="">리드 등급 전체</option>{['상', '중', '하', '미평가'].map(g => <option key={g}>{g}</option>)}</select> : null}
            </div>
            <div className="stage-filters" style={{ paddingTop: 0 }}>{BIZ.map(b => <button key={b} className={`sf ${m.biz.has(b) ? 'on' : ''}`} style={css({ '--c': b === '영업' ? 'var(--ok)' : b === '휴업' ? 'var(--warn)' : 'var(--danger)' })} onClick={() => mbiz(b)}><i />{b} <span className="num">{bizPool.filter(h => bizOf(h) === b).length}</span></button>)}</div></div>
        <div className="ms-sec cats" id="msCats"><h3>카테고리 {m.cats.size ? <button onClick={() => mcat('')}>선택 해제</button> : null}</h3><div className="mcat">{allRows.map(r => {
            const l = r.key ? H.filter(h => inCat(h, r.key)) : H; const on = r.key ? m.cats.has(r.key) : !m.cats.size;
            return <button key={r.key || 'all'} className={`mcat-btn ${on ? 'on' : ''}`} style={css({ '--cc': r.color })} onClick={() => mcat(r.key)}><span className="box">{I.check}</span><span className="nm">{r.name}</span><span className="ct">{l.length}</span><DistBar list={l} /></button>;
        })}</div></div>
        <div className="ms-sec stages" id="msStages"><h3>영업 단계 <button onClick={() => { m.stages = m.stages.size === STAGES.length ? new Set() : new Set(STAGES); notify(); }}>{m.stages.size === STAGES.length ? '모두 끄기' : '모두 켜기'}</button></h3>
            <div className="stage-filters">{STAGES.map(s => <button key={s} className={`sf ${m.stages.has(s) ? 'on' : ''}`} style={css({ '--c': sc(s) })} onClick={() => mstage(s)}><i />{s} <span className="num">{pool.filter(h => h.stage === s).length}</span></button>)}</div></div>
        <div className="ms-sec listsec" style={{ borderBottom: 0 }} id="msList"><h3><span>병원 {fmtN(list.length)}곳 {selH ? '· 선택 병원에서 가까운 순' : ''}</span></h3>{noGeo ? <p className="hint" style={{ padding: '0 16px 8px' }}>좌표가 없는 병원 {noGeo}곳은 지도에 나오지 않습니다</p> : null}
            <ul className="mlist">{sorted.length ? sorted.slice(0, LIST_MAX).map(h => {
                const ri = m.route.indexOf(h.id); const fo = followOf(h);
                return <li key={h.id} className={m.sel === h.id ? 'sel' : ''} onClick={e => { if (!(e.target as Element).closest('.route-btn')) select(h.id); }}><div style={{ minWidth: 0 }}><div className="nm"><span className="dot" style={css({ '--c': sc(h.stage) })} /><span>{h.name}</span>{bizOf(h) !== '영업' ? <span className={`badge ${BIZ_CLS[bizOf(h)]}`} style={{ padding: '0 6px' }}>{bizOf(h)}</span> : null}</div>
                    <div className="sub">{h.stage}{ev ? ` · ${gradeOf(h)}` : ''}{ac && (fo === '지연' || fo === '오늘') ? <> · <span className={`badge f-${fo}`} style={{ padding: '0 6px' }}>{fo}</span></> : null}{selH && selH !== h ? ` · ${kmTxt(distKm(selH, h))}` : ''}</div></div>
                    <button className={`route-btn ${ri >= 0 ? 'on' : ''}`} onClick={e => { e.stopPropagation(); routeToggle(h.id); }} aria-label={ri >= 0 ? '동선에서 빼기' : '동선에 추가'} title={ri >= 0 ? '동선에서 빼기' : '동선에 추가'}>{ri >= 0 ? ri + 1 : I.plus}</button></li>;
            }) : <li style={{ cursor: 'default' }}><span className="muted">조건에 맞는 병원이 없습니다</span></li>}
                {sorted.length > LIST_MAX ? <li style={{ cursor: 'default' }}><span className="hint">목록에는 {LIST_MAX}곳까지만 보입니다 · 지역을 고르거나 지도를 확대하세요</span></li> : null}</ul></div>
    </aside>
        <div className="map-area" id="mapArea"><div className={`map-canvas ${m.labels ? '' : 'hide-labels'} ${m.blink ? '' : 'no-blink'}`} id="mapCanvas" ref={canvas} />
            <div className="map-top"><div className="map-pill" id="mapPill"><b>{catNames}</b><span className="muted">조건에 맞는 병원 {fmtN(list.length)}곳</span><span id="mapView" className="muted" /></div>
                <div className="map-tools"><button className="btn sm" onClick={() => ad.current?.fit(mapFiltered())}>전체 보기</button><button className="btn sm" onClick={() => { m.labels = !m.labels; notify(); }}>{m.labels ? '이름 숨기기' : '이름 표시'}</button><button className="btn sm" onClick={() => { m.blink = !m.blink; notify(); }}>{m.blink ? '깜빡임 끄기' : '깜빡임 켜기'}</button></div></div>
        </div>
        <div id="mapCardHost" className="mhost">{selH ? <MapCard h={selH} routeToggle={routeToggle} /> : null}</div>
        <div id="routeHost" className="mhost"><RoutePanel routeToggle={routeToggle} select={select} /></div>
    </div>;
}

/** 지도 검색: 입력하면 지도·목록이 바로 걸러지고, 결과를 누르면 그 병원으로 이동 */
function MapSearch({ list, select, fit }: { list: Hospital[]; select: (id: string) => void; fit: () => void }) {
    const m = M(); const [open, setOpen] = useState(false); const [ai, setAi] = useState(0);
    const q = m.q.trim(); const hits = q ? list.slice(0, 8) : [];
    // 지도에 없는(좌표 없음·다른 조건) 병원도 찾아서 알려 준다
    const hidden = q ? liveH().filter(h => qMatch(h, q) && !list.includes(h)).length : 0;
    const go = (h?: Hospital) => { if (!h) return; setOpen(false); select(h.id); };
    const onKey = (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setAi(i => Math.min(i + 1, hits.length - 1)); setOpen(true); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAi(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (hits.length === 1 || (open && hits[ai])) go(hits[ai] || hits[0]); else { setOpen(false); fit(); } }
        else if (e.key === 'Escape') setOpen(false);
    };
    return <div className="ms-sec" id="msSearch"><h3>병원 찾기 {q ? <span className="muted" style={{ fontWeight: 500 }}>{fmtN(list.length)}곳</span> : null}</h3>
        <div className="map-search"><input id="mf-q" type="text" value={m.q} placeholder="병원명·주소·원장님·전화·Lead #" autoComplete="off"
            onChange={e => { m.q = e.target.value; m.viewId = ''; m.sel = null; setAi(0); setOpen(true); notify(); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey} />
            {m.q ? <button className="x" aria-label="검색어 지우기" onClick={() => { m.q = ''; setOpen(false); fit(); notify(); }}>×</button> : null}</div>
        {open && hits.length ? <ul className="map-search-hits">{hits.map((h, i) => <li key={h.id} className={i === ai ? 'on' : ''} onMouseDown={e => { e.preventDefault(); go(h); }}><b>{h.name}</b><small>{h.address}{h.director ? ` · ${h.director} 원장` : ''}</small></li>)}</ul> : null}
        {q && !list.length ? <p className="hint" style={{ marginTop: 6 }}>지도에 나오는 병원 중에는 없습니다{hidden ? ` · 다른 조건(지역·단계·영업 상태 등)이나 좌표 없음으로 숨겨진 병원 ${fmtN(hidden)}곳` : ''}</p>
            : q && hidden ? <p className="hint" style={{ marginTop: 6 }}>조건·좌표 때문에 지도에 안 나오는 병원 {hidden}곳이 더 있습니다</p> : null}
        {q ? <p className="hint" style={{ marginTop: 6 }}>Enter: {list.length === 1 ? '그 병원으로 이동' : '찾은 병원 전체 보기'} · ↑↓로 고르기</p> : null}
    </div>;
}

function MapCard({ h, routeToggle }: { h: Hospital; routeToggle: (id: string) => void }) {
    const ci = contactInfo(h); const ri = M().route.indexOf(h.id); const ac = canRead('activity'), cv = canRead('conv');
    return <div className="map-card"><div className="mc-head"><div style={{ minWidth: 0 }}><div className="d-id">{h.id} · 담당 {userName(h.ownerId) || '미지정'}</div><h3>{h.name}</h3></div><button className="icon-btn" onClick={() => { M().sel = null; notify(); }} aria-label="닫기">{I.x}</button></div>
        <div className="chips"><StageBadge s={h.stage} />{canRead('eval') ? <GradeBadge h={h} /> : null}{ac ? <FollowBadge h={h} /> : null}<BizBadge h={h} /><InfoBadges h={h} /></div>
        <dl className="mc-grid"><dt>주소</dt><dd>{h.address}{h.addressDetail ? `, ${h.addressDetail}` : ''}</dd>
            <dt>원장님</dt><dd>{h.director || '—'} {h.directorPhone ? <a className="mono" href={`tel:${h.directorPhone}`} style={{ color: 'var(--accent)' }}>{h.directorPhone}</a> : null}</dd>
            <dt>대표 전화</dt><dd className="mono">{h.phone || '—'}</dd><dt>등급·전문과</dt><dd>{[h.grade, h.specialty].filter(Boolean).join(' · ') || '—'}</dd>
            {ac ? <><dt>다음 액션</dt><dd>{h.next?.date ? <><span className="mono">{fd(h.next.date)}</span> {h.next.todo || ''}</> : '—'}</dd><dt>최근 접촉</dt><dd className="mono">{fd(ci.last) || '—'}</dd></> : null}
            {cv && h.usageCount > 0 ? <><dt>사용</dt><dd>누적 <b className="num">{fmtN(h.usageCount)}</b>건 · 최근 <span className="mono">{fd(h.lastUsedDate) || '—'}</span></dd></> : null}
            <dt>카테고리</dt><dd><div className="chips"><CatChips h={h} /></div></dd></dl>
        <div className="mc-actions"><button className="btn primary sm" onClick={() => openDetail(h.id)}>상세 보기</button><button className="btn sm" onClick={() => routeToggle(h.id)}>{I.route}{ri >= 0 ? '동선에서 빼기' : '동선에 추가'}</button>
            <a className="btn sm" href={`https://map.kakao.com/link/to/${encodeURIComponent(h.name)},${h.lat},${h.lng}`} target="_blank" rel="noopener">카카오맵 길찾기</a></div></div>;
}

const navAppGet = () => { try { return localStorage.getItem('vv-nav-app') || 'kakaomap'; } catch { return 'kakaomap'; } };
function RoutePanel({ routeToggle, select }: { routeToggle: (id: string) => void; select: (id: string) => void }) {
    const m = M(); const R = m.route.map(getH).filter(h => h && !h.deletedAt) as Hospital[]; const [app, setApp] = useState(navAppGet());
    if (!R.length) return null;
    let tot = 0; R.forEach((h, i) => { if (i) tot += distKm(R[i - 1], h); });
    const A = NAV_APPS[app];
    const groups = app === 'kakaomap' || (app === 'kakaonavi' && !kakaoSdkReady) ? chunks(R, 7, true) : app === 'kakaonavi' ? chunks(R, 4, false) : chunks(R, 1, false);
    const label = (g: Hospital[]) => { const a = R.indexOf(g[0]) + 1, b = R.indexOf(g.at(-1)!) + 1; return a === b ? `${a}번 ${g[0].name}` : `${a}~${b}번`; };
    function naviStart(i: number) {
        const g = chunks(R, 4, false)[i]; if (!g) return; const dest = g.at(-1)!;
        if (!(kakaoSdkReady && (window as any).Kakao?.Navi)) { toast('카카오 SDK가 연결되지 않았습니다'); return; }
        try { Kakao.Navi.start({ name: dest.name, x: dest.lng, y: dest.lat, coordType: 'wgs84', viaPoints: g.slice(0, -1).map(h => ({ name: h.name, x: h.lng, y: h.lat })) }); } catch { toast('카카오내비를 열지 못했습니다. 휴대폰에서 다시 시도하세요'); }
    }
    const btn = (g: Hospital[], i: number) => app === 'kakaomap' ? <a key={i} className={`btn sm ${i === 0 ? 'primary' : ''}`} href={kakaoMapRouteUrl(g)} target="_blank" rel="noopener">{g.length === R.length ? '전체 동선' : label(g)} 카카오맵 길찾기</a>
        : app === 'kakaonavi' ? (kakaoSdkReady ? <button key={i} className={`btn sm ${i === 0 ? 'primary' : ''}`} onClick={() => naviStart(i)}>{label(g)} 카카오내비 안내</button> : <a key={i} className={`btn sm ${i === 0 ? 'primary' : ''}`} href={kakaoMapRouteUrl(g)} target="_blank" rel="noopener">{label(g)} 카카오맵으로 열기</a>)
            : <a key={i} className={`btn sm ${i === (m.navStep || 0) ? 'primary' : ''}`} href={tmapUrl(g[0])} onClick={() => { m.navStep = i + 1; setTimeout(notify, 300); }}>{label(g)} 티맵 안내</a>;
    return <div className="route-panel"><h3>오늘 동선 <span className="muted mono" style={{ fontSize: 12, fontWeight: 500 }}>{fmtN(R.length)}곳 · 직선 {kmTxt(tot)}</span></h3>
        <ol>{R.map((h, i) => <li key={h.id}><span className="n">{i + 1}</span><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => select(h.id)}>{h.name}</span>
            <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => routeToggle(h.id)} aria-label="빼기">{I.x}</button>
            {i < R.length - 1 ? <span className="leg">↓ {kmTxt(distKm(h, R[i + 1]))} · <a href={`https://map.kakao.com/link/from/${encodeURIComponent(h.name)},${h.lat},${h.lng}/to/${encodeURIComponent(R[i + 1].name)},${R[i + 1].lat},${R[i + 1].lng}`} target="_blank" rel="noopener">길찾기</a></span> : null}</li>)}</ol>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn sm" disabled={R.length < 3} onClick={() => { if (m.route.length > 2) { m.route = nearestOrder(m.route); notify(); toast('가까운 순으로 정렬했습니다'); } }}>가까운 순으로 정렬</button><button className="btn sm ghost" onClick={() => { m.route = []; notify(); }}>비우기</button></div>
        <p className="hint" style={{ margin: 0 }}>1번 병원에서 출발해 가장 가까운 병원을 차례로 잇습니다. 거리는 직선 기준입니다.</p>
        <h3 style={{ marginTop: 4 }}>내비로 안내</h3>
        <div className="nav-box"><div className="seg nav-seg">{Object.entries(NAV_APPS).map(([k, v]) => <button key={k} type="button" className={app === k ? 'on' : ''} onClick={() => { try { localStorage.setItem('vv-nav-app', k); } catch { /* 저장 불가 */ } setApp(k); m.navStep = 0; }}>{v.name}</button>)}</div>
            <div className="nav-btns">{groups.map(btn)}</div>
            <p className="hint" style={{ margin: 0 }}>{A.note}{R.length > A.max && app !== 'tmap' ? ` 동선이 ${R.length}곳이라 ${groups.length}번에 나눠 안내합니다.` : ''}{app === 'kakaonavi' && !kakaoSdkReady ? <> <b>지금은 카카오 SDK가 연결되지 않아 카카오맵 길찾기로 대신 엽니다.</b></> : null}</p></div>
    </div>;
}
