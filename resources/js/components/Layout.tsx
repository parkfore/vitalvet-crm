import { NavLink, Outlet, useNavigate } from 'react-router';
import { useStore } from '../lib/store';
import { Icon } from './ui';

export const NAV = [
    { to: '/', label: '대시보드', icon: 'dash', feature: 'dash', end: true },
    { to: '/hospitals', label: '병원 관리', icon: 'hospital', feature: 'hospital' },
    { to: '/categories', label: '카테고리', icon: 'tag', feature: 'category' },
    { to: '/history', label: '변경 이력', icon: 'history', feature: 'history' },
    { to: '/users', label: '사용자·권한', icon: 'users', feature: 'users' },
    { to: '/settings', label: '설정', icon: 'settings', feature: 'settings' },
];

/** 로그아웃하면 첫 화면 주소로 (다음 로그인 사용자가 권한 없는 화면에 머물지 않게) */
function useSignOut() {
    const { logout } = useStore();
    const nav = useNavigate();
    return () => {
        void logout().then(() => nav('/', { replace: true }));
    };
}

export default function Layout() {
    const { me, can } = useStore();
    const signOut = useSignOut();
    const items = NAV.filter((n) => can(n.feature, 'view'));
    const tabs = items.slice(0, 4);

    return (
        <div className="app">
            <aside className="side">
                <div className="brand">
                    <span className="brand-mark">
                        <Icon name="pulse" className="size-5" />
                    </span>
                    <div>
                        <b>VitalVET CRM</b>
                        <small>영업 관리</small>
                    </div>
                </div>
                <nav className="grid gap-0.5">
                    {items.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.end} className="nav-btn">
                            <Icon name={n.icon} />
                            {n.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="user-box">
                    <span className="av">{me?.user.name.slice(0, 1)}</span>
                    <NavLink to="/account" className="min-w-0 flex-1" title="내 정보 · 비밀번호 변경">
                        <b className="block truncate text-[13.5px]">{me?.user.name}</b>
                        <small className="muted block truncate text-[12px]">
                            {me?.user.role_name}
                            {me?.scope === 'own' && ' · 담당만 수정'}
                        </small>
                    </NavLink>
                    <button className="icon-btn" onClick={signOut} aria-label="로그아웃" title="로그아웃">
                        <Icon name="logout" />
                    </button>
                </div>
            </aside>

            <main className="main">
                <Outlet />
            </main>

            <nav className="tabbar">
                {tabs.map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end}>
                        <Icon name={n.icon} />
                        {n.label}
                    </NavLink>
                ))}
                <NavLink to="/more">
                    <Icon name="more" />
                    더보기
                </NavLink>
            </nav>
        </div>
    );
}

/** 모바일 '더보기' 화면 */
export function More() {
    const { me, can } = useStore();
    const signOut = useSignOut();
    const items = NAV.filter((n) => can(n.feature, 'view')).slice(4);
    return (
        <>
            <div className="page-head">
                <div>
                    <h1>더보기</h1>
                    <p>
                        {me?.user.name} · {me?.user.role_name}
                    </p>
                </div>
            </div>
            <div className="panel grid gap-1 !p-2">
                {items.map((n) => (
                    <NavLink key={n.to} to={n.to} className="nav-btn">
                        <Icon name={n.icon} />
                        {n.label}
                    </NavLink>
                ))}
                <NavLink to="/account" className="nav-btn">
                    <Icon name="users" />
                    내 정보 · 비밀번호
                </NavLink>
                <button className="nav-btn text-left" onClick={signOut}>
                    <Icon name="logout" />
                    로그아웃
                </button>
            </div>
        </>
    );
}
