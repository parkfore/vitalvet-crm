// 공용 화면 부품: 아이콘, 모달, 확인창, 배지
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLookups, useStore } from '../lib/store';
import type { Follow, Grade } from '../lib/types';

// ---------- 아이콘 ----------
const P: Record<string, string> = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    dash: 'M4 13h6V4H4zm10 7h6V11h-6zM4 20h6v-4H4zm10-11h6V4h-6z',
    hospital: 'M4 21V6l8-3 8 3v15M9 21v-5h6v5M10 9h4M12 7v4',
    users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    plus: 'M12 5v14M5 12h14',
    x: 'M18 6 6 18M6 6l12 12',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    check: 'M20 6 9 17l-5-5',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
    up: 'M18 15l-6-6-6 6',
    down: 'M6 9l6 6 6-6',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    pulse: 'M2 13h4l2-5 4 10 3-7 2 2h5',
};
export function Icon({ name, className }: { name: keyof typeof P | string; className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
            <path d={P[name] ?? ''} />
        </svg>
    );
}

// ---------- 모달 ----------
export function Modal({
    title,
    sub,
    onClose,
    children,
    footer,
    size,
}: {
    title: ReactNode;
    sub?: ReactNode;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'wide';
}) {
    useEsc(onClose);
    return (
        <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`modal ${size ?? ''}`} role="dialog" aria-modal="true">
                <header>
                    <div>
                        <h2>{title}</h2>
                        {sub && <p className="hint mt-0.5">{sub}</p>}
                    </div>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
                        <Icon name="x" />
                    </button>
                </header>
                <div className="body">{children}</div>
                {footer && <footer>{footer}</footer>}
            </div>
        </div>
    );
}

export function useEsc(fn: () => void) {
    const ref = useRef(fn);
    ref.current = fn;
    useEffect(() => {
        const h = (e: KeyboardEvent) => e.key === 'Escape' && ref.current();
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);
}

// ---------- 확인창 (window.confirm 대신) ----------
interface ConfirmOpts {
    title: string;
    body?: ReactNode;
    ok?: string;
    danger?: boolean;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
    const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
    const done = (v: boolean) => {
        state?.resolve(v);
        setState(null);
    };
    return (
        <ConfirmCtx.Provider value={ask}>
            {children}
            {state && (
                <Modal
                    size="sm"
                    title={state.title}
                    onClose={() => done(false)}
                    footer={
                        <>
                            <button className="btn" onClick={() => done(false)}>
                                취소
                            </button>
                            <button className={`btn ${state.danger ? 'danger solid' : 'primary'}`} onClick={() => done(true)} autoFocus>
                                {state.ok ?? '확인'}
                            </button>
                        </>
                    }
                >
                    <div className="text-[14px] leading-relaxed">{state.body}</div>
                </Modal>
            )}
        </ConfirmCtx.Provider>
    );
}

// ---------- 토스트 ----------
export function Toasts() {
    const { toasts } = useStore();
    return (
        <div className="toasts" role="status" aria-live="polite">
            {toasts.map((t) => (
                <div key={t.id} className={`toast ${t.bad ? 'bad' : ''}`}>
                    {t.text}
                </div>
            ))}
        </div>
    );
}

// ---------- 배지 ----------
export function StageBadge({ id }: { id: number }) {
    const s = useLookups().stage.get(id);
    if (!s) return <span className="badge">-</span>;
    return (
        <span className="badge stage" style={{ '--c': s.color } as React.CSSProperties}>
            {s.name}
        </span>
    );
}
export function PreBadge({ type }: { type: string | null }) {
    const { meta } = useStore();
    const p = type ? meta?.pre_types[type] : null;
    if (!p) return null;
    return (
        <span className="badge tint" style={{ '--c': p[1] } as React.CSSProperties}>
            {p[0]}
        </span>
    );
}
export function GradeBadge({ grade, sum }: { grade: Grade | null; sum?: number | null }) {
    if (!grade) return <span className="muted">-</span>;
    if (grade === '미평가') return <span className="badge">미평가</span>;
    return (
        <span className={`badge g-${grade}`}>
            {grade}
            {sum != null && <small className="font-normal opacity-80">{sum}/15</small>}
        </span>
    );
}
export function FollowBadge({ f }: { f: Follow | null }) {
    if (!f || f === '없음') return null;
    return <span className={`badge f-${f}`}>{f}</span>;
}
export function CatChips({ ids }: { ids: number[] }) {
    const { cat } = useLookups();
    if (!ids.length) return <span className="chip none">미분류</span>;
    return (
        <span className="chips">
            {ids.map((id) => {
                const c = cat.get(id);
                return c ? (
                    <span key={id} className="chip" style={{ '--cc': c.color } as React.CSSProperties}>
                        <i />
                        {c.name}
                    </span>
                ) : null;
            })}
        </span>
    );
}

export function Field({ label, req, hint, children, className }: { label: ReactNode; req?: boolean; hint?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <label className={`fld ${className ?? ''}`}>
            <span>
                {label} {req && <em>*</em>} {hint && <small>· {hint}</small>}
            </span>
            {children}
        </label>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="empty">{children}</div>;
}

export function Loading() {
    return <div className="empty">불러오는 중…</div>;
}

/** 전화번호 입력 시 하이픈 자동 */
export function fmtPhone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.startsWith('02')) {
        if (d.length <= 2) return d;
        if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
        if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
        return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
    }
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
