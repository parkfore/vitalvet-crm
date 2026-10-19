// 화면 틀: 로그인 여부, 메뉴별 화면, 서랍·창·알림
import { useEffect } from 'react';
import { installChartTip } from './components/charts';
import { Drawer, closeDetail, RegisterModal } from './components/HospitalDrawer';
import { ImportModal } from './components/ImportModal';
import { GoalEditModal } from './components/Goals';
import { BellButton, NotifModal, notifItems, useBrowserNotify } from './components/Notifications';
import { MoreMenu, Nav, Tabbar, visMenus } from './components/Layout';
import { DialogLayer, Locked, Modal, ToastLayer } from './components/ui';
import { FNAME, type Feature } from './lib/constants';
import { canRead, cur } from './lib/domain';
import { dialog, notify, pushRoute, reloadState, S, syncBusy, ui, useStore } from './lib/store';
import { Attendance, AttFormModal, AttViewModal } from './pages/Attendance';
import { Categories } from './pages/Categories';
import { CompFormModal, Competitors, CompViewModal } from './pages/Competitors';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Hospitals } from './pages/Hospitals';
import { Login, PasswordModal } from './pages/Login';
import { MapView } from './pages/MapView';
import { QuickActModal, Report, RepViewModal } from './pages/Report';
import { Settings, StageDeleteModal } from './pages/Settings';
import { Team, TeamViewModal } from './pages/Team';
import { Today } from './pages/Today';
import { UserModal, Users } from './pages/Users';

const VIEWS: Record<string, [() => React.ReactElement, Feature]> = {
    today: [Today, 'myday'], dash: [Dashboard, 'dash'], list: [Hospitals, 'hospital'], map: [MapView, 'map'], report: [Report, 'report'], team: [Team, 'team'],
    attend: [Attendance, 'attendance'], cat: [Categories, 'category'], comp: [Competitors, 'competitor'], history: [History, 'history'], users: [Users, 'users'], settings: [Settings, 'settings'],
};

function ModalLayer() {
    const m = ui.modal; if (!m) return <div id="modalLayer" />;
    const close = () => { ui.modal = null; notify(); };
    const body = (() => {
        switch (m.type) {
            case 'register': return <RegisterModal />;
            case 'user': return <UserModal f0={m.f} />;
            case 'repView': return <RepViewModal key={m.id} id={m.id} />;
            case 'quickAct': return <QuickActModal f0={m.f} />;
            case 'att': return <AttFormModal self={m.self} f0={m.f} />;
            case 'attView': return <AttViewModal id={m.id} />;
            case 'stDel': return <StageDeleteModal id={m.id} />;
            case 'comp': return <CompFormModal f0={m.f} />;
            case 'compView': return <CompViewModal id={m.id} />;
            case 'teamView': return <TeamViewModal id={m.id} />;
            case 'goalEdit': return <GoalEditModal />;
            case 'more': return <MoreMenu />;
            case 'pw': return <PasswordModal />;
            case 'import': return <ImportModal tab0={m.tab} />;
            case 'notif': return <NotifModal />;
            default: return null;
        }
    })();
    return <div id="modalLayer">{body}</div>;
}

export function App() {
    useStore();
    useEffect(() => {
        installChartTip();
        // Esc: 창 → 서랍 순서로 닫기 (확인 창이 떠 있으면 그대로)
        const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape' || dialog || document.querySelector('#addrLayer') || ui.modal?.busy) return; if (ui.modal) { ui.modal = null; notify(); } else if (ui.detailId) closeDetail(); };
        document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
    }, []);
    // 주소창 경로와 메뉴 맞추기
    useEffect(() => { if (S && location.pathname !== '/' + ui.view) history.replaceState(null, '', '/' + ui.view); });
    useEffect(() => { pushRoute(); });
    useBrowserNotify(S && cur() ? notifItems() : []);
    // 5분마다 새 데이터 받기 (알림·다른 사람 변경 반영). 창이나 서랍이 열려 있으면 건너뜀
    useEffect(() => { const t = setInterval(() => { if (S && document.visibilityState === 'visible' && !ui.modal && !ui.detailId && !syncBusy) reloadState(false); }, 5 * 60e3); return () => clearInterval(t); }, []);

    if (!S) return <><Login /><ToastLayer /><DialogLayer /></>;
    const vm = visMenus(); if (!vm.some(m => m[0] === ui.view)) ui.view = vm[0]?.[0] || 'none';
    const V = VIEWS[ui.view]; const Page = V?.[0];
    return <>
        <div className="app"><Nav />
            <main className={`main ${ui.view === 'map' ? 'map-mode' : ''}`} id="main">
                {!V ? <div className="lock"><b>볼 수 있는 메뉴가 없습니다</b><span>관리자에게 권한을 요청하세요.</span></div>
                    : canRead(V[1]) ? <Page /> : <><div className="page-head"><h1>{FNAME[V[1]]}</h1></div><section className="panel"><Locked f={V[1]} /></section></>}
            </main><BellButton cls="floating" /><Tabbar /></div>
        <Drawer /><ModalLayer /><DialogLayer /><ToastLayer />
    </>;
}
