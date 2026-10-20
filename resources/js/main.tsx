/*
 * VitalVET 영업 CRM 화면 시작점 (React)
 *
 * 폴더 구조
 *   lib/        데이터·규칙 (store: 상태와 서버 저장, domain: 업무 규칙·계산, maps: 지도, api: 서버 호출)
 *   components/ 여러 화면이 함께 쓰는 조각 (병원 상세 서랍, 차트, 배지 등)
 *   pages/      메뉴별 화면
 */
import { createRoot } from 'react-dom/client';
import '../css/crm.css';
import { App } from './App';
import { api } from './lib/api';
import { installErrorReporter } from './lib/errors';
import { can, cur } from './lib/domain';
import { startMaps } from './lib/maps';
import { checkFresh, loadState, notify, S, ui } from './lib/store';
import { openDetail } from './components/HospitalDrawer';
import { openRep } from './pages/Report';
import { pushRefresh } from './lib/push';

const PATHS = ['today', 'dash', 'list', 'map', 'report', 'team', 'attend', 'cat', 'comp', 'history', 'users', 'settings'];

installErrorReporter();

async function boot() {
    const root = createRoot(document.getElementById('root')!);
    root.render(<div className="empty" style={{ marginTop: '20vh' }}>불러오는 중…</div>);
    try {
        const me = await api<{ user: unknown }>('GET', '/api/me');
        if (me?.user) {
            await loadState();
            const p = location.pathname.slice(1);
            ui.view = PATHS.includes(p) ? p : can('myday', 'view') ? 'today' : 'dash';
            // 병원 관리: 관리자가 아니면 '내 담당'부터 보이게
            if (cur()?.roleId !== 'r_admin') ui.list.owner = '__me';
            startMaps();
            const link = location.search; if (link) setTimeout(() => openLink(location.pathname + link), 0);
            pushRefresh();
        }
    } catch (e: any) {
        if (e.status !== 401) {
            root.render(<div className="lock" style={{ marginTop: '20vh' }}><b>서버에 연결하지 못했습니다</b><span>{e.message}</span><button className="btn" onClick={() => location.reload()}>다시 시도</button></div>);
            return;
        }
    }
    root.render(<App />);
    // 알림을 눌러 열린 경우: 서비스 워커가 보내는 이동 요청
    navigator.serviceWorker?.addEventListener('message', e => {
        if (e.data?.type === 'vv-nav') checkFresh(true).then(() => openLink(e.data.url));
        if (e.data?.type === 'vv-resubscribe') pushRefresh();
    });
    window.addEventListener('popstate', () => { const p = location.pathname.slice(1); if (PATHS.includes(p)) { ui.view = p; notify(); } });
}
/** 알림의 주소로 이동: /report?rep=… · /list?h=… · /users?tab=errors · /today?coach=1 · ?notif=1 */
function openLink(url: string) {
    if (!S) return;
    const u = new URL(url, location.origin); const p = u.pathname.slice(1); const q = u.searchParams;
    if (PATHS.includes(p)) ui.view = p;
    if (q.get('tab')) ui.usersTab = q.get('tab')!;
    if (q.get('track')) { ui.map.tab = 'track'; ui.track.user = q.get('u') || ''; ui.track.date = q.get('d') || ''; ui.track.sel = ''; }
    notify();
    setTimeout(() => {
        if (q.get('h')) openDetail(q.get('h')!);
        else if (q.get('rep')) openRep(q.get('rep')!);
        else if (q.get('notif')) { ui.modal = { type: 'notif' }; notify(); }
        else if (q.get('coach')) document.getElementById('coachPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
}

boot();
