import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { StoreProvider, useStore } from './lib/store';
import Layout, { More, NAV } from './components/Layout';
import { ConfirmProvider, Loading, Toasts } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Hospitals from './pages/Hospitals';
import Categories from './pages/Categories';
import History from './pages/History';
import Users, { NoAccess } from './pages/Users';
import Settings from './pages/Settings';
import Account from './pages/Account';
import SetupCheck from './pages/SetupCheck';

/** 메뉴 권한(표시)이 없으면 첫 화면으로. 서버도 API마다 다시 검사한다. */
function Guard({ feature, children }: { feature: string; children: ReactNode }) {
    const { can } = useStore();
    return can(feature, 'view') ? children : <Navigate to="/" replace />;
}

/** 첫 화면: 대시보드 권한이 없으면 볼 수 있는 첫 메뉴로 */
function Home() {
    const { can } = useStore();
    if (can('dash', 'view')) return <Dashboard />;
    const first = NAV.find((n) => can(n.feature, 'view'));
    return first ? <Navigate to={first.to} replace /> : <NoAccess />;
}

function Root() {
    const { me, booting } = useStore();
    if (booting) return <Loading />;
    if (!me) return <Login />;
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="hospitals" element={<Guard feature="hospital"><Hospitals /></Guard>} />
                <Route path="categories" element={<Guard feature="category"><Categories /></Guard>} />
                <Route path="history" element={<Guard feature="history"><History /></Guard>} />
                <Route path="users" element={<Guard feature="users"><Users /></Guard>} />
                <Route path="settings" element={<Guard feature="settings"><Settings /></Guard>} />
                <Route path="account" element={<Account />} />
                <Route path="more" element={<More />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                {/* 서버 연결 확인 화면 (로그인 없이) */}
                <Route path="/setup-check" element={<SetupCheck />} />
                <Route
                    path="*"
                    element={
                        <StoreProvider>
                            <ConfirmProvider>
                                <Root />
                                <Toasts />
                            </ConfirmProvider>
                        </StoreProvider>
                    }
                />
            </Routes>
        </BrowserRouter>
    </StrictMode>,
);
