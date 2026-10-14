import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, errMsg } from '../lib/api';
import { useLookups, useStore } from '../lib/store';
import type { HospitalItem } from '../lib/types';
import HospitalDrawer from '../components/HospitalDrawer';
import HospitalForm from '../components/HospitalForm';
import { CatChips, Empty, FollowBadge, GradeBadge, Icon, Loading, PreBadge, StageBadge, useConfirm } from '../components/ui';

const FILTER_KEYS = ['q', 'stage', 'pre', 'src', 'grade', 'cat', 'owner', 'follow'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export default function Hospitals() {
    const { me, meta, hospitals, can, refreshHospitals, toast } = useStore();
    const { user, initialStage } = useLookups();
    const confirm = useConfirm();
    const [params, setParams] = useSearchParams();
    const [adding, setAdding] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [deleted, setDeleted] = useState<HospitalItem[] | null>(null);
    const [loaded, setLoaded] = useState(hospitals.length > 0);

    const openId = Number(params.get('open')) || null;
    const get = (k: FilterKey) => params.get(k) ?? '';
    const setFilter = (k: FilterKey | 'open', v: string) => {
        const p = new URLSearchParams(params);
        if (v) p.set(k, v);
        else p.delete(k);
        if (k === 'stage' && v !== String(initialStage?.id)) p.delete('pre');
        setParams(p, { replace: k !== 'open' });
    };

    useEffect(() => {
        refreshHospitals()
            .catch((e) => toast(errMsg(e), true))
            .finally(() => setLoaded(true));
    }, [refreshHospitals, toast]);

    useEffect(() => {
        if (!showDeleted) return;
        setDeleted(null);
        api.get<HospitalItem[]>('/hospitals?deleted=1').then(setDeleted).catch((e) => toast(errMsg(e), true));
    }, [showDeleted, toast]);

    const list = useMemo(() => {
        const q = get('q').trim().toLowerCase();
        const [stage, pre, src, grade, cat, owner, follow] = ['stage', 'pre', 'src', 'grade', 'cat', 'owner', 'follow'].map((k) => get(k as FilterKey));
        return hospitals.filter((h) => {
            if (q && ![h.name, h.address, h.director, h.code, h.phone].some((x) => x?.toLowerCase().includes(q))) return false;
            if (stage && h.stage_id !== Number(stage)) return false;
            if (pre && h.pre_type !== pre) return false;
            if (src && !h.sources.includes(src)) return false;
            if (grade && h.eval_grade !== grade) return false;
            if (cat === 'none' ? h.category_ids.length > 0 : cat && !h.category_ids.includes(Number(cat))) return false;
            if (owner === 'me' ? h.owner_id !== me?.user.id : owner === 'none' ? h.owner_id !== null : owner && h.owner_id !== Number(owner)) return false;
            if (follow && h.follow !== follow) return false;
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hospitals, params, me]);

    const active = FILTER_KEYS.filter((k) => get(k)).length;
    const restore = async (h: HospitalItem) => {
        if (!(await confirm({ title: '병원 복원', body: `‘${h.name}’을(를) 복원할까요?`, ok: '복원' }))) return;
        try {
            await api.post(`/hospitals/${h.id}/restore`);
            toast('복원했습니다');
            setDeleted((d) => d?.filter((x) => x.id !== h.id) ?? null);
            void refreshHospitals();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    if (!meta) return <Loading />;
    const showEval = can('eval', 'read');
    const showFollow = can('activity', 'read');

    return (
        <>
            <div className="page-head">
                <div>
                    <h1>병원 관리</h1>
                    <p>
                        {showDeleted ? `삭제된 병원 ${deleted?.length ?? 0}곳` : `${list.length}곳${active ? ` / 전체 ${hospitals.length}곳` : ''}`}
                        {me?.scope === 'own' && ' · 담당 병원만 수정할 수 있습니다'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {can('hospital', 'delete') && (
                        <button className="btn" onClick={() => setShowDeleted(!showDeleted)}>
                            {showDeleted ? '목록으로' : '삭제된 병원'}
                        </button>
                    )}
                    {can('hospital', 'create') && !showDeleted && (
                        <button className="btn primary" onClick={() => setAdding(true)}>
                            <Icon name="plus" /> 병원 등록
                        </button>
                    )}
                </div>
            </div>

            {showDeleted ? (
                !deleted ? (
                    <Loading />
                ) : deleted.length ? (
                    <div className="tbl-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>병원</th>
                                    <th>삭제일</th>
                                    <th>담당</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {deleted.map((h) => (
                                    <tr key={h.id}>
                                        <td>
                                            <div className="h-name">{h.name}</div>
                                            <div className="h-sub">{h.address}</div>
                                        </td>
                                        <td className="mono">{h.deleted_at}</td>
                                        <td>{h.owner_id ? user.get(h.owner_id)?.name : '-'}</td>
                                        <td className="text-right">
                                            {can('hospital', 'delete', h.owner_id) && (
                                                <button className="btn sm" onClick={() => void restore(h)}>
                                                    <Icon name="restore" /> 복원
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>삭제된 병원이 없습니다</Empty>
                )
            ) : (
                <>
                    <div className="toolbar">
                        <div className="search">
                            <Icon name="search" />
                            <input type="search" placeholder="병원명 · 주소 · 원장님 · 전화 · 코드" value={get('q')} onChange={(e) => setFilter('q', e.target.value)} aria-label="검색" />
                        </div>
                        <select value={get('stage')} onChange={(e) => setFilter('stage', e.target.value)} aria-label="영업 단계">
                            <option value="">전체 단계</option>
                            {meta.stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        {get('stage') === String(initialStage?.id) && (
                            <select value={get('pre')} onChange={(e) => setFilter('pre', e.target.value)} aria-label="미접촉 구분">
                                <option value="">예정 구분 전체</option>
                                {Object.entries(meta.pre_types).map(([k, [l]]) => (
                                    <option key={k} value={k}>
                                        {l}
                                    </option>
                                ))}
                            </select>
                        )}
                        {showEval && (
                            <select value={get('grade')} onChange={(e) => setFilter('grade', e.target.value)} aria-label="리드 등급">
                                <option value="">전체 등급</option>
                                {['상', '중', '하', '미평가'].map((g) => (
                                    <option key={g}>{g}</option>
                                ))}
                            </select>
                        )}
                        <select value={get('src')} onChange={(e) => setFilter('src', e.target.value)} aria-label="접촉 경로">
                            <option value="">전체 경로</option>
                            {meta.lead_sources.map((s) => (
                                <option key={s}>{s}</option>
                            ))}
                        </select>
                        <select value={get('cat')} onChange={(e) => setFilter('cat', e.target.value)} aria-label="카테고리">
                            <option value="">전체 카테고리</option>
                            {meta.categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                            <option value="none">미분류</option>
                        </select>
                        <select value={get('owner')} onChange={(e) => setFilter('owner', e.target.value)} aria-label="담당">
                            <option value="">전체 담당</option>
                            <option value="me">내 담당</option>
                            <option value="none">담당 없음</option>
                            {meta.users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                        {showFollow && (
                            <select value={get('follow')} onChange={(e) => setFilter('follow', e.target.value)} aria-label="팔로우업">
                                <option value="">팔로우업 전체</option>
                                {['지연', '오늘', '예정', '완료', '없음'].map((g) => (
                                    <option key={g}>{g}</option>
                                ))}
                            </select>
                        )}
                        {active > 0 && (
                            <button className="btn ghost" onClick={() => setParams(openId ? { open: String(openId) } : {}, { replace: true })}>
                                필터 초기화
                            </button>
                        )}
                    </div>

                    {!loaded ? (
                        <Loading />
                    ) : list.length === 0 ? (
                        <Empty>{hospitals.length ? '조건에 맞는 병원이 없습니다' : '등록된 병원이 없습니다. ‘병원 등록’으로 시작하세요'}</Empty>
                    ) : (
                        <>
                            <div className="tbl-wrap only-pc">
                                <table className="tbl">
                                    <thead>
                                        <tr>
                                            <th>병원</th>
                                            <th>영업 단계</th>
                                            {showEval && <th>리드 등급</th>}
                                            {showFollow && <th>다음 액션</th>}
                                            <th>담당</th>
                                            <th>카테고리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.map((h) => (
                                            <tr key={h.id} className="row" onClick={() => setFilter('open', String(h.id))} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setFilter('open', String(h.id))}>
                                                <td>
                                                    <div className="h-name">{h.name}</div>
                                                    <div className="h-sub">
                                                        {[h.sido, h.sigungu].filter(Boolean).join(' ') || h.address}
                                                        {h.director && ` · ${h.director} 원장`}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex flex-wrap gap-1">
                                                        <StageBadge id={h.stage_id} />
                                                        {h.stage_id === initialStage?.id && <PreBadge type={h.pre_type} />}
                                                    </div>
                                                </td>
                                                {showEval && (
                                                    <td>
                                                        <GradeBadge grade={h.eval_grade} sum={h.eval_sum} />
                                                    </td>
                                                )}
                                                {showFollow && (
                                                    <td>
                                                        {h.next_date ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <FollowBadge f={h.follow} />
                                                                <span className="min-w-0">
                                                                    <span className="mono block text-[12.5px]">{h.next_date}</span>
                                                                    <span className="h-sub block max-w-56 truncate">{h.next_todo}</span>
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="muted">-</span>
                                                        )}
                                                    </td>
                                                )}
                                                <td>{h.owner_id ? user.get(h.owner_id)?.name ?? '-' : <span className="badge warn">없음</span>}</td>
                                                <td>
                                                    <CatChips ids={h.category_ids} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="cards only-m">
                                {list.map((h) => (
                                    <button key={h.id} className="hcard" onClick={() => setFilter('open', String(h.id))}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="h-name">{h.name}</div>
                                                <div className="h-sub truncate">{h.address}</div>
                                            </div>
                                            {showEval && <GradeBadge grade={h.eval_grade} sum={h.eval_sum} />}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <StageBadge id={h.stage_id} />
                                            {h.stage_id === initialStage?.id && <PreBadge type={h.pre_type} />}
                                            <FollowBadge f={h.follow} />
                                            <span className="h-sub ml-auto">{h.owner_id ? user.get(h.owner_id)?.name : '담당 없음'}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {adding && (
                <HospitalForm
                    onClose={() => setAdding(false)}
                    onSaved={(h) => {
                        setAdding(false);
                        void refreshHospitals();
                        setFilter('open', String(h.id));
                    }}
                />
            )}
            {openId && <HospitalDrawer id={openId} onClose={() => setFilter('open', '')} />}
        </>
    );
}
