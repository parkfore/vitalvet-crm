// API 호출 공통 함수.
// 같은 주소(도메인)로 요청하므로 로그인 쿠키가 그대로 전달되고,
// CSRF 보호용 토큰은 서버가 심어 둔 XSRF-TOKEN 쿠키에서 읽어 헤더로 보낸다.

const xsrf = () => {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
};

export class ApiError extends Error {
    constructor(public status: number, public body: unknown) {
        super(messageOf(status, body));
    }
}

/** 서버 응답에서 사람이 읽을 메시지를 뽑는다 (검증 오류는 첫 항목) */
function messageOf(status: number, body: unknown): string {
    if (body && typeof body === 'object') {
        const b = body as { message?: string; errors?: Record<string, string[]> };
        if (b.errors) {
            const first = Object.values(b.errors)[0]?.[0];
            if (first) return first;
        }
        if (b.message) return b.message;
    }
    if (status === 0) return '서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요';
    if (status >= 500) return '서버 오류가 났습니다. 잠시 후 다시 시도하세요';
    return `요청을 처리하지 못했습니다 (${status})`;
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

let onUnauthorized: (() => void) | null = null;
/** 로그인이 풀렸을 때(401·419) 호출할 함수 등록 */
export const setUnauthorizedHandler = (fn: () => void) => {
    onUnauthorized = fn;
};

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
    const isForm = body instanceof FormData;
    let res: Response;
    try {
        res = await fetch(`/api${path}`, {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': xsrf(),
                ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        });
    } catch {
        throw new ApiError(0, null);
    }
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    if (!res.ok) {
        if ((res.status === 401 || res.status === 419) && !path.startsWith('/auth/login')) onUnauthorized?.();
        throw new ApiError(res.status, data);
    }
    return data as T;
}

export const api = {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {}),
    put: <T>(path: string, body?: Body) => request<T>('PUT', path, body ?? {}),
    del: <T>(path: string, body?: Body) => request<T>('DELETE', path, body),
};

/** 오류 객체를 화면용 문장으로 */
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : '알 수 없는 오류가 났습니다');
