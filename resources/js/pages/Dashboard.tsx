// 대시보드: 알림, 핵심 숫자, 단계별 병원, 팔로우업, 차트, 카테고리 × 단계
import { Chart, Legend, TableView, type ColSpec, type HbarSpec } from '../components/charts';
import { FollowBadge, Locked, StageBadge, css } from '../components/ui';
import { EVAL_TOTAL, LEAD_SOURCES, PRE_TYPES } from '../lib/constants';
import {
    attManager, attOn, can, canEvalStage, canRead, canRep, canReview, cur, followOf, gradeOf, inCat, initialStage, isBiz, isOffDay,
    liveH, prevBiz, roleOf, sc, scoreOf, userName,
} from '../lib/domain';
import { I } from '../lib/icons';
import { S, setView, STAGES, ui } from '../lib/store';
import { addDays, dday, fd, fmtD, today } from '../lib/utils';
import { openDetail, openRegister } from '../components/HospitalDrawer';
import { openReportAt } from './Report';

export const goReport = (tab: string) => { ui.rep.tab = tab; ui.rep.date = today(); setView('report'); };

/** 대시보드 맨 위 알림 (근태·보고서) */
export function DashNotice() {
    const out: React.ReactNode[] = []; const me = cur()!;
    if (attManager()) {
        const ab = S.users.filter(u => u.status === 'active' && attOn(u.id, today()));
        if (ab.length) out.push(<div key="ab" className="notice"><span>오늘 근태 · {ab.map(u => `${u.name} ${attOn(u.id, today())!.type}`).join(', ')}</span><button className="btn sm" onClick={() => setView('attend')}>근태 일정</button></div>);
        const pa = (S.attendance || []).filter(a => a.status === 'requested' && (a.userId !== me.id || roleOf(me)!.id === 'r_admin')).length;
        if (pa) out.push(<div key="pa" className="notice warn"><span>근태 승인 대기 {pa}건</span><button className="btn sm primary" onClick={() => setView('attend')}>승인하기</button></div>);
    }
    if (canRep('create')) {
        const r = S.reports.find(x => x.authorId === me.id && x.date === today()); const pd = prevBiz(today()); const prv = S.reports.find(x => x.authorId === me.id && x.date === pd);
        const ret = S.reports.filter(x => x.authorId === me.id && x.status === 'returned');
        if (ret.length) out.push(<div key="ret" className="notice warn"><span>반려된 보고서 {ret.length}건 · {ret.map(x => fd(x.date)).join(', ')}</span><button className="btn sm" onClick={() => openReportAt(ret[0].date)}>보완하기</button></div>);
        if ((!prv || prv.status === 'draft') && !isOffDay(me.id, pd)) out.push(<div key="prv" className="notice"><span>{fd(pd)} 보고서를 {prv ? '임시 저장만 하고 제출하지 않았습니다' : '아직 작성하지 않았습니다'}</span><button className="btn sm" onClick={() => openReportAt(pd)}>작성하기</button></div>);
        if (isBiz(today()) && !isOffDay(me.id, today()) && (!r || r.status === 'draft')) out.push(<div key="td" className="notice"><span>오늘({fd(today())}) 일일 보고서 {r ? '임시 저장됨' : '작성 전'} · 활동을 기록하면 자동으로 집계됩니다</span><button className="btn sm primary" onClick={() => goReport('write')}>보고서 작성</button></div>);
    }
    const pend = S.reports.filter(r => r.status === 'submitted' && canReview(r)).length;
    if (pend) out.push(<div key="pend" className="notice"><span>검토를 기다리는 보고서 {pend}건</span><button className="btn sm primary" onClick={() => goReport('status')}>검토하기</button></div>);
    return out.length ? <div className="notices">{out}</div> : null;
}

function DashCharts() {
    const H = liveH(); const out: React.ReactNode[] = [];
    if (canRead('activity')) {
        const mon = (d: string) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return fmtD(x); };
        const w0 = mon(today()); const weeks = [...Array(8)].map((_, i) => addDays(-7 * (7 - i), w0));
        const AT: [string, (a: any) => boolean, string][] = [['방문', a => a.type === '방문', 'var(--v1)'], ['통화', a => a.type === '전화', 'var(--v2)'], ['문자·메일·기타', a => a.type !== '방문' && a.type !== '전화', 'var(--v3)']];
        const acts = H.flatMap(h => (h.activities || []).map(a => ({ ...a, hid: h.id }))).filter((a, i, all) => a.type !== '방문' || all.findIndex(b => b.type === '방문' && b.hid === a.hid && b.date === a.date) === i);
        const sp: ColSpec = { type: 'col', stacked: true, h: 220, title: '주간 영업 활동', labels: weeks.map(w => w.slice(5).replace('-', '/')), full: weeks.map((w, i) => `${fd(w)} 시작 주${i === 7 ? ' (이번 주)' : ''}`), unit: '건', series: AT.map(([n, f, c]) => ({ name: n, color: c, values: weeks.map(w => acts.filter(a => mon(a.date) === w && f(a)).length) })) };
        out.push(<section key="w" className="panel"><h2>주간 영업 활동 <small>최근 8주 · 활동 기록 기준</small></h2><Legend series={sp.series} /><Chart spec={sp} /><TableView head={['주 시작', ...sp.series.map(s => s.name)]} rows={sp.labels.map((l, i) => [l, ...sp.series.map(s => s.values[i])])} /></section>);
    }
    if (canRead('eval')) {
        const G = [['상', 'var(--hot)'], ['중', 'var(--warm)'], ['하', 'var(--cold)'], ['미평가', 'var(--none)']];
        const rows = G.map(([g, c]) => ({ label: g, segs: [{ name: '병원', color: c, value: H.filter(h => gradeOf(h) === g).length }] }));
        const s = H.map(scoreOf).filter(v => v != null) as number[];
        out.push(<section key="g" className="panel"><h2>리드 등급 분포 <small>상 11~15점 · 중 6~10점 · 하 0~5점</small></h2><Chart spec={{ type: 'hbar', title: '리드 등급', rows, unit: '곳', labelW: 64 }} />
            <p className="hint" style={{ marginTop: 6 }}>평가를 마친 병원 {H.filter(h => gradeOf(h) !== '미평가').length}곳 · 평가 대상(1차 방문 이후) {H.filter(canEvalStage).length}곳 · 평균 {s.length ? (s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) : '—'}/{EVAL_TOTAL}점</p></section>);
    }
    {
        const pre = Object.entries(PRE_TYPES).map(([k, [l, c]]) => ({ label: l, segs: [{ name: '병원', color: c, value: H.filter(h => h.stage === initialStage() && h.pre === k).length }] }));
        const src = LEAD_SOURCES.map(x => ({ label: x, segs: [{ name: '병원', color: 'var(--v1)', value: H.filter(h => (h.sources || []).includes(x)).length }] }));
        out.push(<section key="p" className="panel"><h2>{initialStage()} 구분 <small>접촉 전 병원의 다음 할 일</small></h2><Chart spec={{ type: 'hbar', title: '예정 구분', rows: pre, unit: '곳', labelW: 96 }} />
            <h2 style={{ marginTop: 14 }}>접촉 경로 <small>복수 선택 · 병원 수</small></h2><Chart spec={{ type: 'hbar', title: '접촉 경로', rows: src, unit: '곳', labelW: 72 }} /></section>);
    }
    const owners = S.users.filter(u => H.some(h => h.ownerId === u.id));
    const pipe: HbarSpec = {
        type: 'hbar', title: '담당자별 파이프라인', unit: '곳', labelW: 80,
        rows: [...owners.map(u => ({ label: u.name, segs: STAGES.map(s => ({ name: s, color: sc(s), value: H.filter(h => h.ownerId === u.id && h.stage === s).length })) })),
        ...(H.some(h => !h.ownerId) ? [{ label: '담당 미지정', segs: STAGES.map(s => ({ name: s, color: sc(s), value: H.filter(h => !h.ownerId && h.stage === s).length })) }] : [])],
    };
    out.push(<section key="o" className="panel"><h2>담당자별 파이프라인 <small>영업 단계 구성</small></h2><Legend series={STAGES.map(s => ({ name: s, color: sc(s) }))} /><Chart spec={pipe} /><TableView head={['담당자', ...STAGES]} rows={pipe.rows.map(r => [r.label, ...r.segs.map(s => s.value)])} /></section>);
    const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return fmtD(d).slice(0, 7); });
    const ser = [{ name: '신규 등록', color: 'var(--v1)', values: months.map(m => S.hospitals.filter(h => h.createdAt?.startsWith(m)).length) as (number | null)[] }];
    if (canRead('conv')) ser.push({ name: '회원가입', color: 'var(--v2)', values: months.map(m => H.filter(h => h.signupDate?.startsWith(m)).length) });
    const mc: ColSpec = { type: 'col', stacked: false, h: 220, title: '월별 신규 등록·회원가입', labels: months.map(m => `${+m.slice(5)}월`), full: months.map(m => `${m.slice(0, 4)}년 ${+m.slice(5)}월`), unit: '곳', series: ser };
    out.push(<section key="m" className="panel"><h2>월별 신규 등록{canRead('conv') ? '·회원가입' : ''} <small>최근 6개월</small></h2><Legend series={ser} /><Chart spec={mc} /><TableView head={['월', ...ser.map(s => s.name)]} rows={mc.labels.map((l, i) => [l, ...ser.map(s => s.values[i])])} /></section>);
    return <div className="dash-grid">{out}</div>;
}

export function Dashboard() {
    const H = liveH(); const cnt = (f: (h: any) => boolean) => H.filter(f).length; const fl = H.map(h => followOf(h)); const conv = canRead('conv'); const act = canRead('activity');
    const k: [string, any, string, boolean?][] = [
        ['전체 병원', H.length, `${initialStage()} ${cnt(h => h.stage === initialStage())}곳`], ['미평가', cnt(h => gradeOf(h) === '미평가'), '리드 평가 입력 필요'],
        ['리드 상', cnt(h => gradeOf(h) === '상'), `중 ${cnt(h => gradeOf(h) === '중')} · 하 ${cnt(h => gradeOf(h) === '하')}`],
        ...(conv ? [['회원가입 병원', cnt(h => h.signupDate), '가입일 입력 기준'], ['VitalVET 사용 병원', cnt(h => +h.usageCount > 0), '누적 사용 1건 이상'], ['누적 사용 건수', H.reduce((a, h) => a + (+h.usageCount || 0), 0).toLocaleString(), '전체 병원 합계']] as [string, any, string][] : []),
        ...(act ? [['팔로우업 지연', fl.filter(f => f === '지연').length, '다음 액션일 경과', true], ['오늘 할 일', fl.filter(f => f === '오늘').length, '다음 액션일 = 오늘']] as [string, any, string, boolean?][] : []),
    ];
    const max = Math.max(...STAGES.map(s => cnt(h => h.stage === s)), 1);
    const me = cur()!;
    const todo = H.filter(h => ['지연', '오늘'].includes(followOf(h)) || (followOf(h) === '예정' && dday(h.next.date!) <= 3))
        .sort((a, b) => (+(b.ownerId === me.id) - +(a.ownerId === me.id)) || a.next.date!.localeCompare(b.next.date!));
    const rows = [...S.categories.map(c => ({ key: c.id, name: c.name, color: c.color })), { key: '__none', name: '미분류', color: 'var(--none)' }];
    const mx = Math.max(1, ...rows.flatMap(rw => STAGES.map(s => H.filter(h => inCat(h, rw.key) && h.stage === s).length)));
    const listStage = (s: string) => { if (!canRead('hospital')) return; ui.list = { ...ui.list, stage: s, cat: '', q: '', deleted: false }; setView('list'); };
    const mapCat = (key: string) => { if (!canRead('map')) return; ui.map.cats = new Set(key ? [key] : []); ui.map.stages = new Set(STAGES); Object.assign(ui.map, { sido: '', sigungu: '', owner: '', info: '', grade: '', viewId: '', q: '' }); ui.map.sel = null; setView('map'); };

    return <>
        <div className="page-head"><div><h1>영업 현황</h1><p>{fd(today())} 기준 · {me.name}님({roleOf(me)!.name})으로 보는 중</p></div>
            {can('hospital', 'create') ? <button className="btn primary" data-act="newH" onClick={openRegister}>{I.plus}병원 등록</button> : null}</div>
        <DashNotice />
        <div className="kpis">{k.map(([l, v, s, al]) => <div key={l} className={`kpi ${al && v > 0 ? 'alert' : ''}`}><span>{l}</span><b>{v}</b><small>{s}</small></div>)}</div>
        <div className="dash-grid">
            <section className="panel"><h2>영업 단계별 병원 <small>단계를 누르면 목록으로 이동</small></h2><div className="funnel">
                {STAGES.map(s => { const c = cnt(h => h.stage === s); return <div key={s} className="funnel-row" style={css({ '--c': sc(s), cursor: 'pointer' })} onClick={() => listStage(s)}><span>{s}</span><div className="bar"><i style={{ width: `${c / max * 100}%` }} /></div><b>{c}</b></div>; })}
            </div></section>
            {act ? <section className="panel"><h2>팔로우업 <small>내 담당 먼저 · 지연 · 오늘 · 3일 이내</small></h2>
                {todo.length ? <ul className="todo">{todo.map(h => <li key={h.id} onClick={() => openDetail(h.id)}><FollowBadge h={h} /><div style={{ minWidth: 0 }}><div className="t-name">{h.name}{h.ownerId === me.id ? <> <span className="badge f-예정" style={{ padding: '0 6px' }}>내 담당</span></> : null}</div><div className="t-sub">{h.next.todo || '할 일 미입력'} · {userName(h.ownerId) || '담당 미지정'}</div></div><span className="mono muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fd(h.next.date)}</span></li>)}</ul>
                    : <div className="empty">예정된 팔로우업이 없습니다</div>}
            </section> : <section className="panel"><Locked f="activity" /></section>}
        </div>
        <DashCharts />
        <section className="panel"><h2>카테고리 × 영업 단계 <small>{canRead('map') ? '행을 누르면 지도에서 해당 카테고리를 봅니다' : ''}</small></h2>
            <div className="tbl-wrap" style={{ border: 0 }}><table className="matrix"><thead><tr><th>카테고리</th>{STAGES.map(s => <th key={s}><StageBadge s={s} pad /></th>)}<th>합계</th></tr></thead><tbody>
                {rows.map(rw => {
                    const inR = H.filter(h => inCat(h, rw.key));
                    return <tr key={rw.key} className="row" onClick={canRead('map') ? () => mapCat(rw.key) : undefined}>
                        <td><span className={`cat-chip ${rw.key === '__none' ? 'none' : ''}`} style={css({ '--cc': rw.color })}>{rw.key === '__none' ? '' : <i />}{rw.name}</span></td>
                        {STAGES.map(s => { const c = inR.filter(h => h.stage === s).length; return <td key={s}><span className="cell" style={{ background: c ? `color-mix(in srgb,${sc(s)} ${Math.round(12 + c / mx * 50)}%,transparent)` : 'none' }}>{c || <span className="muted">·</span>}</span></td>; })}
                        <td><b>{inR.length}</b></td></tr>;
                })}
            </tbody></table></div><p className="hint" style={{ marginTop: 8 }}>한 병원이 여러 카테고리에 속하면 각 행에 모두 집계됩니다.</p></section>
    </>;
}
