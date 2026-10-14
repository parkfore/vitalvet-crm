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
import { can } from './lib/domain';
import { startMaps } from './lib/maps';
import { loadState, notify, ui } from './lib/store';

const PATHS = ['today', 'dash', 'list', 'map', 'report', 'team', 'attend', 'cat', 'comp', 'history', 'users', 'settings'];

async function boot() {
    const root = createRoot(document.getElementById('root')!);
    root.render(<div className="empty" style={{ marginTop: '20vh' }}>불러오는 중…</div>);
    try {
        const me = await api<{ user: unknown }>('GET', '/api/me');
        if (me?.user) {
            await loadState();
            const p = location.pathname.slice(1);
            ui.view = PATHS.includes(p) ? p : can('myday', 'view') ? 'today' : 'dash';
            startMaps();
        }
    } catch (e: any) {
        if (e.status !== 401) {
            root.render(<div className="lock" style={{ marginTop: '20vh' }}><b>서버에 연결하지 못했습니다</b><span>{e.message}</span><button className="btn" onClick={() => location.reload()}>다시 시도</button></div>);
            return;
        }
    }
    root.render(<App />);
    window.addEventListener('popstate', () => { const p = location.pathname.slice(1); if (PATHS.includes(p)) { ui.view = p; notify(); } });
}
boot();
