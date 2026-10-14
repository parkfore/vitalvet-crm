import { useEffect, useState, type FormEvent } from 'react';
import { api, errMsg } from '../lib/api';
import { useStore } from '../lib/store';
import type { Stage } from '../lib/types';
import { Field, Icon, Loading, Modal, useConfirm } from '../components/ui';

export default function Settings() {
    const { meta, can, toast, refreshMeta, refreshHospitals, hospitals } = useStore();
    const confirm = useConfirm();
    const [edit, setEdit] = useState<Stage | 'new' | null>(null);
    const [removing, setRemoving] = useState<Stage | null>(null);
    const [goal, setGoal] = useState('');
    useEffect(() => setGoal(String(meta?.visit_goal ?? '')), [meta?.visit_goal]);
    if (!meta) return <Loading />;
    const ro = !can('settings', 'update');
    const count = (id: number) => hospitals.filter((h) => h.stage_id === id).length;

    const move = async (i: number, d: -1 | 1) => {
        const ids = meta.stages.map((s) => s.id);
        const j = i + d;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        try {
            await api.put('/stages/order', { ids });
            await refreshMeta();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    const askRemove = async (s: Stage) => {
        if (count(s.id)) return setRemoving(s);
        if (!(await confirm({ title: '단계 삭제', body: `‘${s.name}’ 단계를 삭제할까요?`, ok: '삭제', danger: true }))) return;
        try {
            await api.del(`/stages/${s.id}`);
            toast('단계를 삭제했습니다');
            await refreshMeta();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    const saveGoal = async () => {
        try {
            await api.put('/settings', { visit_goal: Number(goal) });
            toast('영업 목표를 저장했습니다');
            await refreshMeta();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    return (
        <>
            <div className="page-head">
                <div>
                    <h1>설정</h1>
                    <p>{ro ? '조회만 가능합니다' : '바꾼 내용은 변경 이력에 남습니다'}</p>
                </div>
            </div>
            <div className="grid gap-4">
                <section className="panel">
                    <h2>
                        영업 단계
                        <small>
                            {!ro && (
                                <button className="btn sm primary" onClick={() => setEdit('new')}>
                                    <Icon name="plus" /> 단계 추가
                                </button>
                            )}
                        </small>
                    </h2>
                    <p className="hint mb-3">위에서부터 진행 순서. 첫 번째 진행 단계가 등록 시 시작 단계입니다. 자동 전환은 앞으로만 진행하고 이탈 단계(보류·Lost)에서는 움직이지 않습니다.</p>
                    <div className="tbl-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>순서</th>
                                    <th>단계</th>
                                    <th>구분</th>
                                    <th>자동 전환</th>
                                    <th>병원</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {meta.stages.map((s, i) => (
                                    <tr key={s.id}>
                                        <td className="whitespace-nowrap">
                                            {!ro && (
                                                <>
                                                    <button className="icon-btn" disabled={i === 0} onClick={() => void move(i, -1)} aria-label="위로">
                                                        <Icon name="up" />
                                                    </button>
                                                    <button className="icon-btn" disabled={i === meta.stages.length - 1} onClick={() => void move(i, 1)} aria-label="아래로">
                                                        <Icon name="down" />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge stage" style={{ '--c': s.color } as React.CSSProperties}>
                                                {s.name}
                                            </span>
                                        </td>
                                        <td>{s.kind === 'main' ? '진행' : <span className="badge warn">이탈</span>}</td>
                                        <td className="h-sub">{s.trigger ? meta.triggers[s.trigger] : '-'}</td>
                                        <td className="mono">{count(s.id)}</td>
                                        <td className="whitespace-nowrap text-right">
                                            {!ro && (
                                                <>
                                                    <button className="icon-btn" onClick={() => setEdit(s)} aria-label="수정">
                                                        <Icon name="edit" />
                                                    </button>
                                                    <button className="icon-btn" onClick={() => void askRemove(s)} aria-label="삭제">
                                                        <Icon name="trash" />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="grid2">
                    <CodeList grp="grade" title="병원 등급 목록" ro={ro} />
                    <CodeList grp="specialty" title="전문과 목록" ro={ro} />
                </div>

                <section className="panel">
                    <h2>영업 목표</h2>
                    <div className="flex items-end gap-2">
                        <Field label="영업사원 1인 일일 방문 목표 (곳)">
                            <input type="number" min={1} max={20} value={goal} onChange={(e) => setGoal(e.target.value)} disabled={ro} className="!w-32" />
                        </Field>
                        {!ro && (
                            <button className="btn primary" onClick={() => void saveGoal()} disabled={String(meta.visit_goal) === goal}>
                                저장
                            </button>
                        )}
                    </div>
                </section>
            </div>

            {edit && (
                <StageModal
                    s={edit === 'new' ? null : edit}
                    onClose={() => setEdit(null)}
                    onSaved={async (m) => {
                        setEdit(null);
                        toast(m);
                        await refreshMeta();
                    }}
                />
            )}
            {removing && (
                <RemoveStage
                    s={removing}
                    n={count(removing.id)}
                    onClose={() => setRemoving(null)}
                    onDone={async () => {
                        setRemoving(null);
                        toast('단계를 삭제하고 병원을 옮겼습니다');
                        await Promise.all([refreshMeta(), refreshHospitals()]);
                    }}
                />
            )}
        </>
    );
}

function StageModal({ s, onClose, onSaved }: { s: Stage | null; onClose: () => void; onSaved: (m: string) => void }) {
    const { meta } = useStore();
    const [f, setF] = useState({ name: s?.name ?? '', kind: s?.kind ?? 'main', trigger: s?.trigger ?? '', color: s?.color ?? '#5B7FA6' });
    const [err, setErr] = useState('');
    if (!meta) return null;
    const owner = (t: string) => meta.stages.find((x) => x.trigger === t && x.id !== s?.id);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr('');
        try {
            const body = { ...f, trigger: f.kind === 'exit' ? null : f.trigger || null };
            if (s) await api.put(`/stages/${s.id}`, body);
            else await api.post('/stages', body);
            onSaved(s ? '단계를 저장했습니다' : '단계를 추가했습니다');
        } catch (er) {
            setErr(errMsg(er));
        }
    };
    return (
        <Modal
            size="sm"
            title={s ? '단계 수정' : '단계 추가'}
            onClose={onClose}
            footer={
                <>
                    {err && <span className="err mr-auto self-center">{err}</span>}
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button className="btn primary" form="sform">
                        저장
                    </button>
                </>
            }
        >
            <form id="sform" className="grid gap-3" onSubmit={submit}>
                <Field label="단계 이름" req>
                    <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={30} autoFocus />
                </Field>
                <div className="fld">
                    <span>구분</span>
                    <div className="seg">
                        <button type="button" className={f.kind === 'main' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'main' })}>
                            진행
                        </button>
                        <button type="button" className={f.kind === 'exit' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'exit', trigger: '' })}>
                            이탈 (보류·Lost 등)
                        </button>
                    </div>
                </div>
                {f.kind === 'main' && (
                    <Field label="자동 전환 조건" hint="한 조건은 한 단계에만">
                        <select value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })}>
                            <option value="">없음 (직접 변경)</option>
                            {Object.entries(meta.triggers).map(([k, l]) => (
                                <option key={k} value={k}>
                                    {l}
                                    {owner(k) ? ` — 현재 ‘${owner(k)!.name}’에서 옮겨옴` : ''}
                                </option>
                            ))}
                        </select>
                    </Field>
                )}
                <Field label="색상">
                    <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="!h-10 !w-20 !p-1" />
                </Field>
            </form>
        </Modal>
    );
}

function RemoveStage({ s, n, onClose, onDone }: { s: Stage; n: number; onClose: () => void; onDone: () => void }) {
    const { meta, toast } = useStore();
    const others = meta?.stages.filter((x) => x.id !== s.id) ?? [];
    const [to, setTo] = useState(String(others[0]?.id ?? ''));
    const go = async () => {
        try {
            await api.del(`/stages/${s.id}`, { move_to: Number(to) });
            onDone();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    return (
        <Modal
            size="sm"
            title="단계 삭제"
            sub={`‘${s.name}’ 단계에 병원 ${n}곳이 있습니다`}
            onClose={onClose}
            footer={
                <>
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button className="btn danger solid" onClick={() => void go()}>
                        옮기고 삭제
                    </button>
                </>
            }
        >
            <Field label="병원을 옮길 단계">
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {others.map((o) => (
                        <option key={o.id} value={o.id}>
                            {o.name}
                        </option>
                    ))}
                </select>
            </Field>
        </Modal>
    );
}

function CodeList({ grp, title, ro }: { grp: 'grade' | 'specialty'; title: string; ro: boolean }) {
    const { meta, toast, refreshMeta } = useStore();
    const [items, setItems] = useState<string[]>(meta?.codes[grp] ?? []);
    const [add, setAdd] = useState('');
    useEffect(() => setItems(meta?.codes[grp] ?? []), [meta, grp]);
    const dirty = JSON.stringify(items) !== JSON.stringify(meta?.codes[grp] ?? []);

    const save = async () => {
        try {
            const r = await api.put<{ in_use_removed: number }>(`/codes/${grp}`, { values: items });
            toast(r.in_use_removed ? `저장했습니다 · 목록에서 빠진 값을 쓰는 병원 ${r.in_use_removed}곳은 값이 그대로 남습니다` : '저장했습니다');
            await refreshMeta();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    const push = () => {
        const v = add.trim();
        if (!v) return;
        if (items.includes(v)) return toast('이미 있는 항목입니다', true);
        setItems([...items, v]);
        setAdd('');
    };
    const mv = (i: number, d: number) => {
        const n = items.slice();
        const j = i + d;
        if (j < 0 || j >= n.length) return;
        [n[i], n[j]] = [n[j], n[i]];
        setItems(n);
    };

    return (
        <section className="panel">
            <h2>
                {title}
                <small>
                    {!ro && dirty && (
                        <button className="btn sm primary" onClick={() => void save()}>
                            저장
                        </button>
                    )}
                </small>
            </h2>
            <ul className="grid gap-1">
                {items.map((v, i) => (
                    <li key={v} className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2">
                        <span className="flex-1">{v}</span>
                        {!ro && (
                            <>
                                <button className="icon-btn" onClick={() => mv(i, -1)} disabled={i === 0} aria-label="위로">
                                    <Icon name="up" />
                                </button>
                                <button className="icon-btn" onClick={() => mv(i, 1)} disabled={i === items.length - 1} aria-label="아래로">
                                    <Icon name="down" />
                                </button>
                                <button className="icon-btn" onClick={() => setItems(items.filter((x) => x !== v))} disabled={items.length <= 1} aria-label="삭제">
                                    <Icon name="x" />
                                </button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            {!ro && (
                <div className="mt-2 flex gap-2">
                    <input value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && push()} placeholder="새 항목" maxLength={40} aria-label="새 항목" />
                    <button className="btn" onClick={push}>
                        추가
                    </button>
                </div>
            )}
        </section>
    );
}
