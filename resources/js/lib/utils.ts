// 날짜·숫자·문자 도우미 (프로토타입과 동일)
import { CAT_COLORS } from './constants';

export const uid = () => Math.random().toString(36).slice(2, 9);
export const pad = (n: number) => String(n).padStart(2, '0');
export const pad4 = (n: number) => String(n).padStart(4, '0');
export const fmtD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const WD = ['일', '월', '화', '수', '목', '금', '토'];
/** 2026-10-15 → 2026-10-15 (목) */
export const fd = (ds?: string) => (ds ? `${ds} (${WD[new Date(ds + 'T00:00:00').getDay()]})` : '');
export const fmtTs = (iso: string) => { const d = new Date(iso); return `${fmtD(d)} (${WD[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const today = () => fmtD(new Date());
export const addDays = (n: number, base?: string) => { const d = base ? new Date(base + 'T00:00:00') : new Date(); d.setDate(d.getDate() + n); return fmtD(d); };
export const dday = (ds: string) => Math.round((+new Date(ds + 'T00:00:00') - +new Date(today() + 'T00:00:00')) / 864e5);
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
/** 전화번호 모양 (입력하는 동안에도 바로): 010-1234-5678 · 02-123-4567 · 031-123-4567 · 1588-1234 */
export function fmtPhone(v: any) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 12); if (!d) return '';
    if (/^1[5-9]/.test(d)) return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4, 8)}`;
    if (d.startsWith('02')) {
        if (d.length <= 2) return d; if (d.length <= 5) return `02-${d.slice(2)}`;
        if (d.length <= 9) return `02-${d.slice(2, 5)}-${d.slice(5)}`; return `02-${d.slice(2, 6)}-${d.slice(6, 10)}`;
    }
    const a = d.startsWith('050') && d.length > 11 ? 4 : 3;
    if (d.length <= a) return d; if (d.length <= a + 3) return `${d.slice(0, a)}-${d.slice(a)}`;
    if (d.length <= a + 7) return `${d.slice(0, a)}-${d.slice(a, a + 3)}-${d.slice(a + 3)}`;
    return `${d.slice(0, a)}-${d.slice(a, a + 4)}-${d.slice(a + 4, a + 8)}`;
}
/** 휴대폰: 010 은 11자리, 011·016~019 는 10~11자리 */
export const isMobile = (v: any) => { const d = String(v || '').replace(/\D/g, ''); return /^010\d{8}$/.test(d) || /^01[16789]\d{7,8}$/.test(d); };
/** 일반 전화: 지역번호·070·050·080·대표번호(1588 등)·휴대폰 */
export const isTel = (v: any) => { const d = String(v || '').replace(/\D/g, ''); return isMobile(d) || /^02\d{7,8}$/.test(d) || /^0[3-6][1-5]\d{7,8}$/.test(d) || /^070\d{8}$/.test(d) || /^050\d{8,9}$/.test(d) || /^080\d{7,8}$/.test(d) || /^1[5-9]\d{6}$/.test(d); };
/** 비어 있으면 통과, 틀리면 안내 문구 */
export const phoneErr = (v: any, kind: 'mobile' | 'tel') => (!String(v || '').trim() ? '' : kind === 'mobile' ? (isMobile(v) ? '' : '휴대폰 번호는 010-1234-5678 처럼 010 다음 8자리여야 합니다') : (isTel(v) ? '' : '전화번호 자릿수가 맞지 않습니다 (예: 02-123-4567, 031-123-4567, 1588-1234)'));
export function distKm(a: { lat: any; lng: any }, b: { lat: any; lng: any }) {
    const R = 6371, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x));
}
export const kmTxt = (k: number) => (k < 1 ? `${Math.round(k * 1000)}m` : `${k.toFixed(1)}km`);
export const hashColor = (s: any) => CAT_COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % CAT_COLORS.length];
/** 천 단위 콤마: 숫자(또는 숫자 글자)면 1,234 로, 아니면 그대로 돌려준다 (글자·화면 조각도 안전) */
export const fmtN = (v: any): any => { const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(v.trim()) ? +v : NaN; return Number.isFinite(n) ? n.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : v; };
export const won = (v: any) => `${fmtN(v)}원`;
export const cx = (...a: any[]) => a.filter(Boolean).join(' ');
/** 한글 폭을 고려한 대략적 글자 폭 (차트 라벨 배치용) */
export const textW = (t: any, px = 12) => [...String(t)].reduce((a, c) => a + (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(c) ? px * .95 : /[\s.,·:()]/.test(c) ? px * .33 : px * .6), 0);
