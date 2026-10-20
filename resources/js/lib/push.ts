/*
 * 웹푸시: 이 기기(브라우저)를 알림 받을 기기로 등록·해제
 * - 안드로이드·PC 크롬/엣지: 허락만 하면 됨
 * - 아이폰·아이패드: 사파리에서 '홈 화면에 추가'한 앱으로 열었을 때만 가능 (iOS 16.4 이상)
 */
import { api } from './api';
import { S, notify } from './store';

export type PushStatus = 'on' | 'off' | 'denied' | 'ios-install' | 'unsupported';

const b64ToBytes = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let reg: ServiceWorkerRegistration | null = null;
async function swReg() {
    if (reg) return reg;
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
}

export async function pushStatus(): Promise<PushStatus> {
    if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try { const r = await navigator.serviceWorker.getRegistration('/'); const sub = await r?.pushManager.getSubscription(); return sub ? 'on' : 'off'; } catch { return 'off'; }
}

/** 이 기기에서 알림 받기 (허락 창 → 서버에 등록) */
export async function pushOn(): Promise<PushStatus> {
    if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
    const r = await swReg();
    let sub = await r.pushManager.getSubscription();
    const key = S.notif?.vapid || '';
    if (!key) throw new Error('서버 알림 키를 불러오지 못했습니다. 새로고침 후 다시 해 주세요');
    // 서버 키가 바뀌었으면 다시 구독
    if (sub && sub.options?.applicationServerKey) {
        const cur = new Uint8Array(sub.options.applicationServerKey as ArrayBuffer); const want = b64ToBytes(key);
        if (cur.length !== want.length || cur.some((b, i) => b !== want[i])) { await sub.unsubscribe(); sub = null; }
    }
    sub ||= await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    const res = await api<{ devices: number }>('POST', '/api/push/subscribe', sub.toJSON());
    if (S.notif) S.notif.devices = res.devices; notify();
    return 'on';
}

export async function pushOff(): Promise<PushStatus> {
    const r = await navigator.serviceWorker.getRegistration('/'); const sub = await r?.pushManager.getSubscription();
    if (sub) { const res = await api<{ devices: number }>('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => null); await sub.unsubscribe(); if (S.notif && res) S.notif.devices = res.devices; }
    notify(); return 'off';
}

/** 앱을 열 때: 이미 허락한 기기는 등록을 새로 고친다 (서버에서 지워졌거나 브라우저가 구독을 바꾼 경우) */
export async function pushRefresh() {
    try {
        if (!pushSupported() || Notification.permission !== 'granted' || !S?.notif?.vapid) return;
        const r = await swReg(); const sub = await r.pushManager.getSubscription();
        if (sub) await api('POST', '/api/push/subscribe', sub.toJSON());
        else if (localStorage.getItem('vv-push') === '1') await pushOn();
    } catch { /* 다음에 다시 */ }
}
export function rememberPush(on: boolean) { try { localStorage.setItem('vv-push', on ? '1' : '0'); } catch { /* 저장 불가 */ } }
