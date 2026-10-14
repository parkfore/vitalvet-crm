// 병원 상세: 개요 · 리드 평가 · 영업 활동 · 전환·사용 · 이력
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, errMsg } from '../lib/api';
import { gradeOf, useLookups, useStore } from '../lib/store';
import type { Activity, AuditItem, HospitalDetail, Level } from '../lib/types';
import HospitalForm from './HospitalForm';
import { CatChips, Empty, Field, FollowBadge, GradeBadge, Icon, Loading, PreBadge, StageBadge, useConfirm, useEsc } from './ui';

type Tab = 'info' | 'eval' | 'act' | 'conv' | 'hist';

export default function HospitalDrawer({ id, onClose }: { id: number; onClose: () => void }) {
    const { can, toast, patchHospital, refreshHospitals } = useStore();
    const confirm = useConfirm();
    const { initialStage } = useLookups();
    const [h, setH] = useState<HospitalDetail | null>(null);
    const [tab, setTab] = useState<Tab>('info');
    const [editing, setEditing] = useState(false);
    useEsc(() => !editing && onClose());

    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const load = useCallback(async () => {
        try {
            setH(await api.get<HospitalDetail>(`/hospitals/${id}`));
        } catch (e) {
            toast(errMsg(e), true);
            closeRef.current();
        }
    }, [id, toast]);
    // 다른 병원을 열 때만 처음 탭으로
    useEffect(() => {
        setH(null);
        setTab('info');
        void load();
    }, [load]);

    /** 서버가 돌려준 최신 상세로 화면과 목록을 함께 갱신 */
    const apply = useCallback(
        (d: HospitalDetail) => {
            setH(d);
            patchHospital(d);
        },
        [patchHospital],
    );

    if (!h) {
        return (
            <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
                <aside className="drawer">
                    <div className="d-body">
                        <Loading />
                    </div>
                </aside>
            </div>
        );
    }

    const tabs: [Tab, string, boolean][] = [
        ['info', '개요', true],
        ['eval', '리드 평가', !!h.eval],
        ['act', `영업 활동${h.activities ? ` ${h.activities.length}` : ''}`, !!h.activities],
        ['conv', '전환·사용', h.usage_count !== undefined],
        ['hist', '이력', can('history', 'read')],
    ];

    const remove = async () => {
        if (!(await confirm({ title: '병원 삭제', body: <>‘{h.name}’을(를) 삭제할까요? 삭제한 병원은 ‘삭제된 병원’에서 복원할 수 있습니다.</>, ok: '삭제', danger: true }))) return;
        try {
            await api.del(`/hospitals/${h.id}`);
            toast('삭제했습니다');
            void refreshHospitals();
            onClose();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    return (
        <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className="drawer" role="dialog" aria-modal="true" aria-label={h.name}>
                <header>
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <small className="mono muted">{h.code}</small>
                            <h2 className="text-[18px] font-bold leading-tight">{h.name}</h2>
                            <p className="h-sub mt-0.5">
                                {h.address} {h.address_detail}
                            </p>
                        </div>
                        <button className="icon-btn" onClick={onClose} aria-label="닫기">
                            <Icon name="x" />
                        </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StageBadge id={h.stage_id} />
                        <PreBadge type={h.stage_id === initialStage?.id ? h.pre_type : null} />
                        {h.eval && <GradeBadge grade={h.eval_grade} sum={h.eval_sum} />}
                        <FollowBadge f={h.follow ?? null} />
                    </div>
                </header>
                <nav className="d-tabs" role="tablist">
                    {tabs
                        .filter((t) => t[2])
                        .map(([k, label]) => (
                            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                                {label}
                            </button>
                        ))}
                </nav>
                <div className="d-body">
                    {tab === 'info' && <InfoTab h={h} apply={apply} onEdit={() => setEditing(true)} onDelete={remove} />}
                    {tab === 'eval' && <EvalTab h={h} apply={apply} />}
                    {tab === 'act' && <ActTab h={h} reload={load} />}
                    {tab === 'conv' && <ConvTab h={h} apply={apply} />}
                    {tab === 'hist' && <HistTab h={h} />}
                </div>
            </aside>
            {editing && (
                <HospitalForm
                    initial={h}
                    onClose={() => setEditing(false)}
                    onSaved={(d) => {
                        apply(d as HospitalDetail);
                        setEditing(false);
                    }}
                />
            )}
        </div>
    );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
    return (
        <>
            <dt className="muted text-[13px]">{k}</dt>
            <dd className="min-w-0">{children || <span className="muted">-</span>}</dd>
        </>
    );
}

// ---------- 개요 ----------
function InfoTab({ h, apply, onEdit, onDelete }: { h: HospitalDetail; apply: (d: HospitalDetail) => void; onEdit: () => void; onDelete: () => void }) {
    const { meta, toast } = useStore();
    const { user, comp } = useLookups();
    const confirm = useConfirm();
    if (!meta) return null;
    const main = meta.stages.filter((s) => s.kind === 'main');
    const exit = meta.stages.filter((s) => s.kind === 'exit');
    const curIdx = main.findIndex((s) => s.id === h.stage_id);
    const canStage = h.can.hospital.update;

    const moveStage = async (sid: number, name: string) => {
        if (sid === h.stage_id || !canStage) return;
        if (!(await confirm({ title: '영업 단계 변경', body: <>단계를 ‘{name}’(으)로 바꿀까요?</>, ok: '변경' }))) return;
        try {
            apply(await api.put<HospitalDetail>(`/hospitals/${h.id}/stage`, { stage_id: sid }));
            toast(`단계를 ‘${name}’(으)로 바꿨습니다`);
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    return (
        <>
            <section className="panel">
                <h2>
                    영업 단계 <small>{canStage ? '눌러서 변경 · 활동 기록 시 자동 진행' : '변경 권한 없음'}</small>
                </h2>
                <div className="stepper">
                    {main.map((s, i) => (
                        <button
                            key={s.id}
                            className={`step ${s.id === h.stage_id ? 'cur' : curIdx >= 0 && i < curIdx ? 'done' : ''}`}
                            style={{ '--c': s.color } as React.CSSProperties}
                            disabled={!canStage}
                            onClick={() => void moveStage(s.id, s.name)}
                            title={s.trigger ? `자동: ${meta.triggers[s.trigger]}` : undefined}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>
                <div className="stepper mt-2">
                    {exit.map((s) => (
                        <button key={s.id} className={`step ${s.id === h.stage_id ? 'cur' : ''}`} style={{ '--c': s.color } as React.CSSProperties} disabled={!canStage} onClick={() => void moveStage(s.id, s.name)}>
                            {s.name}
                        </button>
                    ))}
                </div>
            </section>

            {h.next_done !== undefined && <NextBox h={h} apply={apply} />}

            <section className="panel">
                <h2>
                    기본 정보
                    <small>
                        {h.can.hospital.update && (
                            <button className="btn sm" onClick={onEdit}>
                                <Icon name="edit" /> 수정
                            </button>
                        )}
                    </small>
                </h2>
                <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[14px]">
                    <Row k="담당 영업사원">{h.owner_id ? user.get(h.owner_id)?.name ?? '(비활성 사용자)' : <span className="badge warn">담당 없음</span>}</Row>
                    <Row k="병원 등급 · 전문과">{[h.grade, h.specialty].filter(Boolean).join(' · ')}</Row>
                    <Row k="대표 전화">{h.phone && <a href={`tel:${h.phone}`} className="text-brand underline">{h.phone}</a>}</Row>
                    <Row k="원장님">
                        {h.director}
                        {h.director_phone && (
                            <>
                                {' · '}
                                <a href={`tel:${h.director_phone}`} className="text-brand underline">
                                    {h.director_phone}
                                </a>
                            </>
                        )}
                    </Row>
                    <Row k="봉직수의사 수">{h.vet_count != null && `${h.vet_count}명`}</Row>
                    <Row k="접촉 경로">{h.sources.length > 0 && <span className="chips">{h.sources.map((x) => <span key={x} className="chip">{x}</span>)}</span>}</Row>
                    <Row k="카테고리">
                        <CatChips ids={h.category_ids} />
                    </Row>
                    <Row k="경쟁 제품">{h.competitor_id && `${comp.get(h.competitor_id)?.name ?? ''}${h.competitor_until ? ` · 만료 ${h.competitor_until}` : ''}`}</Row>
                    <Row k="메모">{h.memo && <span className="whitespace-pre-wrap">{h.memo}</span>}</Row>
                    <Row k="등록일">{h.created_at}</Row>
                </dl>
            </section>

            {h.can.hospital.delete && (
                <div className="d-foot">
                    <span />
                    <button className="btn danger sm" onClick={onDelete}>
                        <Icon name="trash" /> 병원 삭제
                    </button>
                </div>
            )}
        </>
    );
}

// ---------- 다음 액션 ----------
function NextBox({ h, apply }: { h: HospitalDetail; apply: (d: HospitalDetail) => void }) {
    const { meta, toast } = useStore();
    const has = !!(h.next_date || h.next_todo);
    const canSave = has ? h.can.activity.update : h.can.activity.create;
    const [f, setF] = useState({ next_date: h.next_date ?? '', next_todo: h.next_todo ?? '', next_done: !!h.next_done });
    useEffect(() => setF({ next_date: h.next_date ?? '', next_todo: h.next_todo ?? '', next_done: !!h.next_done }), [h.next_date, h.next_todo, h.next_done]);
    const dirty = f.next_date !== (h.next_date ?? '') || f.next_todo !== (h.next_todo ?? '') || f.next_done !== !!h.next_done;

    const save = async () => {
        if (f.next_todo && !f.next_date) return toast('다음 액션일을 정하세요', true);
        try {
            apply(await api.put<HospitalDetail>(`/hospitals/${h.id}/next`, { next_date: f.next_date || null, next_todo: f.next_todo || null, next_done: f.next_done }));
            toast('다음 액션을 저장했습니다');
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    const clear = async () => {
        try {
            apply(await api.del<HospitalDetail>(`/hospitals/${h.id}/next`));
            toast('다음 액션을 지웠습니다');
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    const quick = (days: number) => {
        const d = new Date(`${meta?.today ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
        d.setDate(d.getDate() + days);
        setF({ ...f, next_date: d.toLocaleDateString('sv-SE'), next_done: false });
    };

    return (
        <section className="panel">
            <h2>
                다음 액션 <FollowBadge f={h.follow ?? null} />
                <small>팔로우업 할 사항과 날짜</small>
            </h2>
            <div className="form-grid">
                <Field label="다음 액션일">
                    <input type="date" value={f.next_date} onChange={(e) => setF({ ...f, next_date: e.target.value })} disabled={!canSave} />
                </Field>
                <div className="fld">
                    <span>빠른 선택</span>
                    <div className="flex gap-1.5">
                        {[
                            ['내일', 1],
                            ['3일 뒤', 3],
                            ['1주 뒤', 7],
                        ].map(([l, d]) => (
                            <button key={l} type="button" className="btn sm" onClick={() => quick(d as number)} disabled={!canSave}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                <Field label="팔로우업 할 사항" className="span2">
                    <input value={f.next_todo} onChange={(e) => setF({ ...f, next_todo: e.target.value })} maxLength={200} placeholder="예: 시연 장비 들고 2차 방문" disabled={!canSave} />
                </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {f.next_date && (
                    <label className="flex items-center gap-2 text-[13.5px]">
                        <input type="checkbox" className="size-4" checked={f.next_done} onChange={(e) => setF({ ...f, next_done: e.target.checked })} disabled={!canSave} />
                        처리 완료
                    </label>
                )}
                <span className="flex-1" />
                {has && h.can.activity.delete && (
                    <button className="btn sm ghost" onClick={() => void clear()}>
                        지우기
                    </button>
                )}
                {canSave && (
                    <button className="btn sm primary" onClick={() => void save()} disabled={!dirty}>
                        저장
                    </button>
                )}
            </div>
        </section>
    );
}

// ---------- 리드 평가 ----------
function EvalTab({ h, apply }: { h: HospitalDetail; apply: (d: HospitalDetail) => void }) {
    const { meta, toast } = useStore();
    const confirm = useConfirm();
    const e = h.eval!;
    const [f, setF] = useState({ adoption: e.adoption, favor: e.favor, surgeries: e.surgeries, surgery_count: e.surgery_count?.toString() ?? '' });
    const [uploading, setUploading] = useState(false);
    useEffect(() => setF({ adoption: e.adoption, favor: e.favor, surgeries: e.surgeries, surgery_count: e.surgery_count?.toString() ?? '' }), [e.adoption, e.favor, e.surgeries, e.surgery_count]);
    if (!meta) return null;

    if (!h.can_eval_stage) {
        return (
            <section className="panel">
                <h2>리드 평가</h2>
                <Empty>
                    리드 평가는 <b>1차 방문 이후</b>에 할 수 있습니다.
                    <br />
                    영업 활동에 ‘방문’을 기록하면 단계가 자동으로 1차 방문으로 바뀝니다.
                </Empty>
            </section>
        );
    }

    const has = e.adoption !== null || e.favor !== null || e.surgeries !== null || e.shots.length > 0;
    const canEdit = has ? h.can.eval.update : h.can.eval.create;
    const all = f.adoption !== null && f.favor !== null && f.surgeries !== null;
    const sum = all ? f.adoption! + f.favor! + f.surgeries! : null;
    const dirty = f.adoption !== e.adoption || f.favor !== e.favor || f.surgeries !== e.surgeries || f.surgery_count !== (e.surgery_count?.toString() ?? '');

    const save = async () => {
        try {
            apply(await api.put<HospitalDetail>(`/hospitals/${h.id}/eval`, { ...f, surgery_count: f.surgery_count === '' ? null : Number(f.surgery_count) }));
            toast('리드 평가를 저장했습니다');
        } catch (er) {
            toast(errMsg(er), true);
        }
    };
    const remove = async () => {
        if (!(await confirm({ title: '리드 평가 삭제', body: '평가 점수와 근거 이미지를 모두 지울까요?', ok: '삭제', danger: true }))) return;
        try {
            apply(await api.del<HospitalDetail>(`/hospitals/${h.id}/eval`));
            toast('리드 평가를 지웠습니다');
        } catch (er) {
            toast(errMsg(er), true);
        }
    };
    const upload = async (files: FileList | null) => {
        if (!files?.length) return;
        setUploading(true);
        try {
            let last: HospitalDetail | null = null;
            for (const file of Array.from(files).slice(0, meta.eval_max_shots - e.shots.length)) {
                const fd = new FormData();
                fd.append('file', file);
                last = await api.post<HospitalDetail>(`/hospitals/${h.id}/shots`, fd);
            }
            if (last) apply(last);
            toast('근거 이미지를 올렸습니다');
        } catch (er) {
            toast(errMsg(er), true);
        } finally {
            setUploading(false);
        }
    };
    const delShot = async (sid: number) => {
        if (!(await confirm({ title: '이미지 삭제', body: '이 근거 이미지를 지울까요?', ok: '삭제', danger: true }))) return;
        try {
            apply(await api.del<HospitalDetail>(`/shots/${sid}`));
        } catch (er) {
            toast(errMsg(er), true);
        }
    };
    // 클립보드 캡처 붙여넣기 (Ctrl+V)
    const onPaste = (ev: React.ClipboardEvent) => {
        const files = Array.from(ev.clipboardData.files).filter((x) => x.type.startsWith('image/'));
        if (files.length && canEdit) {
            const dt = new DataTransfer();
            files.forEach((x) => dt.items.add(x));
            void upload(dt.files);
        }
    };

    const items = Object.entries(meta.eval_items) as ['adoption' | 'favor' | 'surgeries', [string, string]][];
    return (
        <section className="panel" onPaste={onPaste}>
            <h2>
                리드 평가 <GradeBadge grade={gradeOf(sum, meta.eval_grades)} sum={sum} />
                <small>{e.date ? `평가일 ${e.date}` : '항목별 상·중·하'}</small>
            </h2>
            <div className="grid gap-4">
                {items.map(([k, [label, desc]]) => (
                    <div key={k} className="grid gap-1.5">
                        <div>
                            <b className="text-[14px]">{label}</b>
                            <p className="hint">{desc}</p>
                        </div>
                        <div className="seg lv">
                            {([0, 1, 2, 3, 4, 5] as Level[]).map((lv) => (
                                <button key={lv} type="button" className={`${f[k] === lv ? 'on' : ''}`} disabled={!canEdit} onClick={() => setF({ ...f, [k]: f[k] === lv ? null : lv })} aria-pressed={f[k] === lv}>
                                    {lv}
                                </button>
                            ))}
                        </div>
                        {k === 'adoption' && (
                            <div className="shots mt-1">
                                {e.shots.map((s) => (
                                    <div key={s.id} className="shot">
                                        <a href={s.url} target="_blank" rel="noreferrer">
                                            <img src={s.url} alt={s.name ?? '근거 이미지'} loading="lazy" />
                                        </a>
                                        {canEdit && (
                                            <button className="del" onClick={() => void delShot(s.id)} aria-label="이미지 삭제">
                                                <Icon name="x" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {canEdit && e.shots.length < meta.eval_max_shots && (
                                    <label className="shot-add">
                                        {uploading ? '올리는 중…' : (
                                            <span>
                                                <Icon name="upload" className="mx-auto mb-0.5 size-4" />
                                                캡처 올리기
                                            </span>
                                        )}
                                        <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(ev) => void upload(ev.target.files)} disabled={uploading} />
                                    </label>
                                )}
                            </div>
                        )}
                        {k === 'adoption' && canEdit && <p className="hint">근거 화면 최대 {meta.eval_max_shots}장 · 이 영역에서 Ctrl+V로 캡처를 붙여 넣어도 됩니다</p>}
                        {k === 'surgeries' && (
                            <input type="number" min={0} className="!w-48" placeholder="실제 월 마취 건수 (참고)" value={f.surgery_count} onChange={(ev) => setF({ ...f, surgery_count: ev.target.value })} disabled={!canEdit} aria-label="실제 월 마취 건수" />
                        )}
                    </div>
                ))}
            </div>
            <p className="hint mt-4">항목별 0~5점 · 종합 등급: 합계 {meta.eval_grades.상}~15점 상 · {meta.eval_grades.중}~{meta.eval_grades.상 - 1}점 중 · 0~{meta.eval_grades.중 - 1}점 하 (세 항목을 모두 골라야 계산)</p>
            <div className="mt-3 flex gap-2">
                {has && h.can.eval.delete && (
                    <button className="btn sm danger" onClick={() => void remove()}>
                        평가 삭제
                    </button>
                )}
                <span className="flex-1" />
                {canEdit ? (
                    <button className="btn primary" onClick={() => void save()} disabled={!dirty}>
                        평가 저장
                    </button>
                ) : (
                    <span className="hint">수정 권한이 없습니다</span>
                )}
            </div>
        </section>
    );
}

// ---------- 영업 활동 ----------
type ActForm = Omit<Activity, 'id' | 'hospital_id' | 'author_id' | 'author_name'>;
const blankAct = (today: string): ActForm => ({ type: '방문', date: today, purpose: null, contact: null, reaction: null, note: '', voc_type: null, voc_text: '', comp_id: null, comp_text: '', issue_type: null, issue_text: '' });

function ActTab({ h, reload }: { h: HospitalDetail; reload: () => Promise<void> }) {
    const { meta, toast, me } = useStore();
    const { comp } = useLookups();
    const confirm = useConfirm();
    const [editId, setEditId] = useState<number | 'new' | null>(null);
    if (!meta) return null;
    const list = h.activities ?? [];

    const remove = async (a: Activity) => {
        if (!(await confirm({ title: '활동 기록 삭제', body: `${a.date} ${a.type} 기록을 지울까요?`, ok: '삭제', danger: true }))) return;
        try {
            await api.del(`/activities/${a.id}`);
            toast('기록을 지웠습니다');
            await reload();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    return (
        <>
            {h.can.activity.create && editId !== 'new' && (
                <button className="btn primary justify-self-start" onClick={() => setEditId('new')}>
                    <Icon name="plus" /> 활동 기록
                </button>
            )}
            {editId === 'new' && (
                <ActEditor
                    h={h}
                    initial={blankAct(meta.today)}
                    onCancel={() => setEditId(null)}
                    onDone={async () => {
                        setEditId(null);
                        await reload();
                    }}
                />
            )}
            {list.length === 0 && editId !== 'new' && <Empty>아직 영업 활동 기록이 없습니다</Empty>}
            {list.map((a) =>
                editId === a.id ? (
                    <ActEditor
                        key={a.id}
                        h={h}
                        id={a.id}
                        initial={a}
                        onCancel={() => setEditId(null)}
                        onDone={async () => {
                            setEditId(null);
                            await reload();
                        }}
                    />
                ) : (
                    <article key={a.id} className="panel !p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <b>{a.type}</b>
                            <span className="mono muted">{a.date}</span>
                            {a.purpose && <span className="badge">{a.purpose}</span>}
                            {a.reaction && <span className={`badge ${a.reaction === '긍정' ? 'ok' : a.reaction === '부정' ? 'bad' : ''}`}>{a.reaction}</span>}
                            <span className="flex-1" />
                            <small className="muted">
                                {a.contact && `${a.contact} 면담 · `}
                                {a.author_name ?? '알 수 없음'}
                                {a.author_id === me?.user.id && ' (나)'}
                            </small>
                            {h.can.activity.update && (
                                <button className="icon-btn" onClick={() => setEditId(a.id)} aria-label="수정">
                                    <Icon name="edit" />
                                </button>
                            )}
                            {h.can.activity.delete && (
                                <button className="icon-btn" onClick={() => void remove(a)} aria-label="삭제">
                                    <Icon name="trash" />
                                </button>
                            )}
                        </div>
                        {a.note && <p className="mt-2 whitespace-pre-wrap text-[14px]">{a.note}</p>}
                        {(a.voc_text || a.comp_id || a.comp_text || a.issue_text) && (
                            <ul className="mt-2 grid gap-1 rounded-lg bg-surface-2 p-2.5 text-[13px]">
                                {a.voc_text && (
                                    <li>
                                        <b>고객의 소리</b> · {a.voc_type} · {a.voc_text}
                                    </li>
                                )}
                                {(a.comp_id || a.comp_text) && (
                                    <li>
                                        <b>경쟁사 언급</b> · {[a.comp_id ? comp.get(a.comp_id)?.name : null, a.comp_text].filter(Boolean).join(' · ')}
                                    </li>
                                )}
                                {a.issue_text && (
                                    <li>
                                        <b>지원 요청</b> · {a.issue_type} · {a.issue_text}
                                    </li>
                                )}
                            </ul>
                        )}
                    </article>
                ),
            )}
        </>
    );
}

function ActEditor({ h, id, initial, onCancel, onDone }: { h: HospitalDetail; id?: number; initial: ActForm; onCancel: () => void; onDone: () => Promise<void> }) {
    const { meta, toast } = useStore();
    const [f, setF] = useState<ActForm>({ ...initial, note: initial.note ?? '', voc_text: initial.voc_text ?? '', comp_text: initial.comp_text ?? '', issue_text: initial.issue_text ?? '' });
    const [completeNext, setCompleteNext] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!meta) return null;
    const set = <K extends keyof ActForm>(k: K, v: ActForm[K]) => setF((x) => ({ ...x, [k]: v }));
    const sel = (k: 'purpose' | 'contact' | 'reaction' | 'voc_type' | 'issue_type', opts: string[], label: string) => (
        <Field label={label}>
            <select value={f[k] ?? ''} onChange={(e) => set(k, e.target.value || null)}>
                <option value="">선택 안 함</option>
                {opts.map((o) => (
                    <option key={o}>{o}</option>
                ))}
            </select>
        </Field>
    );
    const reportCount = [f.voc_text, f.comp_id || f.comp_text, f.issue_text].filter(Boolean).length;
    const canComplete = !id && h.next_date && !h.next_done;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const r = id
                ? await api.put<{ stage_moved: string | null }>(`/activities/${id}`, f)
                : await api.post<{ stage_moved: string | null }>(`/hospitals/${h.id}/activities`, { ...f, complete_next: completeNext });
            toast(r.stage_moved ? `기록 ${id ? '수정' : '추가'} · 단계가 ‘${r.stage_moved}’(으)로 바뀌었습니다` : `기록을 ${id ? '수정' : '추가'}했습니다`);
            await onDone();
        } catch (er) {
            toast(errMsg(er), true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="panel grid gap-3" onSubmit={submit}>
            <h2 className="!mb-0">{id ? '활동 기록 수정' : '새 활동 기록'}</h2>
            <div className="form-grid">
                <Field label="유형" req>
                    <select value={f.type} onChange={(e) => set('type', e.target.value)}>
                        {meta.activity_types.map((t) => (
                            <option key={t}>{t}</option>
                        ))}
                    </select>
                </Field>
                <Field label="날짜" req>
                    <input type="date" value={f.date} max={meta.today} onChange={(e) => set('date', e.target.value)} required />
                </Field>
                {sel('purpose', meta.activity_purposes, '목적')}
                {sel('contact', meta.activity_contacts, '면담자')}
                {sel('reaction', meta.activity_reactions, '반응')}
                <Field label="내용" className="span2">
                    <textarea rows={3} value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} maxLength={2000} placeholder="무슨 이야기를 나눴는지" />
                </Field>
            </div>
            <details className="extra" open={reportCount > 0}>
                <summary>
                    보고서 항목 <small>· 그날 영업 보고서에 자동 반영 {reportCount > 0 && `(${reportCount})`}</small>
                </summary>
                <div className="xg">
                    <b>고객의 소리 (VOC)</b>
                    <select value={f.voc_type ?? ''} onChange={(e) => set('voc_type', e.target.value || null)} aria-label="고객의 소리 유형">
                        <option value="">유형</option>
                        {meta.voc_types.map((o) => (
                            <option key={o}>{o}</option>
                        ))}
                    </select>
                    <input value={f.voc_text ?? ''} onChange={(e) => set('voc_text', e.target.value)} maxLength={500} placeholder="고객이 한 말" aria-label="고객의 소리 내용" />
                    <b>경쟁사 언급</b>
                    <select value={f.comp_id ?? ''} onChange={(e) => set('comp_id', e.target.value ? Number(e.target.value) : null)} aria-label="경쟁사">
                        <option value="">경쟁사</option>
                        {meta.competitors.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <input value={f.comp_text ?? ''} onChange={(e) => set('comp_text', e.target.value)} maxLength={500} placeholder="가격·조건 등 들은 내용" aria-label="경쟁사 언급 내용" />
                    <b>지원 요청</b>
                    <select value={f.issue_type ?? ''} onChange={(e) => set('issue_type', e.target.value || null)} aria-label="지원 요청 유형">
                        <option value="">유형</option>
                        {meta.issue_types.map((o) => (
                            <option key={o}>{o}</option>
                        ))}
                    </select>
                    <input value={f.issue_text ?? ''} onChange={(e) => set('issue_text', e.target.value)} maxLength={500} placeholder="본사에 요청할 사항" aria-label="지원 요청 내용" />
                </div>
            </details>
            {canComplete && (
                <label className="flex items-center gap-2 text-[13.5px]">
                    <input type="checkbox" className="size-4" checked={completeNext} onChange={(e) => setCompleteNext(e.target.checked)} />
                    다음 액션({h.next_date} · {h.next_todo || '할 일'})을 처리 완료로 표시
                </label>
            )}
            <div className="flex justify-end gap-2">
                <button type="button" className="btn" onClick={onCancel}>
                    취소
                </button>
                <button className="btn primary" disabled={busy}>
                    {busy ? '저장 중…' : '저장'}
                </button>
            </div>
        </form>
    );
}

// ---------- 전환·사용 ----------
function ConvTab({ h, apply }: { h: HospitalDetail; apply: (d: HospitalDetail) => void }) {
    const { toast } = useStore();
    const init = () => ({ signup_date: h.signup_date ?? '', usage_count: String(h.usage_count ?? 0), last_used_date: h.last_used_date ?? '', conv_note: h.conv_note ?? '' });
    const [f, setF] = useState(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => setF(init()), [h.signup_date, h.usage_count, h.last_used_date, h.conv_note]);
    const has = !!(h.signup_date || h.usage_count || h.last_used_date || h.conv_note);
    const canEdit = has ? h.can.conv.update : h.can.conv.create;

    const save = async () => {
        try {
            const r = await api.put<{ hospital: HospitalDetail; stage_moved: string | null }>(`/hospitals/${h.id}/conversion`, {
                signup_date: f.signup_date || null,
                usage_count: f.usage_count === '' ? 0 : Number(f.usage_count),
                last_used_date: f.last_used_date || null,
                conv_note: f.conv_note || null,
            });
            apply(r.hospital);
            toast(r.stage_moved ? `저장 · 단계가 ‘${r.stage_moved}’(으)로 바뀌었습니다` : '전환·사용 정보를 저장했습니다');
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    return (
        <section className="panel">
            <h2>
                전환·사용 <small>회원가입일·사용 건수를 넣으면 단계가 자동 진행</small>
            </h2>
            <div className="form-grid">
                <Field label="회원가입일">
                    <input type="date" value={f.signup_date} onChange={(e) => setF({ ...f, signup_date: e.target.value })} disabled={!canEdit} />
                </Field>
                <Field label="VitalVET 누적 사용 건수">
                    <input type="number" min={0} value={f.usage_count} onChange={(e) => setF({ ...f, usage_count: e.target.value })} disabled={!canEdit} />
                </Field>
                <Field label="최근 사용일">
                    <input type="date" value={f.last_used_date} onChange={(e) => setF({ ...f, last_used_date: e.target.value })} disabled={!canEdit} />
                </Field>
                <Field label="비고" className="span2">
                    <textarea rows={3} value={f.conv_note} onChange={(e) => setF({ ...f, conv_note: e.target.value })} maxLength={2000} disabled={!canEdit} />
                </Field>
            </div>
            <div className="mt-3 flex justify-end">{canEdit ? <button className="btn primary" onClick={() => void save()}>저장</button> : <span className="hint">수정 권한이 없습니다</span>}</div>
        </section>
    );
}

// ---------- 이력 ----------
function HistTab({ h }: { h: HospitalDetail }) {
    const { toast } = useStore();
    const [items, setItems] = useState<AuditItem[] | null>(null);
    useEffect(() => {
        api.get<AuditItem[]>(`/hospitals/${h.id}/timeline`).then(setItems).catch((e) => toast(errMsg(e), true));
    }, [h.id, h.stage_id, toast]);

    return (
        <>
            {h.stage_history && h.stage_history.length > 0 && (
                <section className="panel">
                    <h2>단계 변경</h2>
                    <ul className="timeline">
                        {h.stage_history.map((s) => (
                            <li key={s.id}>
                                <span className="tl-date mono">{s.date}</span>
                                <span>
                                    {s.from_stage ?? '시작'} → <b>{s.to_stage}</b>
                                </span>
                                {s.auto ? <span className="badge">자동</span> : <span />}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <section className="panel">
                <h2>
                    변경 이력 <small>누가 · 언제 · 무엇을 · 이전 → 이후</small>
                </h2>
                {!items ? <Loading /> : items.length ? <AuditList items={items} /> : <Empty>변경 이력이 없습니다</Empty>}
            </section>
        </>
    );
}

const ACTION: Record<string, [string, string]> = { create: ['추가', 'ok'], update: ['수정', ''], delete: ['삭제', 'bad'], restore: ['복원', 'warn'] };
export function AuditList({ items, showTarget }: { items: AuditItem[]; showTarget?: boolean }) {
    return (
        <ul className="timeline">
            {items.map((a) => (
                <li key={a.id}>
                    <span className="tl-date mono">{a.at}</span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`badge ${ACTION[a.action]?.[1]}`}>{ACTION[a.action]?.[0] ?? a.action}</span>
                            {showTarget && <b>{a.target_name}</b>}
                            <span className="muted">{a.section}</span>
                            {a.summary && <span>· {a.summary}</span>}
                        </div>
                        {a.changes.length > 0 && (
                            <table className="chg">
                                <tbody>
                                    {a.changes.map((c, i) => (
                                        <tr key={i}>
                                            <th className="w-32">{c.field}</th>
                                            <td>
                                                {c.before && <span className="b">{c.before}</span>}
                                                {c.before && c.after && ' → '}
                                                {c.after && <span className="a">{c.after}</span>}
                                                {!c.before && !c.after && <span className="muted">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <small className="muted">{a.actor_name ?? '시스템'}</small>
                </li>
            ))}
        </ul>
    );
}
