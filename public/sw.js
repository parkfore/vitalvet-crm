/* VitalVET 영업 CRM 알림 (웹푸시) — 화면이 닫혀 있어도 알림을 띄운다 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'VitalVET', body: e.data ? e.data.text() : '' }; }
    const title = d.title || 'VitalVET 알림';
    e.waitUntil(self.registration.showNotification(title, {
        body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: '/apple-touch-icon.png', badge: '/apple-touch-icon.png',
        data: { url: d.url || '/' }, lang: 'ko',
    }));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
    e.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const c = all.find(x => new URL(x.url).origin === self.location.origin);
        if (c) { await c.focus(); c.postMessage({ type: 'vv-nav', url }); return; }
        await self.clients.openWindow(url);
    })());
});

// 브라우저가 구독을 바꾸면 서버에 다시 알린다
self.addEventListener('pushsubscriptionchange', e => {
    e.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        all.forEach(c => c.postMessage({ type: 'vv-resubscribe' }));
    })());
});
