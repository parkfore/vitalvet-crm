// 서버 API: 세션 로그인 + CSRF(XSRF-TOKEN 쿠키)
export class ApiError extends Error {
    status: number; code?: string;
    constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code; }
}
function xsrf() { const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }

/** 저장 응답의 데이터 버전 (바뀌기 전·후) → store 가 받아서 '내가 바꾼 것'은 다시 받지 않게 한다 */
let verHook: ((prev: string, ver: string) => void) | null = null;
export const onDataVer = (f: (prev: string, ver: string) => void) => { verHook = f; };

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
    let r: Response;
    try {
        r = await fetch(url, {
            method, credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': xsrf() },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError('서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.', 0);
    }
    let j: any = null;
    try { j = await r.json(); } catch { /* 빈 응답 */ }
    const ver = r.headers.get('X-Data-Ver'); if (r.ok && ver && verHook) verHook(r.headers.get('X-Data-Prev') || '', ver);
    if (!r.ok) throw new ApiError(j?.message || `서버 오류가 발생했습니다 (${r.status})`, r.status, j?.code);
    return j as T;
}
