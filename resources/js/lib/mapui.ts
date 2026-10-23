/* 지도 위 정보(조건·병원 수)와 도구 버튼 보이기/숨기기 — 휴대폰은 처음에 숨겨 지도를 넓게 */
import { useState } from 'react';

const KEY = 'vv-map-info';
export function useMapInfo(): [boolean, () => void] {
    const [on, setOn] = useState<boolean>(() => { try { const v = localStorage.getItem(KEY); if (v === '1' || v === '0') return v === '1'; } catch { /* 저장 불가 */ } return window.innerWidth > 860; });
    return [on, () => setOn(v => { try { localStorage.setItem(KEY, v ? '0' : '1'); } catch { /* 저장 불가 */ } return !v; })];
}
