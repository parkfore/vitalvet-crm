/*
 * 병원 정보 가져오기 (화면 쪽)
 * - 파일 읽기: CSV(UTF-8 또는 EUC-KR, 공공데이터 파일은 대부분 EUC-KR), 엑셀(.xlsx)
 * - 서버에 열 이름을 보내 어떤 열이 병원명·주소·영업 상태인지 확인(preview)한 뒤, 100줄씩 나눠 보낸다
 * - 공공데이터 API 는 서버가 한 쪽씩 불러와 반영한다
 */
import { api } from './api';
import { uid } from './utils';

export type Field = [string, string];
export interface Preview { fields: Field[]; mapping: Record<string, string>; sample: any[]; geocoder: string; keys?: string[]; total?: number }
export interface Counts { created: number; updated: number; exists: number; skippedClosed: number; invalid: number; noGeo: number; changes: { id: string; name: string; before: string; after: string }[]; errors: string[] }
export const zero = (): Counts => ({ created: 0, updated: 0, exists: 0, skippedClosed: 0, invalid: 0, noGeo: 0, changes: [], errors: [] });
export function add(a: Counts, b: Partial<Counts>): Counts {
    return {
        created: a.created + (b.created || 0), updated: a.updated + (b.updated || 0), exists: a.exists + (b.exists || 0), skippedClosed: a.skippedClosed + (b.skippedClosed || 0),
        invalid: a.invalid + (b.invalid || 0), noGeo: a.noGeo + (b.noGeo || 0), changes: [...a.changes, ...(b.changes || [])].slice(0, 300), errors: [...a.errors, ...(b.errors || [])].slice(0, 50),
    };
}

export interface Sheet { name: string; headers: string[]; rows: Record<string, string>[] }

/** 글자 인코딩 판단: UTF-8 로 읽어서 깨지면 EUC-KR */
function decodeText(buf: ArrayBuffer) {
    const b = new Uint8Array(buf);
    const start = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(start)); } catch { return new TextDecoder('euc-kr').decode(b); }
}

/** CSV 한 덩어리 → 행 배열 (따옴표 안의 쉼표·줄바꿈 처리) */
export function parseCsv(text: string): string[][] {
    const sep = (() => { const first = text.slice(0, 2000).split(/\r?\n/)[0] || ''; return (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ','; })();
    const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
        } else if (c === '"' && cell === '') q = true;
        else if (c === sep) { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

/** 머리글 줄 찾기: 처음 10줄 중 글자가 든 칸이 가장 많은 줄 */
function toSheet(name: string, table: any[][]): Sheet {
    const str = (v: any) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());
    const t = table.map(r => (r || []).map(str));
    let hi = 0, best = -1;
    t.slice(0, 10).forEach((r, i) => { const n = r.filter(Boolean).length; if (n > best) { best = n; hi = i; } });
    const raw = t[hi] || []; const seen: Record<string, number> = {};
    const headers = raw.map((h, i) => { let k = h || `열${i + 1}`; if (seen[k]) k = `${k}_${++seen[k]}`; else seen[k] = 1; return k; });
    const rows = t.slice(hi + 1).filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
    return { name, headers, rows };
}

export async function readFile(file: File): Promise<Sheet> {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xls') throw new Error('예전 엑셀(.xls) 파일은 읽을 수 없습니다. 엑셀에서 "다른 이름으로 저장 → Excel 통합 문서(.xlsx)" 또는 CSV 로 저장한 뒤 올려 주세요.');
    if (ext === 'xlsx' || ext === 'xlsm') {
        const { readSheet } = await import('read-excel-file/browser');
        const data = await readSheet(file);
        return toSheet(file.name, data as any[][]);
    }
    const text = decodeText(await file.arrayBuffer());
    return toSheet(file.name, parseCsv(text));
}

export const preview = (headers: string[], rows: Record<string, string>[], mapping?: Record<string, string>) =>
    api<Preview>('POST', '/api/import/preview', { headers, rows: rows.slice(0, 5), mapping });

/** 열 연결(mapping)대로 한 줄을 항목 => 값 으로 */
export const canon = (r: Record<string, string>, map: Record<string, string>) => Object.fromEntries(Object.entries(map).filter(([, h]) => h).map(([f, h]) => [f, r[h] ?? '']));

export type Progress = { done: number; total: number; n: Counts; label?: string };

/** 파일 가져오기: 100줄씩 */
export async function runFile(sheet: Sheet, map: Record<string, string>, createClosed: boolean, onProgress: (p: Progress) => void, stop: () => boolean) {
    const runId = 'run_' + uid(); let n = zero(); const size = 100; const total = sheet.rows.length;
    for (let i = 0; i < total; i += size) {
        if (stop()) break;
        const rows = sheet.rows.slice(i, i + size).map(r => canon(r, map));
        const r = await api<Counts>('POST', '/api/import/rows', { runId, fileName: sheet.name, createClosed, rows });
        n = add(n, r); onProgress({ done: Math.min(total, i + size), total, n });
    }
    const fin = await api<{ summary?: string }>('POST', '/api/import/finish', { runId });
    return { n, summary: fin.summary || '' };
}

/** 공공데이터 API 연동: 한 쪽씩 끝까지 */
export async function runApi(createClosed: boolean, onProgress: (p: Progress) => void, stop: () => boolean) {
    const runId = 'run_' + uid(); let n = zero(); let page = 1; let total = 0; let done = 0;
    for (; ;) {
        if (stop()) break;
        const r = await api<Counts & { total: number; count: number; rowsPerPage: number }>('POST', '/api/import/api/page', { runId, page, createClosed });
        total = r.total || total; done += r.count; n = add(n, r); onProgress({ done, total: Math.max(total, done), n, label: `${page}쪽` });
        if (!r.count || done >= total || r.count < (r.rowsPerPage || 1)) break;
        page++;
        if (page > 2000) break;
    }
    const fin = await api<{ summary?: string }>('POST', '/api/import/finish', { runId });
    return { n, summary: fin.summary || '' };
}

/** 좌표 없는 병원 다시 찾기 (50곳씩) */
export async function runGeocode(onProgress: (done: number, left: number, failed: number) => void, stop: () => boolean) {
    const skip: string[] = []; let done = 0;
    for (; ;) {
        if (stop()) break;
        const r = await api<{ done: number; failed: string[]; remaining: number }>('POST', '/api/import/geocode', { skip });
        done += r.done; skip.push(...r.failed); onProgress(done, r.remaining, skip.length);
        if (!r.remaining || (!r.done && !r.failed.length)) break;
    }
    return { done, failed: skip.length };
}
