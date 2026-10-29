/*
 * 병원 정보 상태: 필수 정보(설정에서 고름) 미완성 여부, 영업 상태(영업·휴업·폐업), 지도 좌표
 * - 직접 등록·수정할 때는 필수 정보를 모두 채워야 저장된다
 * - 파일·API 로 가져온 병원은 비어 있는 필수 정보가 있으면 '정보 미완성'으로 표시된다
 */
import { S } from './store';
import type { Hospital } from './types';

type Rec = Partial<Hospital> & Record<string, any>;
const filled = (v: any) => v !== '' && v != null && !(Array.isArray(v) && !v.length);

/** [키, 이름, 입력칸, 채워졌는지] */
export const REQ_OPTIONS: [string, string, string, (h: Rec) => boolean][] = [
    ['name', '병원명', '#f-name', h => !!String(h.name || '').trim()],
    ['address', '주소', '#f-addr', h => !!h.address],
    ['phone', '병원 대표 전화', '#f-phone', h => !!String(h.phone || '').trim()],
    ['director', '원장님 이름', '#f-dir', h => !!String(h.director || '').trim()],
    ['directorPhone', '원장님 연락처', '#f-dirp', h => !!String(h.directorPhone || '').trim()],
    ['directorAge', '원장님 나이대', '#f-dage', h => !!h.directorAge],
    ['ownerId', '담당 영업사원', '#f-owner', h => !!h.ownerId],
    ['grade', '병원 등급', '#f-grade', h => !!h.grade],
    ['specialty', '전문과', '#f-spec', h => !!h.specialty],
    ['vetCount', '봉직수의사 수', '#f-vets', h => filled(h.vetCount)],
    ['geo', '지도 좌표', '#f-addr', h => !!h.lat && !!h.lng],
];
/** 병원명·주소는 항상 필수 */
export const ALWAYS_REQ = ['name', 'address'];

export const reqKeys = (): string[] => {
    const r = S?.settings?.requiredFields;
    return [...new Set([...ALWAYS_REQ, ...(Array.isArray(r) ? r : ['phone', 'director', 'ownerId'])])];
};
export const isReq = (k: string) => reqKeys().includes(k);

/** 비어 있는 필수 정보 [키, 이름, 입력칸] */
export function missingOf(h: Rec): [string, string, string][] {
    const ks = reqKeys();
    return REQ_OPTIONS.filter(o => ks.includes(o[0]) && !o[3](h)).map(o => [o[0], o[1], o[2]]);
}
export const isIncomplete = (h: Rec) => missingOf(h).length > 0;

/** 영업 상태: 값이 없으면 영업 */
export type Biz = '영업' | '휴업' | '폐업';
export const BIZ: Biz[] = ['영업', '휴업', '폐업'];
export const bizOf = (h: Rec): Biz => (h.bizStatus === '폐업' || h.bizStatus === '휴업' ? h.bizStatus : '영업');
export const BIZ_CLS: Record<Biz, string> = { 영업: 'f-완료', 휴업: 'f-오늘', 폐업: 'a-delete' };

export const ORIGIN_LABEL: Record<string, string> = { file: '파일 업로드', api: '공공데이터 연동' };

/** 시·도 이름 통일: 서울특별시 → 서울 */
const SIDO: Record<string, string> = {
    서울특별시: '서울', 서울시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산',
    세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라북도: '전북',
    전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 제주도: '제주',
};
export const sidoOf = (h: Rec) => { const s = String(h.sido || '').trim(); return SIDO[s] || s; };
export const SIDO_ORDER = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종', '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주'];

/** 경쟁 제품 계약 만료일까지 남은 날 (없으면 null) */
export function compDays(h: Rec): number | null {
    if (!h.compUntil) return null; const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((+new Date(h.compUntil + 'T00:00:00') - +t) / 864e5);
}
/** 재접촉 대상: 계약 만료 30일 전 ~ 만료 후 14일 (폐업·삭제 제외) */
export const COMP_SOON_DAYS = 30;
export const compSoon = (h: Rec) => { const d = compDays(h); return d != null && d <= COMP_SOON_DAYS && d >= -14 && !h.deletedAt && bizOf(h) !== '폐업'; };

/** 정보 필터: '' 전체 · incomplete 미완성 · complete 완성 · nogeo 좌표 없음 · compSoon 계약 만료 임박 */
export function infoMatch(h: Rec, f: string) {
    if (!f) return true;
    if (f === 'incomplete') return isIncomplete(h);
    if (f === 'complete') return !isIncomplete(h);
    if (f === 'nogeo') return !h.lat;
    if (f === 'imported') return !!h.importedFrom;
    if (f === 'compSoon') return compSoon(h);
    return true;
}
