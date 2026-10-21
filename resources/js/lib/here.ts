/* 동선 출발점: 현재 위치(기본) · 동선의 병원 · 주소 */
import { getH } from './domain';
import { notify, ui } from './store';

export type StartPt = { lat: number; lng: number; label: string; kind: 'here' | 'hosp' | 'addr' };

export type GeoFail = 'denied' | 'off' | 'timeout' | 'unsupported' | 'insecure' | 'inapp';
export type GeoResult = { lat: number; lng: number; acc: number } | { fail: GeoFail };

/** 카카오톡·네이버·인스타그램 등 앱 안의 브라우저 (위치를 막는 경우가 많다) */
export const inAppBrowser = () => { const u = navigator.userAgent; return /KAKAOTALK/i.test(u) ? 'kakao' : /NAVER\(inapp|; ?NAVER/i.test(u) ? 'naver' : /Instagram|FBAN|FBAV|Line\//i.test(u) ? 'app' : ''; };
/** 지금 브라우저의 위치 권한 상태 (모르면 '') */
export async function geoPermission(): Promise<'granted' | 'denied' | 'prompt' | ''> {
    try { const r = await (navigator as any).permissions?.query({ name: 'geolocation' }); return r?.state || ''; } catch { return ''; }
}
const once = (o: PositionOptions) => new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, o));

/**
 * 현재 위치: 먼저 빠른 위치(와이파이·기지국)로, 안 되면 정확한 위치(GPS)로 한 번 더.
 * fresh=true 면 예전에 잡아 둔 위치를 쓰지 않는다 (체크인)
 */
export async function getPosition(fresh = false): Promise<GeoResult> {
    if (!window.isSecureContext) return { fail: 'insecure' };
    if (!('geolocation' in navigator)) return { fail: 'unsupported' };
    let last: any = null;
    for (const o of [{ enableHighAccuracy: false, timeout: 8000, maximumAge: fresh ? 0 : 120000 }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }]) {
        try { const p = await once(o); return { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }; }
        catch (e: any) { last = e; if (e?.code === 1) break; }
    }
    if (last?.code === 1) return { fail: inAppBrowser() ? 'inapp' : 'denied' };
    return { fail: last?.code === 3 ? 'timeout' : inAppBrowser() ? 'inapp' : 'off' };
}

/** 실패 이유별 안내 (기기에 맞춰) */
export function geoHelp(f: GeoFail): string {
    const u = navigator.userAgent; const ios = /iPhone|iPad|iPod/.test(u) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); const android = /Android/i.test(u); const samsung = /SamsungBrowser/i.test(u); const mac = /Macintosh/.test(u) && !ios; const win = /Windows/.test(u);
    if (f === 'inapp') return '카카오톡 등 앱 안에서 열린 화면은 위치를 쓸 수 없는 경우가 많습니다. 오른쪽 위 메뉴(⋮ 또는 공유)에서 “다른 브라우저로 열기”를 눌러 크롬·사파리·삼성 인터넷에서 열어 주세요.';
    if (f === 'insecure' || f === 'unsupported') return '이 브라우저에서는 위치를 쓸 수 없습니다. 크롬·사파리·삼성 인터넷·엣지에서 열어 주세요.';
    if (f === 'denied') {
        if (ios) return '아이폰: 설정 › 개인정보 보호 및 보안 › 위치 서비스 켜기 → 그 아래 Safari 웹사이트(또는 홈 화면 앱)를 “앱을 사용하는 동안”으로. 사파리 주소창 왼쪽 “가가” › 웹사이트 설정 › 위치 › 허용.';
        if (samsung) return '삼성 인터넷: 주소창 자물쇠 › 권한 › 위치 허용. 휴대폰 설정 › 위치가 켜져 있는지, 설정 › 애플리케이션 › 삼성 인터넷 › 권한 › 위치가 허용인지도 확인하세요.';
        if (android) return '안드로이드 크롬: 주소창 왼쪽 자물쇠(또는 ⓘ) › 권한 › 위치 › 허용. 휴대폰 설정 › 위치가 켜져 있는지, 설정 › 애플리케이션 › Chrome › 권한 › 위치가 허용인지도 확인하세요.';
        if (mac) return '맥: 주소창 왼쪽 자물쇠 › 위치 › 허용. 시스템 설정 › 개인정보 보호 및 보안 › 위치 서비스에서 Chrome(또는 Safari)도 켜 주세요.';
        if (win) return '윈도우: 주소창 왼쪽 자물쇠 › 사이트 설정 › 위치 › 허용. 윈도우 설정 › 개인 정보 및 보안 › 위치에서 “위치 서비스”와 “앱이 위치에 액세스하도록 허용”도 켜 주세요.';
        return '주소창 왼쪽 자물쇠 › 사이트 설정 › 위치를 “허용”으로 바꾼 뒤 다시 눌러 주세요.';
    }
    if (f === 'timeout') return '위치를 잡는 데 시간이 오래 걸립니다. 실내라면 창가로 가거나 와이파이를 켠 뒤 다시 눌러 주세요.';
    if (win) return '위치를 찾지 못했습니다. 윈도우 설정 › 개인 정보 및 보안 › 위치에서 “위치 서비스”를 켜고, 와이파이가 켜져 있는지 확인해 주세요. (유선 인터넷만 쓰는 PC는 위치를 못 잡을 수 있습니다)';
    if (mac) return '위치를 찾지 못했습니다. 시스템 설정 › 개인정보 보호 및 보안 › 위치 서비스를 켜고 와이파이를 켜 주세요.';
    return '위치를 찾지 못했습니다. 휴대폰의 위치(GPS)를 켜고 다시 눌러 주세요.';
}
export const geoShort = (f: GeoFail) => ({ denied: '위치 권한이 꺼져 있습니다', off: '기기의 위치 기능이 꺼져 있거나 위치를 찾지 못했습니다', timeout: '위치를 잡는 데 시간이 오래 걸립니다', unsupported: '이 브라우저는 위치를 지원하지 않습니다', insecure: '이 화면에서는 위치를 쓸 수 없습니다', inapp: '앱 안의 브라우저라 위치를 쓸 수 없습니다' }[f]);

/** 현재 위치 잡기 (1분 안에 잡은 위치는 다시 쓴다) */
export async function locateMe(force = false): Promise<{ lat: number; lng: number; acc: number } | null> {
    const m = ui.map;
    if (!force && m.me && Date.now() - m.me.at < 60e3) return m.me;
    const r = await getPosition();
    if ('fail' in r) { m.meErr = geoShort(r.fail); (m as any).meFail = r.fail; notify(); return null; }
    m.me = { ...r, at: Date.now() }; m.meErr = ''; (m as any).meFail = ''; notify(); return m.me;
}

/** 지도를 열 때: 이미 허용된 경우에만 조용히 위치를 잡는다 (허용 창은 사용자가 버튼을 눌렀을 때만) */
export async function locateIfAllowed() { if ((await geoPermission()) === 'granted') return locateMe(); return null; }

/** 지금 정한 출발점 (현재 위치를 아직 못 잡았으면 없음) */
export function startPoint(): StartPt | null {
    const s = ui.map.start;
    if (s.kind === 'here') return ui.map.me ? { lat: ui.map.me.lat, lng: ui.map.me.lng, label: '현재 위치', kind: 'here' } : null;
    if (s.kind === 'hosp') { const h = getH(s.hid); return h?.lat ? { lat: h.lat, lng: h.lng!, label: h.name, kind: 'hosp' } : null; }
    return s.lat ? { lat: s.lat, lng: s.lng, label: s.label || '출발지', kind: 'addr' } : null;
}
