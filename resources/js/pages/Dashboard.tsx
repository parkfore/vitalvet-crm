import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, errMsg } from '../lib/api';
import { useLookups, useStore } from '../lib/store';
import type { Follow } from '../lib/types';
import { Empty, FollowBadge, Loading, StageBadge } from '../components/ui';

interface Dash {
    scope: 'all' | 'own';
    total: number;
    by_stage: { id: number; name: string; color: string; count: number }[];
    pre: { key: string; name: string; color: string; count: number }[];
    sources: { name: string; count: number }[];
    grades: { name: string; count: number }[] | null;
    follow: { overdue: number; today: number; list: { id: number; name: string; stage_id: number; next_date: string; next_todo: string | null; follow: Follow; owner_id: number | null }[] } | null;
    conv: { signup: number; using: number; usage_total: number } | null;
    weekly: { week: string; visit: number; call: number; etc: number }[] | null;
}

const GRADE_C: Record<string, string> = { 상: 'var(--color-hot)', 중: 'var(--color-warm)', 하: 'var(--color-cold)', 미평가: 'var(--color-muted)' };

export default function Dashboard() {
    const { me, toast } = useStore();
    const { user } = useLookups();
    const nav = useNavigate();
    const [d, setD] = useState<Dash | null>(null);

    useEffect(() => {
        api.get<Dash>('/dashboard').then(setD).catch((e) => toast(errMsg(e), true));
    }, [toast]);

    if (!d) return <Loading />;
    const max = (xs: { count: number }[]) => Math.max(1, ...xs.map((x) => x.count));
    const wMax = Math.max(1, ...(d.weekly ?? []).map((w) => w.visit + w.call + w.etc));

    return (
        <>
            <div className="page-head">
                <div>
                    <h1>대시보드</h1>
                    <p>{d.scope === 'own' ? `${me?.user.name}님 담당 병원 기준` : '전체 병원 기준'}</p>
                </div>
            </div>

            <div className="kpis">
                <div className="kpi">
                    <span>관리 병원</span>
                    <b>{d.total}</b>
                    <small>삭제 제외</small>
                </div>
                {d.follow && (
                    <>
                        <div className={`kpi ${d.follow.overdue ? 'alert' : ''}`}>
                            <span>팔로우업 지연</span>
                            <b>{d.follow.overdue}</b>
                            <small>다음 액션일이 지남</small>
                        </div>
                        <div className="kpi">
                            <span>오늘 할 일</span>
                            <b>{d.follow.today}</b>
                            <small>다음 액션일이 오늘</small>
                        </div>
                    </>
                )}
                {d.conv && (
                    <div className="kpi">
                        <span>회원가입 · 사용</span>
                        <b>
                            {d.conv.signup} <small className="text-[15px]">/ {d.conv.using}</small>
                        </b>
                        <small>누적 사용 {d.conv.usage_total.toLocaleString()}건</small>
                    </div>
                )}
            </div>

            <div className="grid2">
                <section className="panel">
                    <h2>영업 단계별</h2>
                    {d.by_stage.map((s) => (
                        <div key={s.id} className="bar-row">
                            <span className="truncate">{s.name}</span>
                            <div className="track">
                                <div className="fill" style={{ width: `${(s.count / max(d.by_stage)) * 100}%`, background: s.color }} />
                            </div>
                            <b>{s.count}</b>
                        </div>
                    ))}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                        <span className="hint">미접촉(예정) 구분</span>
                        {d.pre.map((p) => (
                            <span key={p.key} className="badge tint" style={{ '--c': p.color } as React.CSSProperties}>
                                {p.name} {p.count}
                            </span>
                        ))}
                    </div>
                </section>

                {d.follow && (
                    <section className="panel">
                        <h2>
                            다가오는 팔로우업 <small>지연 · 오늘 · 3일 이내</small>
                        </h2>
                        {d.follow.list.length ? (
                            <ul className="grid gap-1">
                                {d.follow.list.map((f) => (
                                    <li key={f.id}>
                                        <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-2" onClick={() => nav(`/hospitals?open=${f.id}`)}>
                                            <FollowBadge f={f.follow} />
                                            <span className="min-w-0 flex-1">
                                                <b className="block truncate">{f.name}</b>
                                                <small className="muted block truncate">
                                                    {f.next_date} · {f.next_todo || '할 일 미입력'}
                                                    {d.scope === 'all' && ` · ${user.get(f.owner_id ?? 0)?.name ?? '담당 없음'}`}
                                                </small>
                                            </span>
                                            <StageBadge id={f.stage_id} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <Empty>가까운 팔로우업이 없습니다</Empty>
                        )}
                    </section>
                )}

                {d.grades && (
                    <section className="panel">
                        <h2>
                            리드 종합 등급 <small>11~15 상 · 6~10 중 · 0~5 하</small>
                        </h2>
                        {d.grades.map((g) => (
                            <div key={g.name} className="bar-row">
                                <span>{g.name}</span>
                                <div className="track">
                                    <div className="fill" style={{ width: `${(g.count / max(d.grades!)) * 100}%`, background: GRADE_C[g.name] }} />
                                </div>
                                <b>{g.count}</b>
                            </div>
                        ))}
                    </section>
                )}

                <section className="panel">
                    <h2>
                        접촉 경로 <small>복수 선택 포함</small>
                    </h2>
                    {d.sources.map((s) => (
                        <div key={s.name} className="bar-row">
                            <span>{s.name}</span>
                            <div className="track">
                                <div className="fill" style={{ width: `${(s.count / max(d.sources)) * 100}%`, background: 'var(--color-brand)' }} />
                            </div>
                            <b>{s.count}</b>
                        </div>
                    ))}
                </section>

                {d.weekly && (
                    <section className="panel">
                        <h2>
                            주간 영업 활동 <small>최근 8주</small>
                        </h2>
                        <div className="flex h-40 items-end gap-2">
                            {d.weekly.map((w) => {
                                const t = w.visit + w.call + w.etc;
                                return (
                                    <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${w.week} 주 · 방문 ${w.visit} · 전화 ${w.call} · 기타 ${w.etc}`}>
                                        <small className="mono muted">{t || ''}</small>
                                        <div className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded" style={{ height: `${(t / wMax) * 100}%` }}>
                                            <div style={{ flex: w.visit, background: 'var(--color-brand)' }} />
                                            <div style={{ flex: w.call, background: 'var(--color-info)' }} />
                                            <div style={{ flex: w.etc, background: 'var(--color-line)' }} />
                                        </div>
                                        <small className="muted text-[11px]">{w.week.slice(5).replace('-', '/')}</small>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex gap-3 text-[12px]">
                            <span className="chip" style={{ '--cc': 'var(--color-brand)' } as React.CSSProperties}>
                                <i />
                                방문
                            </span>
                            <span className="chip" style={{ '--cc': 'var(--color-info)' } as React.CSSProperties}>
                                <i />
                                전화
                            </span>
                            <span className="chip" style={{ '--cc': 'var(--color-line)' } as React.CSSProperties}>
                                <i />
                                기타
                            </span>
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}
