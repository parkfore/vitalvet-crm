import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, errMsg } from '../lib/api';
import { useStore } from '../lib/store';
import type { Category } from '../lib/types';
import { Empty, Field, Icon, Loading, Modal, useConfirm } from '../components/ui';

export default function Categories() {
    const { meta, hospitals, can, toast, refreshMeta, refreshHospitals } = useStore();
    const confirm = useConfirm();
    const nav = useNavigate();
    const [edit, setEdit] = useState<Category | 'new' | null>(null);
    const counts = useMemo(() => {
        const m = new Map<number, number>();
        hospitals.forEach((h) => h.category_ids.forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)));
        return m;
    }, [hospitals]);
    if (!meta) return <Loading />;
    const none = hospitals.filter((h) => !h.category_ids.length).length;

    const remove = async (c: Category) => {
        const n = counts.get(c.id) ?? 0;
        if (!(await confirm({ title: '카테고리 삭제', body: <>‘{c.name}’을(를) 삭제할까요?{n ? <> 병원 {n}곳에서 빠집니다 (병원은 그대로).</> : null}</>, ok: '삭제', danger: true }))) return;
        try {
            await api.del(`/categories/${c.id}`);
            toast('카테고리를 삭제했습니다');
            await Promise.all([refreshMeta(), refreshHospitals()]);
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    return (
        <>
            <div className="page-head">
                <div>
                    <h1>카테고리</h1>
                    <p>병원을 묶어 보는 분류. 한 병원에 여러 개를 붙일 수 있습니다</p>
                </div>
                {can('category', 'create') && (
                    <button className="btn primary" onClick={() => setEdit('new')}>
                        <Icon name="plus" /> 카테고리 추가
                    </button>
                )}
            </div>
            <div className="grid gap-2">
                {meta.categories.map((c) => (
                    <div key={c.id} className="panel flex items-center gap-3 !py-3">
                        <span className="size-4 flex-none rounded" style={{ background: c.color }} />
                        <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/hospitals?cat=${c.id}`)}>
                            <b>{c.name}</b>
                            <span className="h-sub block">{c.description || '설명 없음'}</span>
                        </button>
                        <span className="badge">{counts.get(c.id) ?? 0}곳</span>
                        {can('category', 'update') && (
                            <button className="icon-btn" onClick={() => setEdit(c)} aria-label="수정">
                                <Icon name="edit" />
                            </button>
                        )}
                        {can('category', 'delete') && (
                            <button className="icon-btn" onClick={() => void remove(c)} aria-label="삭제">
                                <Icon name="trash" />
                            </button>
                        )}
                    </div>
                ))}
                {!meta.categories.length && <Empty>카테고리가 없습니다</Empty>}
                <button className="panel flex items-center gap-3 !py-3 text-left" onClick={() => nav('/hospitals?cat=none')}>
                    <span className="size-4 flex-none rounded border border-dashed border-muted" />
                    <b className="flex-1">미분류</b>
                    <span className="badge">{none}곳</span>
                </button>
            </div>
            {edit && (
                <CatModal
                    c={edit === 'new' ? null : edit}
                    onClose={() => setEdit(null)}
                    onSaved={async (msg) => {
                        setEdit(null);
                        toast(msg);
                        await refreshMeta();
                    }}
                />
            )}
        </>
    );
}

function CatModal({ c, onClose, onSaved }: { c: Category | null; onClose: () => void; onSaved: (m: string) => void }) {
    const { meta } = useStore();
    const [f, setF] = useState({ name: c?.name ?? '', description: c?.description ?? '', color: c?.color ?? meta?.category_colors[0] ?? '#0B6E63' });
    const [err, setErr] = useState('');
    const save = async () => {
        setErr('');
        try {
            if (c) await api.put(`/categories/${c.id}`, f);
            else await api.post('/categories', f);
            onSaved(c ? '카테고리를 저장했습니다' : '카테고리를 추가했습니다');
        } catch (e) {
            setErr(errMsg(e));
        }
    };
    return (
        <Modal
            size="sm"
            title={c ? '카테고리 수정' : '카테고리 추가'}
            onClose={onClose}
            footer={
                <>
                    {err && <span className="err mr-auto self-center">{err}</span>}
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button className="btn primary" onClick={() => void save()}>
                        저장
                    </button>
                </>
            }
        >
            <div className="grid gap-3">
                <Field label="이름" req>
                    <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} autoFocus />
                </Field>
                <Field label="설명">
                    <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={200} />
                </Field>
                <div className="fld">
                    <span>색상</span>
                    <div className="flex flex-wrap gap-2">
                        {meta?.category_colors.map((col) => (
                            <button
                                key={col}
                                type="button"
                                className="size-8 rounded-lg border-2"
                                style={{ background: col, borderColor: f.color === col ? 'var(--color-ink)' : 'transparent' }}
                                onClick={() => setF({ ...f, color: col })}
                                aria-label={col}
                                aria-pressed={f.color === col}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
