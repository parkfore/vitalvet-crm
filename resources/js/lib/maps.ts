/*
 * 지도 연동 (카카오맵 / 네이버 지도 / 키가 없을 때 미리보기 지도)
 * - 키는 서버 .env 에서 받는다 (KAKAO_JS_KEY, NAVER_MAP_CLIENT_ID)
 * - 어떤 지도를 쓸지는 설정 메뉴에서 고른다 (S.settings.mapProvider)
 * - 주소 검색은 카카오 우편번호 서비스(키 불필요), 카카오내비 안내는 카카오 JavaScript 키가 있을 때만
 */
import { MAP_MODE_LABEL } from './constants';
import { sc } from './domain';
import { sidoOf } from './hinfo';
import { notify, S, STAGES } from './store';
import type { Hospital } from './types';

declare const kakao: any;
declare const naver: any;
declare const Kakao: any;

export type Provider = 'kakao' | 'naver';
let ready: Record<Provider, boolean> = { kakao: false, naver: false };
export let postcodeReady = false;
export let kakaoSdkReady = false;
let loading: Promise<void> | null = null;

export const provider = (): Provider => ((S?.settings?.mapProvider || S?.maps?.provider) === 'naver' ? 'naver' : 'kakao');
export const keyOf = (p: Provider) => (p === 'naver' ? S?.maps?.naverKey : S?.maps?.kakaoKey) || '';
export const mapReady = () => ready[provider()];
export const mapStatusLabel = () => (mapReady() ? `${provider() === 'naver' ? '네이버 지도' : '카카오맵'} 연결됨` : '미리보기 지도');

function loadScript(src: string, ms = 6000) {
    return new Promise<void>((res, rej) => {
        const s = document.createElement('script'); s.src = src; s.async = true;
        const t = setTimeout(() => rej(new Error('timeout')), ms);
        s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); rej(new Error('load')); };
        document.head.appendChild(s);
    });
}
async function initKakao() {
    const key = keyOf('kakao'); if (!key) return;
    try {
        if (!(window as any).kakao?.maps?.Map) {
            await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`);
            await new Promise<void>((r, j) => { if (!(window as any).kakao?.maps) return j(); kakao.maps.load(r); });
        }
        ready.kakao = true;
    } catch { ready.kakao = false; }
}
async function initNaver() {
    const key = keyOf('naver'); if (!key) return;
    try {
        if (!(window as any).naver?.maps?.Map) await loadScript(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder`);
        ready.naver = !!(window as any).naver?.maps?.Map;
    } catch { ready.naver = false; }
}
export const PostcodeCls = () => (window as any).kakao?.Postcode || (window as any).daum?.Postcode;
export async function initPostcode() {
    if (postcodeReady) return;
    for (const src of ['https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js', 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js']) {
        try { await loadScript(src, 5000); if (PostcodeCls()) { postcodeReady = true; return; } } catch { /* 다음 주소 시도 */ }
    }
    postcodeReady = false;
}
async function initKakaoSdk() {
    const key = keyOf('kakao'); if (!key) return;
    try { if (!(window as any).Kakao) await loadScript('https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js', 6000); if (!Kakao.isInitialized()) Kakao.init(key); kakaoSdkReady = !!Kakao.Navi; } catch { kakaoSdkReady = false; }
}
/** 로그인 후 한 번: 지도·우편번호·카카오 SDK 불러오기 */
export function startMaps() {
    if (loading) return loading;
    loading = Promise.allSettled([provider() === 'naver' ? initNaver() : initKakao(), initPostcode(), initKakaoSdk()]).then(() => notify());
    return loading;
}
/** 설정에서 지도를 바꿨을 때 */
export async function switchProvider() { if (provider() === 'naver') await initNaver(); else await initKakao(); notify(); }

/** 주소 → 좌표 (선택한 지도의 주소 검색) */
export function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    return new Promise(res => {
        try {
            if (provider() === 'naver' && ready.naver && naver.maps.Service) {
                naver.maps.Service.geocode({ query: address }, (st: any, r: any) => { const a = st === naver.maps.Service.Status.OK && r?.v2?.addresses?.[0]; res(a ? { lat: +a.y, lng: +a.x } : null); });
            } else if (ready.kakao && kakao.maps.services) {
                new kakao.maps.services.Geocoder().addressSearch(address, (r: any, st: any) => res(st === kakao.maps.services.Status.OK && r[0] ? { lat: +r[0].y, lng: +r[0].x } : null));
            } else res(null);
        } catch { res(null); }
    });
}

/* ---------------- 지도 그리기 공통 ---------------- */
export type MarkOpt = { sel: string | null; route: string[]; hit?: boolean; plain?: boolean };  // plain: 확대 정도와 상관없이 모두 핀으로, 번호 없이 (방문 기록)
export interface MapAdapter { setMarkers(items: Hospital[], o: MarkOpt, onClick: (id: string) => void): void; drawRoute(pts: Hospital[]): void; fit(items: Hospital[]): void; focus(h: Hospital): void; destroy?(): void; drawTrack(tracks: Track[], onClick: (id: string) => void): void; drawStart(start: StartMark | null, me: { lat: number; lng: number; acc?: number } | null): void }
/** 동선 출발점 (현재 위치가 아닐 때 깃발) */
export type StartMark = { lat: number; lng: number; label: string; kind: string };

/* ---------------- 방문 기록 (체크인 위치·시각) ---------------- */
/** ok 병원 300m 안 · far 병원과 멂 · nohosp 병원 좌표 없음 */
export type TrackPt = { id: string; lat: number; lng: number; time: string; kind: 'ok' | 'far' | 'nohosp'; title: string; who?: string; hosp?: { lat: number; lng: number } | null; sel?: boolean };
export type Track = { color: string; name: string; pts: TrackPt[] };
/** CSS 변수 색 → 실제 색 (지도 선 색으로 쓰기 위해) */
export const realColor = (c: string) => { const m = c.match(/^var\((--[\w-]+)\)$/); return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#0B6E63' : c; };
function meEl(acc?: number) { const d = document.createElement('div'); d.className = 'me-dot'; d.title = `현재 위치${acc ? ` (정확도 ±${acc}m)` : ''}`; d.innerHTML = '<i></i><b>내 위치</b>'; return d; }
function startEl(s: StartMark) { const d = document.createElement('div'); d.className = 'st-flag'; d.title = `출발: ${s.label}`; d.innerHTML = `<b>출발</b><span>${esc(s.label)}</span>`; return d; }
function trackEl(p: TrackPt, color: string, n: number, onClick: (id: string) => void) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `tk-pt tk-${p.kind}${p.sel ? ' sel' : ''}`; b.style.setProperty('--c', color); b.title = `${p.time} · ${p.who ? p.who + ' · ' : ''}${p.title}`;
    b.innerHTML = `<span class="tk-n">${n}</span><span class="tk-lb"><b>${esc(p.time)}</b>${p.who ? ` <i class="tk-who">${esc(p.who)}</i>` : ''} ${esc(p.title)}</span>`; b.onclick = e => { e.stopPropagation(); onClick(p.id); };
    return b;
}
type Group = { key: string; label: string; list: Hospital[]; lat: number; lng: number };

export function groupHosp(items: Hospital[], mode: string): Group[] {
    const m = new Map<string, Hospital[]>();
    items.forEach(h => { const sd = sidoOf(h) || '기타'; const k = mode === 'sido' ? sd : `${sd} ${h.sigungu}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(h); });
    return [...m.entries()].map(([k, list]) => ({ key: k, label: mode === 'sido' ? k : (list[0].sigungu || k), list, lat: list.reduce((a, h) => a + (h.lat || 0), 0) / list.length, lng: list.reduce((a, h) => a + (h.lng || 0), 0) / list.length }));
}
const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function pinEl(h: Hospital, o: MarkOpt) {
    const b = document.createElement('button'); b.type = 'button'; const ri = o.plain ? -1 : o.route.indexOf(h.id);
    b.className = 'pin' + (o.sel === h.id ? ' sel' : '') + (o.hit ? ' hit' : '') + (ri >= 0 ? ' in-route' : ''); b.style.setProperty('--c', sc(h.stage)); b.title = `${h.name} · ${h.stage}`;
    // 깜빡이는 원(pin-pulse)으로 지도 색에 묻히지 않게 한다
    b.innerHTML = `<span class="pin-label">${esc(h.name)}</span><span class="pin-dot"><b>${ri >= 0 ? ri + 1 : ''}</b></span><span class="pin-pulse"></span><span class="pin-base"></span>`;
    return b;
}
function clusterEl(g: Group, mode: string, onClick: () => void) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cl'; const n = g.list.length;
    b.style.setProperty('--sz', Math.round(46 + Math.min(42, Math.sqrt(n) * 7)) + 'px');
    let acc = 0; const segs: string[] = [];
    STAGES.forEach(s => { const c = g.list.filter(h => h.stage === s).length; if (!c) return; segs.push(`${sc(s)} ${acc / n * 360}deg ${(acc + c) / n * 360}deg`); acc += c; });
    b.style.background = `conic-gradient(${segs.join(',')})`;
    b.dataset.tip = [`${g.key} · ${n}곳`, ...STAGES.map(s => [s, g.list.filter(h => h.stage === s).length] as const).filter(x => x[1]).map(([s, c]) => `${s} ${c}`), mode === 'sido' ? '누르면 시·군·구별로 확대' : '누르면 병원별로 확대'].join('\n');
    b.innerHTML = `<span class="cl-in"><b>${n}</b><small>${esc(g.label)}</small></span>`; b.onclick = onClick;
    return b;
}
function setMapView(inView: number, mode: string) { const el = document.getElementById('mapView'); if (el) el.innerHTML = `화면 안 <b>${inView}</b>곳 · ${MAP_MODE_LABEL[mode]}`; }

/* ---------------- 미리보기 지도 (키 없을 때, 좌표 기준 배치) ---------------- */
class PreviewMap implements MapAdapter {
    tracks: Track[] = []; onTrack: (id: string) => void = () => { }; st: StartMark | null = null; me: { lat: number; lng: number; acc?: number } | null = null;
    drawStart(st: StartMark | null, me: { lat: number; lng: number; acc?: number } | null) { this.st = st; this.me = me; this.draw(); }
    drawTrack(t: Track[], onClick: (id: string) => void) { this.tracks = t; this.onTrack = onClick; this.draw(); }
    el: HTMLElement; c = { lat: 37.5, lng: 127.02 }; k = 3000; items: Hospital[] = []; o: MarkOpt = { sel: null, route: [] }; routePts: Hospital[] = []; onClick: (id: string) => void = () => { };
    wrap: HTMLElement; bg: SVGElement; rt: SVGElement; pins: HTMLElement; ro: ResizeObserver;
    constructor(el: HTMLElement, note: string) {
        this.el = el;
        el.innerHTML = `<div class="pm-wrap"><svg class="pm-bg"></svg><svg class="pm-route"></svg><div class="pm-pins"></div></div><div class="pm-note">${esc(note)}</div><div style="position:absolute;right:12px;top:100px;z-index:5" class="zoom"><button data-z="1" aria-label="확대">+</button><button data-z="-1" aria-label="축소">−</button></div>`;
        this.wrap = el.querySelector('.pm-wrap')!; this.bg = el.querySelector('.pm-bg')!; this.rt = el.querySelector('.pm-route')!; this.pins = el.querySelector('.pm-pins')!;
        el.querySelectorAll<HTMLButtonElement>('[data-z]').forEach(b => (b.onclick = () => this.zoomAt(+b.dataset.z! > 0 ? 1.6 : 1 / 1.6)));
        let drag: any = null;
        this.wrap.addEventListener('pointerdown', e => { if ((e.target as Element).closest('.pin,.cl')) return; drag = { x: e.clientX, y: e.clientY, c: { ...this.c } }; this.wrap.setPointerCapture(e.pointerId); this.wrap.classList.add('drag'); });
        this.wrap.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; this.c = { lat: drag.c.lat + dy / this.k, lng: drag.c.lng - dx / (this.k * this.cos()) }; this.draw(); });
        const end = () => { drag = null; this.wrap.classList.remove('drag'); }; this.wrap.addEventListener('pointerup', end); this.wrap.addEventListener('pointercancel', end);
        this.wrap.addEventListener('wheel', e => { e.preventDefault(); const r = this.wrap.getBoundingClientRect(); this.zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
        this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(el);
    }
    destroy() { this.ro.disconnect(); }
    mode() { return this.k < 2600 ? 'sido' : this.k < 14000 ? 'sgg' : 'pin'; }
    cos() { return Math.cos(this.c.lat * Math.PI / 180); }
    size() { return { w: this.el.clientWidth || 600, h: this.el.clientHeight || 400 }; }
    proj(lat: number, lng: number) { const { w, h } = this.size(); return { x: w / 2 + (lng - this.c.lng) * this.k * this.cos(), y: h / 2 - (lat - this.c.lat) * this.k }; }
    unproj(x: number, y: number) { const { w, h } = this.size(); return { lat: this.c.lat - (y - h / 2) / this.k, lng: this.c.lng + (x - w / 2) / (this.k * this.cos()) }; }
    zoomAt(f: number, x?: number, y?: number) { const { w, h } = this.size(); x ??= w / 2; y ??= h / 2; const before = this.unproj(x, y); this.k = Math.min(400000, Math.max(600, this.k * f)); const after = this.unproj(x, y); this.c.lat += before.lat - after.lat; this.c.lng += before.lng - after.lng; this.draw(); }
    setMarkers(items: Hospital[], o: MarkOpt, onClick: (id: string) => void) { this.items = items; this.o = o; this.onClick = onClick; this.draw(); }
    drawRoute(pts: Hospital[]) { this.routePts = pts; this.draw(); }
    fit(items: Hospital[], noDraw?: boolean) {
        if (!items.length) return; const { w, h } = this.size(); const la = items.map(i => i.lat!), ln = items.map(i => i.lng!);
        const minA = Math.min(...la), maxA = Math.max(...la), minN = Math.min(...ln), maxN = Math.max(...ln);
        this.c = { lat: (minA + maxA) / 2, lng: (minN + maxN) / 2 }; const dA = Math.max(maxA - minA, .004), dN = Math.max(maxN - minN, .004);
        this.k = Math.min(60000, Math.max(600, Math.min((h - 150) / dA, (w - 120) / (dN * this.cos())))); if (!noDraw) this.draw();
    }
    zoomGroup(g: Group, mode: string) { this.fit(g.list, true); if (this.mode() === mode || g.list.length === 1) { this.c = { lat: g.lat, lng: g.lng }; this.k = Math.max(this.k, mode === 'sido' ? 3200 : 16000); } this.draw(); }
    focus(hh: Hospital) { this.c = { lat: hh.lat!, lng: hh.lng! }; if (this.k < 25000) this.k = 25000; this.draw(); }
    draw() {
        const { w, h } = this.size(); const step = this.k > 40000 ? .005 : this.k > 12000 ? .02 : this.k > 4000 ? .05 : .1; const tl = this.unproj(0, 0), br = this.unproj(w, h); let g = '';
        for (let x = Math.floor(tl.lng / step) * step; x <= br.lng; x += step) { const p = this.proj(0, x).x; g += `<line x1="${p}" y1="0" x2="${p}" y2="${h}" stroke="var(--map-grid)" stroke-width="1"/>`; }
        for (let y = Math.floor(br.lat / step) * step; y <= tl.lat; y += step) { const p = this.proj(y, 0).y; g += `<line x1="0" y1="${p}" x2="${w}" y2="${p}" stroke="var(--map-grid)" stroke-width="1"/>`; }
        const mode = this.o.plain ? 'pin' : this.mode();
        if (mode === 'pin') groupHosp(this.items, 'sgg').forEach(gr => { const p = this.proj(gr.lat - .004, gr.lng); if (p.x < -50 || p.x > w + 50 || p.y < -20 || p.y > h + 20) return; g += `<text x="${p.x}" y="${p.y + 26}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--map-text)" font-family="IBM Plex Sans KR, sans-serif">${esc(gr.label)}</text>`; });
        this.bg.innerHTML = g; const pts = this.routePts.map(p => this.proj(p.lat!, p.lng!));
        this.rt.innerHTML = (pts.length > 1 ? `<polyline points="${pts.map(p => `${p.x},${p.y - 12}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round" opacity=".85"/>` : '')
            + this.tracks.map(t => { const q = t.pts.map(p => this.proj(p.lat, p.lng)); const far = t.pts.filter(p => p.kind === 'far' && p.hosp).map(p => { const a = this.proj(p.lat, p.lng), b = this.proj(p.hosp!.lat, p.hosp!.lng); return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--danger)" stroke-width="2" stroke-dasharray="4 4"/>`; }).join('');
                return (q.length > 1 ? `<polyline points="${q.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${t.color}" stroke-width="3" stroke-linejoin="round" opacity=".8"/>` : '') + far; }).join('');
        this.pins.innerHTML = ''; const frag = document.createDocumentFragment(); const inb = (p: { x: number; y: number }) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
        setMapView(this.items.filter(it => inb(this.proj(it.lat!, it.lng!))).length, mode);
        const pinIt = (it: Hospital) => { const p = this.proj(it.lat!, it.lng!); if (p.x < -100 || p.x > w + 100 || p.y < -40 || p.y > h + 60) return; const wrap = document.createElement('div'); wrap.className = 'pm-pin'; wrap.style.left = p.x + 'px'; wrap.style.top = p.y + 'px'; const b = pinEl(it, this.o); b.onclick = () => this.onClick(it.id); wrap.appendChild(b); frag.appendChild(wrap); };
        if (mode === 'pin') [...this.items].sort((a, b) => (+(a.id === this.o.sel) - +(b.id === this.o.sel)) || (b.lat! - a.lat!)).forEach(pinIt);
        else {
            groupHosp(this.items, mode).forEach(gr => { const p = this.proj(gr.lat, gr.lng); if (p.x < -80 || p.x > w + 80 || p.y < -80 || p.y > h + 80) return; const wrap = document.createElement('div'); wrap.className = 'pm-cl'; wrap.style.left = p.x + 'px'; wrap.style.top = p.y + 'px'; wrap.appendChild(clusterEl(gr, mode, () => this.zoomGroup(gr, mode))); frag.appendChild(wrap); });
            this.items.filter(it => it.id === this.o.sel || this.o.route.includes(it.id)).forEach(pinIt);
        }
        const put = (lat: number, lng: number, el: HTMLElement) => { const q = this.proj(lat, lng); const w2 = document.createElement('div'); w2.className = 'pm-tk'; w2.style.left = q.x + 'px'; w2.style.top = q.y + 'px'; w2.appendChild(el); frag.appendChild(w2); };
        if (this.me) put(this.me.lat, this.me.lng, meEl(this.me.acc)); if (this.st && this.st.kind !== 'here') put(this.st.lat, this.st.lng, startEl(this.st));
        this.tracks.forEach(t => t.pts.forEach((p, i) => { const q = this.proj(p.lat, p.lng); const wrap = document.createElement('div'); wrap.className = 'pm-tk'; wrap.style.left = q.x + 'px'; wrap.style.top = q.y + 'px'; wrap.appendChild(trackEl(p, t.color, i + 1, this.onTrack)); frag.appendChild(wrap); }));
        this.pins.appendChild(frag);
    }
}

/* ---------------- 카카오맵 ---------------- */
class KakaoMap implements MapAdapter {
    sts: any[] = [];
    drawStart(st: StartMark | null, me: { lat: number; lng: number; acc?: number } | null) {
        this.sts.forEach(v => v.setMap(null)); this.sts = []; const LL = (a: number, c: number) => new kakao.maps.LatLng(a, c);
        const add = (lat: number, lng: number, el: HTMLElement, z: number) => { const ov = new kakao.maps.CustomOverlay({ position: LL(lat, lng), content: el, xAnchor: .5, yAnchor: .5, zIndex: z }); ov.setMap(this.map); this.sts.push(ov); };
        if (me) add(me.lat, me.lng, meEl(me.acc), 30); if (st && st.kind !== 'here') add(st.lat, st.lng, startEl(st), 29);
    }
    tks: any[] = [];
    drawTrack(tracks: Track[], onClick: (id: string) => void) {
        this.tks.forEach(v => v.setMap(null)); this.tks = []; const LL = (a: number, c: number) => new kakao.maps.LatLng(a, c);
        tracks.forEach(t => {
            const col = realColor(t.color);
            if (t.pts.length > 1) { const l = new kakao.maps.Polyline({ path: t.pts.map(p => LL(p.lat, p.lng)), strokeWeight: 4, strokeColor: col, strokeOpacity: .8, strokeStyle: 'solid' }); l.setMap(this.map); this.tks.push(l); }
            t.pts.forEach((p, i) => {
                if (p.kind === 'far' && p.hosp) { const l = new kakao.maps.Polyline({ path: [LL(p.lat, p.lng), LL(p.hosp.lat, p.hosp.lng)], strokeWeight: 2, strokeColor: '#D92D20', strokeOpacity: .9, strokeStyle: 'shortdash' }); l.setMap(this.map); this.tks.push(l); }
                const ov = new kakao.maps.CustomOverlay({ position: LL(p.lat, p.lng), content: trackEl(p, t.color, i + 1, onClick), xAnchor: .5, yAnchor: .5, zIndex: p.sel ? 20 : 12, clickable: true }); ov.setMap(this.map); this.tks.push(ov);
            });
        });
    }
    map: any; ovs: any[] = []; line: any = null; items: Hospital[] = []; o: MarkOpt = { sel: null, route: [] }; onClick: (id: string) => void = () => { }; ro: ResizeObserver;
    constructor(el: HTMLElement) {
        el.innerHTML = ''; this.map = new kakao.maps.Map(el, { center: new kakao.maps.LatLng(37.5, 127.03), level: 8 });
        this.map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        this.ro = new ResizeObserver(() => this.map.relayout()); this.ro.observe(el);
        kakao.maps.event.addListener(this.map, 'idle', () => this.draw());
    }
    destroy() { this.ro.disconnect(); }
    mode() { const l = this.map.getLevel(); return l >= 10 ? 'sido' : l >= 7 ? 'sgg' : 'pin'; }
    setMarkers(items: Hospital[], o: MarkOpt, onClick: (id: string) => void) { this.items = items; this.o = o; this.onClick = onClick; this.draw(); }
    draw() {
        this.ovs.forEach(v => v.setMap(null)); this.ovs = []; const mode = this.o.plain ? 'pin' : this.mode(); const b = this.map.getBounds(); const LL = (a: any, c: any) => new kakao.maps.LatLng(a, c);
        setMapView(this.items.filter(h => b.contain(LL(h.lat, h.lng))).length, mode);
        const pin = (h: Hospital) => { const el = pinEl(h, this.o); el.onclick = () => this.onClick(h.id); const ov = new kakao.maps.CustomOverlay({ position: LL(h.lat, h.lng), content: el, xAnchor: .5, yAnchor: 1, zIndex: this.o.sel === h.id ? 10 : 3, clickable: true }); ov.setMap(this.map); this.ovs.push(ov); };
        if (mode === 'pin') { this.items.filter(h => h.id === this.o.sel || this.o.route.includes(h.id) || b.contain(LL(h.lat, h.lng))).slice(0, 800).forEach(pin); return; }
        groupHosp(this.items, mode).forEach(g => { const el = clusterEl(g, mode, () => this.zoomGroup(g, mode)); const ov = new kakao.maps.CustomOverlay({ position: LL(g.lat, g.lng), content: el, xAnchor: .5, yAnchor: .5, zIndex: 1, clickable: true }); ov.setMap(this.map); this.ovs.push(ov); });
        this.items.filter(h => h.id === this.o.sel || this.o.route.includes(h.id)).forEach(pin);
    }
    zoomGroup(g: Group, mode: string) {
        const lv = this.map.getLevel(); const bb = new kakao.maps.LatLngBounds(); g.list.forEach(h => bb.extend(new kakao.maps.LatLng(h.lat, h.lng)));
        if (g.list.length > 1) this.map.setBounds(bb, 80, 60, 60, 60);
        if (this.mode() === mode || g.list.length === 1) this.map.setLevel(Math.min(lv - 1, mode === 'sido' ? 9 : 6), { anchor: new kakao.maps.LatLng(g.lat, g.lng) });
    }
    drawRoute(pts: Hospital[]) {
        this.line && this.line.setMap(null); this.line = null;
        if (pts.length > 1) { this.line = new kakao.maps.Polyline({ path: pts.map(p => new kakao.maps.LatLng(p.lat, p.lng)), strokeWeight: 4, strokeColor: '#0B6E63', strokeOpacity: .85, strokeStyle: 'shortdash' }); this.line.setMap(this.map); }
    }
    fit(items: Hospital[]) { if (!items.length) return; const b = new kakao.maps.LatLngBounds(); items.forEach(h => b.extend(new kakao.maps.LatLng(h.lat, h.lng))); this.map.setBounds(b, 80, 60, 60, 60); }
    focus(h: Hospital) { this.map.setLevel(Math.min(this.map.getLevel(), 5)); this.map.panTo(new kakao.maps.LatLng(h.lat, h.lng)); }
}

/* ---------------- 네이버 지도 ---------------- */
class NaverMap implements MapAdapter {
    sts: any[] = [];
    drawStart(st: StartMark | null, me: { lat: number; lng: number; acc?: number } | null) {
        this.sts.forEach(v => v.setMap(null)); this.sts = []; const LL = (a: number, c: number) => new naver.maps.LatLng(a, c);
        const add = (lat: number, lng: number, el: HTMLElement, z: number) => { const box = document.createElement('div'); box.style.cssText = 'position:relative;width:0;height:0'; const inner = document.createElement('div'); inner.className = 'pm-tk'; inner.style.cssText = 'left:0;top:0'; inner.appendChild(el); box.appendChild(inner); this.sts.push(new naver.maps.Marker({ position: LL(lat, lng), map: this.map, zIndex: z, icon: { content: box, anchor: new naver.maps.Point(0, 0) } })); };
        if (me) add(me.lat, me.lng, meEl(me.acc), 30); if (st && st.kind !== 'here') add(st.lat, st.lng, startEl(st), 29);
    }
    tks: any[] = [];
    drawTrack(tracks: Track[], onClick: (id: string) => void) {
        this.tks.forEach(v => v.setMap(null)); this.tks = []; const LL = (a: number, c: number) => new naver.maps.LatLng(a, c);
        tracks.forEach(t => {
            const col = realColor(t.color);
            if (t.pts.length > 1) this.tks.push(new naver.maps.Polyline({ map: this.map, path: t.pts.map(p => LL(p.lat, p.lng)), strokeWeight: 4, strokeColor: col, strokeOpacity: .8 }));
            t.pts.forEach((p, i) => {
                if (p.kind === 'far' && p.hosp) this.tks.push(new naver.maps.Polyline({ map: this.map, path: [LL(p.lat, p.lng), LL(p.hosp.lat, p.hosp.lng)], strokeWeight: 2, strokeColor: '#D92D20', strokeOpacity: .9, strokeStyle: 'shortdash' }));
                const box = document.createElement('div'); box.style.cssText = 'position:relative;width:0;height:0'; const inner = document.createElement('div'); inner.className = 'pm-tk'; inner.style.cssText = 'left:0;top:0';
                const el = trackEl(p, t.color, i + 1, () => { }); inner.appendChild(el); box.appendChild(inner);
                const m = new naver.maps.Marker({ position: LL(p.lat, p.lng), map: this.map, zIndex: p.sel ? 20 : 12, icon: { content: box, anchor: new naver.maps.Point(0, 0) } });
                naver.maps.Event.addListener(m, 'click', () => onClick(p.id)); this.tks.push(m);
            });
        });
    }
    map: any; mks: any[] = []; line: any = null; items: Hospital[] = []; o: MarkOpt = { sel: null, route: [] }; onClick: (id: string) => void = () => { }; ro: ResizeObserver;
    constructor(el: HTMLElement) {
        el.innerHTML = '';
        this.map = new naver.maps.Map(el, { center: new naver.maps.LatLng(37.5, 127.03), zoom: 11, zoomControl: true, zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER } });
        this.ro = new ResizeObserver(() => this.map.setSize(new naver.maps.Size(el.clientWidth, el.clientHeight))); this.ro.observe(el);
        naver.maps.Event.addListener(this.map, 'idle', () => this.draw());
    }
    destroy() { this.ro.disconnect(); }
    mode() { const z = this.map.getZoom(); return z <= 9 ? 'sido' : z <= 12 ? 'sgg' : 'pin'; }
    setMarkers(items: Hospital[], o: MarkOpt, onClick: (id: string) => void) { this.items = items; this.o = o; this.onClick = onClick; this.draw(); }
    draw() {
        this.mks.forEach(m => m.setMap(null)); this.mks = []; const mode = this.o.plain ? 'pin' : this.mode(); const b = this.map.getBounds(); const LL = (a: any, c: any) => new naver.maps.LatLng(a, c);
        setMapView(this.items.filter(h => b.hasLatLng(LL(h.lat, h.lng))).length, mode);
        // 크기 0 인 상자에 넣고 CSS(.pm-pin/.pm-cl)로 위치를 맞춘다 (핀은 아래 끝, 묶음은 가운데가 좌표)
        const add = (pos: any, el: HTMLElement, cls: string, z: number, click: () => void) => {
            el.onclick = null;
            const box = document.createElement('div'); box.style.cssText = 'position:relative;width:0;height:0';
            const inner = document.createElement('div'); inner.className = cls; inner.style.cssText = 'left:0;top:0'; inner.appendChild(el); box.appendChild(inner);
            const m = new naver.maps.Marker({ position: pos, map: this.map, zIndex: z, icon: { content: box, anchor: new naver.maps.Point(0, 0) } });
            naver.maps.Event.addListener(m, 'click', click); this.mks.push(m);
        };
        const pin = (h: Hospital) => { const el = pinEl(h, this.o); add(LL(h.lat, h.lng), el, 'pm-pin', this.o.sel === h.id ? 10 : 3, () => this.onClick(h.id)); };
        if (mode === 'pin') { this.items.filter(h => h.id === this.o.sel || this.o.route.includes(h.id) || b.hasLatLng(LL(h.lat, h.lng))).slice(0, 800).forEach(pin); return; }
        groupHosp(this.items, mode).forEach(g => { const el = clusterEl(g, mode, () => { }); add(LL(g.lat, g.lng), el, 'pm-cl', 1, () => this.zoomGroup(g, mode)); });
        this.items.filter(h => h.id === this.o.sel || this.o.route.includes(h.id)).forEach(pin);
    }
    zoomGroup(g: Group, mode: string) {
        const z = this.map.getZoom();
        if (g.list.length > 1) this.fit(g.list);
        if (this.mode() === mode || g.list.length === 1) this.map.morph(new naver.maps.LatLng(g.lat, g.lng), Math.max(z + 1, mode === 'sido' ? 10 : 13));
    }
    drawRoute(pts: Hospital[]) {
        this.line && this.line.setMap(null); this.line = null;
        if (pts.length > 1) this.line = new naver.maps.Polyline({ map: this.map, path: pts.map(p => new naver.maps.LatLng(p.lat, p.lng)), strokeWeight: 4, strokeColor: '#0B6E63', strokeOpacity: .85, strokeStyle: 'shortdash' });
    }
    fit(items: Hospital[]) {
        if (!items.length) return; const la = items.map(h => h.lat!), ln = items.map(h => h.lng!);
        const bb = new naver.maps.LatLngBounds(new naver.maps.LatLng(Math.min(...la), Math.min(...ln)), new naver.maps.LatLng(Math.max(...la), Math.max(...ln)));
        this.map.fitBounds(bb, { top: 80, right: 60, bottom: 60, left: 60 });
    }
    focus(h: Hospital) { this.map.morph(new naver.maps.LatLng(h.lat, h.lng), Math.max(this.map.getZoom(), 15)); }
}

/** 지도 만들기: 선택한 지도가 준비되면 실제 지도, 아니면 미리보기 */
export function createMap(el: HTMLElement): MapAdapter {
    const p = provider();
    try {
        if (p === 'naver' && ready.naver) return new NaverMap(el);
        if (p === 'kakao' && ready.kakao) return new KakaoMap(el);
    } catch { /* 실패하면 미리보기 */ }
    const name = p === 'naver' ? '네이버 지도' : '카카오맵';
    return new PreviewMap(el, keyOf(p) ? `미리보기 지도 · ${name}을(를) 불러오지 못했습니다 (키·등록 도메인 확인)` : `미리보기 지도 · 좌표 기준 배치 (.env 에 ${p === 'naver' ? 'NAVER_MAP_CLIENT_ID' : 'KAKAO_JS_KEY'} 를 넣으면 실제 지도)`);
}
