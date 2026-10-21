/* 동선 출발점: 현재 위치(기본) · 동선의 병원 · 주소 */
import { getH } from './domain';
import { notify, ui } from './store';

export type StartPt = { lat: number; lng: number; label: string; kind: 'here' | 'hosp' | 'addr' };

/** 현재 위치 잡기 (1분 안에 잡은 위치는 다시 쓴다) */
export function locateMe(force = false): Promise<{ lat: number; lng: number; acc: number } | null> {
    const m = ui.map;
    if (!force && m.me && Date.now() - m.me.at < 60e3) return Promise.resolve(m.me);
    if (!('geolocation' in navigator)) { m.meErr = '이 기기는 위치를 지원하지 않습니다'; notify(); return Promise.resolve(null); }
    return new Promise(res => navigator.geolocation.getCurrentPosition(p => {
        m.me = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() }; m.meErr = ''; notify(); res(m.me);
    }, e => { m.meErr = e.code === 1 ? '위치 권한이 꺼져 있습니다' : '현재 위치를 찾지 못했습니다'; notify(); res(null); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }));
}

/** 지금 정한 출발점 (현재 위치를 아직 못 잡았으면 없음) */
export function startPoint(): StartPt | null {
    const s = ui.map.start;
    if (s.kind === 'here') return ui.map.me ? { lat: ui.map.me.lat, lng: ui.map.me.lng, label: '현재 위치', kind: 'here' } : null;
    if (s.kind === 'hosp') { const h = getH(s.hid); return h?.lat ? { lat: h.lat, lng: h.lng!, label: h.name, kind: 'hosp' } : null; }
    return s.lat ? { lat: s.lat, lng: s.lng, label: s.label || '출발지', kind: 'addr' } : null;
}
