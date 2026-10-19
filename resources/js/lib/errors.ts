/*
 * 화면 오류 자동 감지: 처리되지 않은 오류·저장 실패를 모아 서버 '오류 기록'으로 보낸다.
 * 같은 오류는 한 화면에서 한 번만 보내고, 최대 20건까지.
 */
import { api } from './api';

type E = { message: string; stack?: string; url?: string; key?: string };
const sent = new Set<string>(); let queue: E[] = []; let timer: any = 0; let total = 0;
const IGNORE = /ResizeObserver loop|Script error\.?$|Non-Error promise rejection|chrome-extension:|moz-extension:|Load failed|Failed to fetch|NetworkError/i;

export function reportError(e: E) {
    const msg = String(e.message || '').slice(0, 480); if (!msg || IGNORE.test(msg) || IGNORE.test(e.stack || '')) return;
    const k = e.key || msg; if (sent.has(k) || total >= 20) return; sent.add(k); total++;
    queue.push({ ...e, message: msg, url: e.url || location.pathname, stack: (e.stack || '').slice(0, 3000) });
    clearTimeout(timer); timer = setTimeout(flush, 1500);
}
function flush() { const q = queue; queue = []; if (q.length) api('POST', '/api/client-errors', { errors: q }).catch(() => { /* 오류 보고 실패는 무시 */ }); }

export function installErrorReporter() {
    window.addEventListener('error', ev => { const er: any = ev.error; reportError({ message: er?.message || ev.message, stack: er?.stack || `${ev.filename}:${ev.lineno}:${ev.colno}` }); });
    window.addEventListener('unhandledrejection', ev => { const r: any = ev.reason; if (r?.status != null) return; /* 서버 응답 오류는 각 화면이 안내 */ reportError({ message: 'Promise: ' + (r?.message || String(r)), stack: r?.stack }); });
    window.addEventListener('pagehide', flush);
}
