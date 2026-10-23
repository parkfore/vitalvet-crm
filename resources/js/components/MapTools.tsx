// 지도 오른쪽 위 도구 (병원 지도·방문 기록 공통): 내 위치 · 전체 보기 · 이름 숨기기 · 깜빡임 끄기 · 정보 숨기기
import { useState, type RefObject } from 'react';
import { I } from '../lib/icons';
import { geoHelp, geoShort, locateMe } from '../lib/here';
import type { MapAdapter } from '../lib/maps';
import { confirmBox, notify, ui } from '../lib/store';

export function geoAlert(f: string) { confirmBox({ title: geoShort(f as any), body: <p style={{ lineHeight: 1.6 }}>{geoHelp(f as any)}</p>, ok: '확인' }); }

/** 지도 캔버스에 붙일 표시 상태 (이름·깜빡임) */
export const mapCanvasCls = () => `${ui.map.labels ? '' : 'hide-labels'} ${ui.map.blink ? '' : 'no-blink'}`;

export function MapTools({ ad, onFit }: { ad: RefObject<MapAdapter | null>; onFit: () => void }) {
    const m = ui.map;
    return <div className="map-tools">
        <button className="btn sm" data-act="locMe" onClick={async () => { const p = await locateMe(true); if (p) ad.current?.focus(p as any); else geoAlert((m as any).meFail || 'off'); }}>{I.pin}내 위치</button>
        <button className="btn sm mt-extra" data-act="mapFit" onClick={onFit}>전체 보기</button>
        <button className="btn sm mt-extra" data-act="mapLabels" onClick={() => { m.labels = !m.labels; notify(); }}>{m.labels ? '이름 숨기기' : '이름 표시'}</button>
        <button className="btn sm mt-extra" data-act="mapBlink" onClick={() => { m.blink = !m.blink; notify(); }}>{m.blink ? '깜빡임 끄기' : '깜빡임 켜기'}</button>
    </div>;
}

/* 왼쪽 목록(카테고리·조건) 접기/펴기 — 큰 화면에서 지도를 넓게 볼 때 */
const SKEY = 'vv-map-side';
export function useMapSide(): [boolean, () => void] {
    const [on, setOn] = useState<boolean>(() => { try { return localStorage.getItem(SKEY) !== '0'; } catch { return true; } });
    return [on, () => setOn(v => { try { localStorage.setItem(SKEY, v ? '0' : '1'); } catch { /* 저장 불가 */ } return !v; })];
}
export function SideToggle({ on, toggle }: { on: boolean; toggle: () => void }) {
    return <button type="button" className="btn sm side-toggle" data-act="mapSide" onClick={e => { toggle(); (e.currentTarget.closest('.map-shell') as HTMLElement | null)?.scrollTo({ top: 0 }); }} aria-expanded={on} title={on ? '목록을 접어 지도를 넓게' : '목록 펴기'}><span className="st-pc">{on ? '◀' : '▶'}</span><span className="st-mo">{on ? '▲' : '▼'}</span> {on ? '목록 접기' : '목록 펴기'}</button>;
}
