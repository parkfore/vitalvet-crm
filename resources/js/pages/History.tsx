import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';
import { useStore } from '../lib/store';
import type { AuditItem } from '../lib/types';
import { AuditList } from '../components/HospitalDrawer';
import { Empty, Icon, Loading } from '../components/ui';

interface Page {
    items: AuditItem[];
    total: number;
    page: number;
    last_page: number;
}
const ENTITY: [string, string][] = [
    ['', '전체 대상'],
    ['hospital', '병원'],
    ['category', '카테고리'],
    ['user', '사용자'],
    ['role', '역할'],
    ['stage', '영업 단계'],
    ['settings', '설정'],
];

export default function History() {
    const { meta, toast } = useStore();
    const [f, setF] = useState({ entity: '', action: '', actor_id: '', q: '' });
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Page | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setF((x) => ({ ...x, q })), 300);
        return () => clearTimeout(t);
    }, [q]);
    useEffect(() => setPage(1), [f]);
    useEffect(() => {
        setData(null);
        const p = new URLSearchParams({ page: String(page) });
        Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
        api.get<Page>(`/audit-logs?${p}`).then(setData).catch((e) => toast(errMsg(e), true));
    }, [f, page, toast]);

    return (
        <>
            <div className="page-head">
                <div>
                    <h1>변경 이력</h1>
                    <p>누가 · 언제 · 무엇을 바꿨는지. 이력은 지울 수 없습니다{data && ` · ${data.total.toLocaleString()}건`}</p>
                </div>
            </div>
            <div className="toolbar">
                <div className="search">
                    <Icon name="search" />
                    <input type="search" placeholder="대상 이름 · 항목" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" />
                </div>
                <select value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })} aria-label="대상">
                    {ENTITY.map(([k, l]) => (
                        <option key={k} value={k}>
                            {l}
                        </option>
                    ))}
                </select>
                <select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label="작업">
                    <option value="">전체 작업</option>
                    <option value="create">추가</option>
                    <option value="update">수정</option>
                    <option value="delete">삭제</option>
                    <option value="restore">복원</option>
                </select>
                <select value={f.actor_id} onChange={(e) => setF({ ...f, actor_id: e.target.value })} aria-label="작업자">
                    <option value="">전체 작업자</option>
                    {meta?.users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                    ))}
                </select>
            </div>
            <section className="panel">{!data ? <Loading /> : data.items.length ? <AuditList items={data.items} showTarget /> : <Empty>조건에 맞는 이력이 없습니다</Empty>}</section>
            {data && data.last_page > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                    <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        이전
                    </button>
                    <span className="mono muted">
                        {data.page} / {data.last_page}
                    </span>
                    <button className="btn sm" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>
                        다음
                    </button>
                </div>
            )}
        </>
    );
}
