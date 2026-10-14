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
export function fmtPhone(v: any) {
    const d = String(v || '').replace(/\D/g, ''); if (!d) return '';
    if (d.startsWith('02')) { if (d.length <= 9) return d.replace(/^(02)(\d{3})(\d{0,4}).*/, '$1-$2-$3').replace(/-$/, ''); return d.replace(/^(02)(\d{4})(\d{0,4}).*/, '$1-$2-$3'); }
    if (d.length <= 10) return d.replace(/^(\d{3})(\d{3})(\d{0,4}).*/, '$1-$2-$3').replace(/-$/, ''); return d.replace(/^(\d{3})(\d{4})(\d{0,4}).*/, '$1-$2-$3');
}
export function distKm(a: { lat: any; lng: any }, b: { lat: any; lng: any }) {
    const R = 6371, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x));
}
export const kmTxt = (k: number) => (k < 1 ? `${Math.round(k * 1000)}m` : `${k.toFixed(1)}km`);
export const hashColor = (s: any) => CAT_COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % CAT_COLORS.length];
export const fmtN = (v: any) => Number(v).toLocaleString('ko-KR');
export const won = (v: any) => `${fmtN(v)}원`;
export const cx = (...a: any[]) => a.filter(Boolean).join(' ');
/** 한글 폭을 고려한 대략적 글자 폭 (차트 라벨 배치용) */
export const textW = (t: any, px = 12) => [...String(t)].reduce((a, c) => a + (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(c) ? px * .95 : /[\s.,·:()]/.test(c) ? px * .33 : px * .6), 0);
