// 앱 전체 공용 상태: 로그인 사용자·권한, 공통 기준(meta), 병원 목록, 알림(토스트)
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from './api';
import type { HospitalItem, Me, Meta, Op } from './types';

interface Toast {
    id: number;
    text: string;
    bad?: boolean;
}

interface Store {
    me: Me | null;
    meta: Meta | null;
    hospitals: HospitalItem[];
    booting: boolean;
    setMe: (m: Me | null) => void;
    refreshMeta: () => Promise<void>;
    refreshHospitals: () => Promise<void>;
    patchHospital: (h: Partial<HospitalItem> & { id: number }) => void;
    can: (feature: string, op: Op, ownerId?: number | null) => boolean;
    toast: (text: string, bad?: boolean) => void;
    toasts: Toast[];
    logout: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
    const s = useContext(Ctx);
    if (!s) throw new Error('StoreProvider 밖에서 사용됨');
    return s;
};

const SCOPED = ['hospital', 'eval', 'activity', 'conv'];

export function StoreProvider({ children }: { children: ReactNode }) {
    const [me, setMe] = useState<Me | null>(null);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
    const [booting, setBooting] = useState(true);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const toast = useCallback((text: string, bad = false) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t.slice(-2), { id, text, bad }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), bad ? 4500 : 2800);
    }, []);

    const refreshMeta = useCallback(async () => setMeta(await api.get<Meta>('/meta')), []);
    const refreshHospitals = useCallback(async () => {
        setHospitals(await api.get<HospitalItem[]>('/hospitals'));
    }, []);
    const patchHospital = useCallback((h: Partial<HospitalItem> & { id: number }) => {
        setHospitals((list) => {
            const i = list.findIndex((x) => x.id === h.id);
            if (i < 0) return [...list, h as HospitalItem];
            const next = list.slice();
            next[i] = { ...next[i], ...h };
            return next;
        });
    }, []);

    // 첫 진입: 로그인 상태 확인
    useEffect(() => {
        api.get<Me | { user: null }>('/me')
            .then((r) => setMe(r.user ? (r as Me) : null))
            .catch(() => setMe(null))
            .finally(() => setBooting(false));
    }, []);

    // 로그인되면 공통 기준 + 병원 목록 불러오기
    useEffect(() => {
        if (!me) {
            setMeta(null);
            setHospitals([]);
            return;
        }
        void refreshMeta();
        if (me.perms.hospital?.read) void refreshHospitals();
    }, [me, refreshMeta, refreshHospitals]);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            setMe(null);
            toast('로그인이 풀렸습니다. 다시 로그인하세요', true);
        });
    }, [toast]);

    /** 화면용 권한 확인. 서버도 같은 규칙으로 다시 검사한다. */
    const can = useCallback(
        (feature: string, op: Op, ownerId?: number | null) => {
            if (!me) return false;
            if (!me.perms[feature]?.[op]) return false;
            if (ownerId !== undefined && me.scope === 'own' && SCOPED.includes(feature) && ['create', 'update', 'delete'].includes(op)) {
                return ownerId === me.user.id;
            }
            return true;
        },
        [me],
    );

    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } finally {
            setMe(null);
        }
    }, []);

    const value = useMemo(
        () => ({ me, meta, hospitals, booting, setMe, refreshMeta, refreshHospitals, patchHospital, can, toast, toasts, logout }),
        [me, meta, hospitals, booting, refreshMeta, refreshHospitals, patchHospital, can, toast, toasts, logout],
    );
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---------- 화면 공통 도우미 ----------
export const useLookups = () => {
    const { meta } = useStore();
    return useMemo(() => {
        const stage = new Map(meta?.stages.map((s) => [s.id, s]));
        const user = new Map(meta?.users.map((u) => [u.id, u]));
        const cat = new Map(meta?.categories.map((c) => [c.id, c]));
        const comp = new Map(meta?.competitors.map((c) => [c.id, c]));
        const initialStage = meta?.stages.find((s) => s.kind === 'main');
        return { stage, user, cat, comp, initialStage };
    }, [meta]);
};

/** 리드 종합 등급: 합계 0~15점 → 11~15 상 / 6~10 중 / 0~5 하 (서버 config/crm.php 와 같은 기준) */
export const gradeOf = (sum: number | null, g = { 상: 11, 중: 6 }): '상' | '중' | '하' | '미평가' =>
    sum === null ? '미평가' : sum >= g.상 ? '상' : sum >= g.중 ? '중' : '하';
