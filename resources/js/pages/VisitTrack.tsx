// 방문 기록 지도: 날짜별로 영업사원이 방문을 기록한 위치·시각과 병원을 지도에 함께 표시
import { useEffect, useRef, useState } from 'react';
import { openDetail } from '../components/HospitalDrawer';
import { checkinM, GeoBadge, geoDist } from '../components/ui';
import { can, cur, liveH, peopleScope, reporters, sameTeam, userById, userColor } from '../lib/domain';
import { I } from '../lib/icons';
import { createMap, mapReady, provider, type MapAdapter, type Track, type TrackPt } from '../lib/maps';
import { notify, S, ui } from '../lib/store';
import type { Activity, Hospital, User } from '../lib/types';
import { addDays, fd, fmtN, today } from '../lib/utils';

export const canTrack = () => can('activity', 'read');
const T = () => ui.track;
const hm = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(+d)) return ''; const h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; };
type Row = { a: Activity; h: Hospital; at: string; kind: TrackPt['kind'] | 'nogeo' };

function rowsFor(date: string, ids: Set<string>): Map<string, Row[]> {
    const by = new Map<string, Row[]>();
    for (const h of liveH()) for (const a of h.activities || []) {
        if (a.type !== '방문' || a.date !== date || !ids.has(a.authorId || '')) continue;
        const g = a.geo; const d = g ? geoDist(g, h) : null;
        const kind: Row['kind'] = !g ? 'nogeo' : d == null ? 'nohosp' : d > checkinM() ? 'far' : 'ok';
        const r = { a, h, at: g?.at || a.ts || '', kind }; const k = a.authorId!; by.set(k, [...(by.get(k) || []), r]);
    }
    by.forEach(l => l.sort((x, y) => (x.at || '9').localeCompare(y.at || '9')));
    return by;
}

/** 지도 화면 위쪽: 병원 지도 / 방문 기록 */
export function MapTabs() {
    if (!canTrack()) return null;
    const m = ui.map;
    return <div className="map-tabs seg" id="mapTabs"><button type="button" className={m.tab !== 'track' ? 'on' : ''} onClick={() => { m.tab = 'h'; notify(); }}>{I.map}병원 지도</button>
        <button type="button" className={m.tab === 'track' ? 'on' : ''} data-act="trackTab" onClick={() => { m.tab = 'track'; notify(); }}>{I.route}방문 기록</button></div>;
}

export function VisitTrack() {
    const canvas = useRef<HTMLDivElement>(null); const ad = useRef<MapAdapter | null>(null); const [fitReq, setFitReq] = useState(1);
    const t = T(); if (!t.date) t.date = today();
    const me = cur()!; const own = peopleScope(me) === 'self';
    const people: User[] = own ? [me] : (() => { const r = reporters(); const extra = S.users.filter(u => !r.includes(u) && sameTeam(u.id) && liveH().some(h => (h.activities || []).some(a => a.type === '방문' && a.date === t.date && a.authorId === u.id))); return [...r, ...extra]; })();
    const ids = new Set((t.user ? people.filter(u => u.id === t.user) : people).map(u => u.id));
    const by = rowsFor(t.date, ids);
    const shown = people.filter(u => ids.has(u.id));
    const ready = mapReady(); const prov = provider();
    const tracks: Track[] = shown.filter(u => by.get(u.id)?.some(r => r.a.geo)).map(u => ({
        color: userColor(u.id), name: u.name,
        pts: by.get(u.id)!.filter(r => r.a.geo).map(r => ({ id: r.a.id, lat: r.a.geo!.lat, lng: r.a.geo!.lng, time: hm(r.at), kind: r.kind as TrackPt['kind'], title: r.h.name, who: t.user ? undefined : u.name, hosp: r.h.lat ? { lat: r.h.lat, lng: r.h.lng! } : null, sel: t.sel === r.a.id })),
    }));
    const hosp = [...new Map([...by.values()].flat().filter(r => r.h.lat).map(r => [r.h.id, r.h])).values()];
    const all = [...by.values()].flat(); const selRow = all.find(r => r.a.id === t.sel);

    useEffect(() => { ad.current = createMap(canvas.current!); setFitReq(x => x + 1); return () => { ad.current?.destroy?.(); ad.current = null; }; }, [ready, prov]);
    useEffect(() => {
        const a = ad.current; if (!a) return;
        a.setMarkers(hosp, { sel: selRow?.h.id || null, route: [], plain: true }, id => { const r = all.find(x => x.h.id === id); if (r) { t.sel = r.a.id; notify(); } });
        a.drawRoute([]); a.drawTrack(tracks, id => { t.sel = id; notify(); });
    });
    useEffect(() => {
        const a = ad.current; if (!a) return; const pts = [...tracks.flatMap(x => x.pts.map(p => ({ lat: p.lat, lng: p.lng }))), ...hosp.map(h => ({ lat: h.lat, lng: h.lng }))];
        if (pts.length) a.fit(pts as any);
    }, [fitReq, t.date, t.user]); // eslint-disable-line react-hooks/exhaustive-deps
    const pick = (r: Row) => { t.sel = r.a.id; notify(); const g = r.a.geo || (r.h.lat ? { lat: r.h.lat, lng: r.h.lng } : null); if (g) ad.current?.focus(g as any); };
    const setDate = (d: string) => { t.date = d > today() ? today() : d; t.sel = ''; notify(); };
    const tot = { v: all.length, ok: all.filter(r => r.kind === 'ok').length, far: all.filter(r => r.kind === 'far').length, no: all.filter(r => r.kind === 'nogeo').length };

    return <div className="map-shell track-shell"><aside className="map-side">
        <div className="ms-sec"><MapTabs /></div>
        <div className="ms-sec" id="tkFilters"><h3>날짜·영업사원</h3>
            <div className="tk-date"><button className="btn sm" aria-label="전날" onClick={() => setDate(addDays(-1, t.date))}>‹</button><input id="tk-date" type="date" value={t.date} max={today()} onChange={e => e.target.value && setDate(e.target.value)} /><button className="btn sm" aria-label="다음 날" disabled={t.date >= today()} onClick={() => setDate(addDays(1, t.date))}>›</button>
                {t.date !== today() ? <button className="btn sm" onClick={() => setDate(today())}>오늘</button> : null}</div>
            {!own ? <select id="tk-user" value={t.user} onChange={e => { t.user = e.target.value; t.sel = ''; notify(); }} style={{ width: '100%', marginTop: 8 }}><option value="">영업사원 전체</option>{people.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select> : null}
            <div className="tk-sum"><span><b>{fmtN(tot.v)}</b>방문</span><span className="ok"><b>{fmtN(tot.ok)}</b>현장 확인</span><span className={tot.far ? 'bad' : ''}><b>{fmtN(tot.far)}</b>위치 멂</span><span className={tot.no ? 'warn' : ''}><b>{fmtN(tot.no)}</b>위치 없음</span></div></div>
        <div className="ms-sec listsec" style={{ borderBottom: 0 }} id="tkList">
            {shown.map(u => { const l = by.get(u.id) || []; const times = l.filter(r => r.at).map(r => r.at);
                return <div key={u.id} className="tk-person"><h3><span className="sw-dot" style={{ background: userColor(u.id) }} /><span>{u.name}</span><small className="muted">{l.length ? `방문 ${fmtN(l.length)}건${times.length ? ` · ${hm(times[0])} ~ ${hm(times.at(-1))}` : ''}` : '방문 기록 없음'}</small></h3>
                    {l.length ? <ol className="tk-list">{l.map(r => { const n = l.filter(x => x.a.geo).indexOf(r) + 1;
                        return <li key={r.a.id} className={`${t.sel === r.a.id ? 'sel' : ''} tk-${r.kind}`} onClick={() => pick(r)}>
                            <span className="tk-i" style={{ ['--c' as any]: userColor(u.id) }}>{r.a.geo ? n : '–'}</span>
                            <div style={{ minWidth: 0 }}><div className="nm"><b>{r.h.name}</b><time>{hm(r.at) || '시간 없음'}</time></div>
                                <div className="tk-meta"><span className="tk-rep" style={{ ['--c' as any]: userColor(u.id) }}>{u.name}</span>{r.h.ownerId && r.h.ownerId !== u.id ? <span className="h-sub">담당 {userById(r.h.ownerId)?.name || ''}</span> : null}</div>
                                <div className="sub">{r.a.geo ? <GeoBadge g={r.a.geo} h={r.h} /> : <span className="badge f-오늘">위치 없이 기록</span>}{r.a.purpose ? <span className="h-sub">{r.a.purpose}</span> : null}</div></div>
                            <button className="btn sm" title="병원 상세" onClick={e => { e.stopPropagation(); openDetail(r.h.id); }}>상세</button></li>; })}</ol> : null}</div>; })}
            {!shown.length ? <p className="hint" style={{ padding: 16 }}>볼 수 있는 영업사원이 없습니다</p> : null}
            <p className="hint" style={{ padding: '8px 16px 16px' }}>번호는 그날 체크인한 순서입니다. 점은 기록한 위치, 핀은 병원입니다. 병원에서 {checkinM()}m 넘게 떨어지면 빨간 점선으로 병원과 이어 보여 줍니다.</p></div>
    </aside>
        <div className="map-area" id="mapArea"><div className="map-canvas" id="mapCanvas" ref={canvas} />
            <div className="map-top"><div className="map-pill"><b>{fd(t.date)} 방문 기록</b><span className="muted">{t.user ? userById(t.user)?.name : '영업사원 전체'} · 체크인 {fmtN(tracks.reduce((s, x) => s + x.pts.length, 0))}곳</span></div>
                <div className="map-tools"><button className="btn sm" onClick={() => setFitReq(x => x + 1)}>전체 보기</button></div></div>
            {!tracks.length ? <div className="tk-empty">{all.length ? '이 날은 위치를 넣은 방문 기록이 없습니다' : '이 날 방문 기록이 없습니다'}</div> : null}
        </div>
    </div>;
}
