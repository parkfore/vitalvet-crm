// 오늘 할 일 (영업사원): 오늘 갈 곳, 지연 팔로우업, 연락 없는 병원, 내 메모, 이번 주 일정
import { useState } from 'react';
import { blankAct, openDetail } from '../components/HospitalDrawer';
import { StageBadge, css } from '../components/ui';
import { REP_ST } from '../lib/constants';
import {
    attOn, attPeriod, can, compById, canRep, cur, evalN, getH, goalFor, hName, isStale, lastContact, liveH, monOf, mutateH, nearestOrder, need, prevBiz, region, sc,
} from '../lib/domain';
import { I } from '../lib/icons';
import { MAIN_N, notify, reloadState, S, save, setView, STAGES, toast, ui } from '../lib/store';
import { api } from '../lib/api';
import { fmtTs, fmtN } from '../lib/utils';
import type { Hospital } from '../lib/types';
import { addDays, dday, fd, today, uid } from '../lib/utils';
import { goReport } from './Dashboard';
import { visitCount } from '../lib/ux';
import { compDays, compSoon } from '../lib/hinfo';
import { openReportAt } from './Report';
import { locateMe } from '../lib/here';
import { MyGoalStrip } from '../components/Goals';

export function Today() {
    const me = cur()!; const t = today(); const mine = liveH().filter(h => h.ownerId === me.id); const att = attOn(me.id, t, ['approved', 'requested']); const goal = goalFor(me.id, t);
    const actsToday = S.hospitals.flatMap(h => (h.activities || []).filter(a => a.authorId === me.id && a.date === t).map(a => ({ ...a, hid: h.id })));
    const visitedIds = new Set(actsToday.filter(a => a.type === '방문').map(a => a.hid)); const touched = new Set(actsToday.map(a => a.hid));
    const prvRep = S.reports.find(r => r.authorId === me.id && r.date === prevBiz(t)); const planIds = prvRep?.plan?.hospitalIds || [];
    const due = mine.filter(h => h.next?.date && !h.next.done && h.next.date <= t);
    const ids = [...new Set([...planIds, ...due.map(h => h.id)])].filter(id => getH(id) && !getH(id)!.deletedAt);
    const items = ids.map(id => { const h = getH(id)!; return { h, plan: planIds.includes(id), fu: due.includes(h), done: touched.has(id) }; })
        .sort((a, b) => (+a.done - +b.done) || (+(b.fu && dday(b.h.next.date!) < 0) - +(a.fu && dday(a.h.next.date!) < 0)));
    const left = items.filter(x => !x.done).length; const stale = mine.filter(isStale).sort((a, b) => (lastContact(a) || '0').localeCompare(lastContact(b) || '0'));
    const evalNeed = mine.filter(h => STAGES.indexOf(h.stage) >= 1 && STAGES.indexOf(h.stage) < MAIN_N && evalN(h) < 3);
    const week = mine.filter(h => h.next?.date && !h.next.done && h.next.date > t && h.next.date <= addDays(7)).sort((a, b) => a.next.date!.localeCompare(b.next.date!));
    const myAtt = (S.attendance || []).filter(a => a.userId === me.id && ['approved', 'requested'].includes(a.status) && a.to >= t && a.from <= addDays(14));
    const todos = (S.todos || []).filter(x => x.userId === me.id && (!x.done || x.doneAt?.slice(0, 10) === t)).sort((a, b) => (+a.done - +b.done) || a.date.localeCompare(b.date));
    const rep = S.reports.find(r => r.authorId === me.id && r.date === t); const ret = S.reports.filter(r => r.authorId === me.id && r.status === 'returned');
    const wkVisits = visitCount(S.hospitals.flatMap(h => (h.activities || []).map(a => ({ ...a, hid: h.id }))).filter(a => a.authorId === me.id && monOf(a.date) === monOf(t)));
    const pct = goal ? Math.min(100, visitedIds.size / goal * 100) : 100; const overdue = due.filter(h => dday(h.next.date!) < 0).length;
    const [todoText, setTodoText] = useState('');
    // 나에게 남긴 코칭 메모 · 보고서 검토 의견 (관리자·영업팀장)
    const notes = (S.coaching || []).filter(n => n.userId === me.id).sort((a, b) => b.ts.localeCompare(a.ts)); const unread = notes.filter(n => !n.readAt);
    const reviews = S.reports.filter(r => r.authorId === me.id && r.reviewComment && r.reviewedAt && r.reviewedAt.slice(0, 10) >= addDays(-14)).sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''));
    const [showAll, setShowAll] = useState(false);
    // 경쟁 제품 계약 만료가 가까운 내 담당 병원 (재접촉 시점)
    const compList = mine.filter(compSoon).sort((a, b) => (a.compUntil || '').localeCompare(b.compUntil || ''));
    const markRead = async (ids: string[]) => { if (!ids.length) return; try { await api('POST', '/api/me/coaching-read', { ids }); await reloadState(false); toast('확인했습니다'); } catch (e: any) { toast(e.message); } };

    const rec = (h: Hospital, type = '방문') => { if (!need('activity', 'create', h)) return; ui.modal = { type: 'quickAct', f: { ...blankAct(today(), type), hospitalId: h.id } }; notify(); };
    const fuDone = (h: Hospital) => { if (!need('activity', 'update', h)) return; mutateH(h, '영업 활동', x => { x.next = { ...x.next, done: true }; }); toast(`${h.name} 다음 액션 완료`); };
    async function todayRoute() {
        const touchedIds = new Set(S.hospitals.filter(h => (h.activities || []).some(a => a.authorId === me.id && a.date === t)).map(h => h.id));
        const rIds = [...new Set([...planIds, ...liveH().filter(h => h.ownerId === me.id && h.next?.date && !h.next.done && h.next.date <= t).map(h => h.id)])].filter(id => getH(id)?.lat && !touchedIds.has(id));
        if (!rIds.length) { toast('동선에 넣을 곳이 없습니다'); return; }
        // 현재 위치에서 가장 가까운 병원부터 (위치를 못 잡으면 1번 병원부터)
        ui.map.start = { ...ui.map.start, kind: 'here' }; const here = await locateMe();
        ui.map.route = rIds.length > 1 ? nearestOrder(rIds, here) : rIds; ui.map.cats = new Set(); ui.map.stages = new Set(STAGES); Object.assign(ui.map, { sido: '', sigungu: '', owner: '', info: '', grade: '', viewId: '', q: '' }); ui.map.sel = null; ui.map.fitTick++; setView('map'); toast(`${rIds.length}곳으로 동선을 만들었습니다 · ${here ? '현재 위치에서 가까운 순' : `${ui.map.meErr || '현재 위치를 못 찾아'} · 1번 병원부터 (지도의 동선 패널에서 해결 방법 확인)`}`);
    }
    function tdAdd() { const v = todoText.trim(); if (!v) { document.getElementById('todo-text')?.focus(); return; } (S.todos ||= []).push({ id: 'td_' + uid(), userId: me.id, date: today(), text: v, done: false }); setTodoText(''); save(); setTimeout(() => document.getElementById('todo-text')?.focus(), 20); }
    const tdToggle = (id: string) => { const x = S.todos.find(y => y.id === id)!; x.done = !x.done; x.doneAt = x.done ? new Date().toISOString() : ''; save(); };
    const tdDel = (id: string) => { S.todos = S.todos.filter(y => y.id !== id); save(); };
    const openEval = (id: string) => openDetail(id, 'eval');

    return <>
        <div className="page-head"><div><h1>오늘 할 일</h1><p>{fd(t)} · {me.name}님{att ? <> · <span className={`badge ${att.status === 'approved' ? 'f-오늘' : 'st-pending'}`}>{att.type}{att.status === 'requested' ? ' 승인 대기' : ''}</span></> : null}</p></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{items.some(x => !x.done && x.h.lat) ? <button className="btn" onClick={todayRoute}>{I.route}남은 곳으로 동선 만들기</button> : null}
                {canRep('create') ? <button className="btn primary" onClick={() => goReport('write')}>{I.report}오늘 보고서 {rep ? REP_ST[rep.status][0] : '작성'}</button> : null}</div></div>
        {unread.length ? <div className="notice" style={{ marginBottom: 12 }}><span>새 코칭 메모 {fmtN(unread.length)}건 · {unread[0].authorName}: {unread[0].text.slice(0, 40)}{unread[0].text.length > 40 ? '…' : ''}</span><button className="btn sm" onClick={() => document.getElementById('coachPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>보기</button></div> : null}
        {ret.length ? <div className="notice warn" style={{ marginBottom: 12 }}><span>반려된 보고서 {fmtN(ret.length)}건 · {ret.map(r => fd(r.date)).join(', ')}</span><button className="btn sm" onClick={() => openReportAt(ret[0].date)}>보완하기</button></div> : null}
        <div className="kpis today-kpis"><div className="kpi"><span>오늘 방문</span><b>{fmtN(visitedIds.size)}<small style={{ fontSize: 14 }}> / {goal}</small></b><div className="meter"><i style={{ width: `${pct}%`, background: visitedIds.size >= goal ? 'var(--ok)' : 'var(--accent)' }} /></div></div>
            <div className="kpi"><span>남은 방문·액션</span><b>{fmtN(left)}</b><small>오늘 목록 {fmtN(items.length)}곳 중</small></div>
            <div className={`kpi ${overdue ? 'alert' : ''}`}><span>지연된 팔로우업</span><b>{fmtN(overdue)}</b><small>기한이 지난 다음 액션</small></div>
            <div className="kpi"><span>이번 주 방문</span><b>{fmtN(wkVisits)}</b><small>월요일부터 누계</small></div></div>
        <MyGoalStrip uid={me.id} />
        <div className="today-grid"><div className="tg-main">
            <section className="panel"><h2>오늘 갈 곳·할 일 <small>어제 보고서의 내일 계획 + 오늘까지인 다음 액션</small></h2>{items.length ? <ul className="td-list">{items.map(x => {
                const h = x.h; const od = x.fu && dday(h.next.date!) < 0;
                return <li key={h.id} className={`td-item ${x.done ? 'done' : ''}`}><span className="td-check">{x.done ? I.check : null}</span><div style={{ minWidth: 0 }}>
                    <div className="td-name"><button className="au-target" onClick={() => openDetail(h.id)}>{h.name}</button><StageBadge s={h.stage} />{x.plan ? <span className="cat-chip">어제 계획</span> : null}{x.fu ? <span className={`badge ${od ? 'f-지연' : 'f-오늘'}`}>{od ? `지연 ${-dday(h.next.date!)}일` : '오늘 액션'}</span> : null}</div>
                    <div className="h-sub">{x.fu ? h.next.todo || '할 일 미입력' : ''}{x.fu ? ' · ' : ''}{region(h)}{h.director ? ` · ${h.director} 원장` : ''}{h.directorPhone ? <> · <span className="mono">{h.directorPhone}</span></> : null}</div></div>
                    <div className="td-btns">{x.done ? <span className="h-sub">오늘 기록함</span> : <button className="btn sm primary" onClick={() => rec(h)}>기록</button>}{x.fu && can('activity', 'update', h) ? <button className="btn sm" onClick={() => fuDone(h)}>액션 완료</button> : null}</div></li>;
            })}</ul> : <div className="empty">오늘 예정된 곳이 없습니다. 아래 추천에서 골라 보세요.</div>}</section>
            {compList.length ? <section className="panel" id="compSoon"><h2>경쟁 제품 계약 만료 임박 <small>{fmtN(compList.length)}곳 · 만료 30일 전부터 재접촉</small></h2><ul className="td-list">{compList.map(h => { const d = compDays(h)!; return <li key={h.id} className="td-item"><span className="td-check" />
                <div style={{ minWidth: 0 }}><div className="td-name"><button className="au-target" onClick={() => openDetail(h.id)}>{h.name}</button><span className={`badge ${d < 0 ? 'a-delete' : d <= 7 ? 'f-오늘' : 'f-예정'}`}>{d < 0 ? `만료 ${-d}일 지남` : d === 0 ? '오늘 만료' : `D-${d}`}</span></div>
                    <div className="h-sub">{compById(h.compId)?.name || '경쟁 제품'} · 만료 {fd(h.compUntil)}{h.director ? ` · ${h.director} 원장` : ''}{h.directorPhone ? <> · <span className="mono">{h.directorPhone}</span></> : null}</div></div>
                <div className="td-btns"><button className="btn sm" onClick={() => rec(h, '전화')}>전화 기록</button><button className="btn sm primary" onClick={() => rec(h)}>방문 기록</button></div></li>; })}</ul></section> : null}
            <section className="panel"><h2>2주 넘게 연락 없는 담당 병원 <small>{fmtN(stale.length)}곳 · 오래된 순</small></h2>{stale.length ? <ul className="td-list">{stale.slice(0, 8).map(h => <li key={h.id} className="td-item"><span className="td-dot" style={{ background: sc(h.stage) }} /><div style={{ minWidth: 0 }}>
                <div className="td-name"><button className="au-target" onClick={() => openDetail(h.id)}>{h.name}</button><StageBadge s={h.stage} /></div><div className="h-sub">마지막 접촉 {fd(lastContact(h)) || '없음'} · {region(h)}</div></div>
                <div className="td-btns"><button className="btn sm" onClick={() => rec(h, '전화')}>전화 기록</button></div></li>)}</ul> : <div className="empty">모든 담당 병원과 최근 2주 안에 연락했습니다</div>}</section>
            {evalNeed.length ? <section className="panel"><h2>리드 평가가 덜 된 병원 <small>{fmtN(evalNeed.length)}곳</small></h2><div className="chips">{evalNeed.slice(0, 12).map(h => <button key={h.id} className="chip-toggle" style={css({ '--cc': sc(h.stage) })} onClick={() => openEval(h.id)}><i />{h.name} · {evalN(h)}/3</button>)}</div></section> : null}
        </div><div className="tg-side">
                <section className="panel" id="coachPanel"><h2>받은 코칭 메모 {unread.length ? <span className="badge a-delete">새 메모 {unread.length}</span> : <small>{fmtN(notes.length)}건</small>}</h2>
                    {notes.length ? <ul className="audit">{(showAll ? notes : notes.slice(0, 4)).map(n => <li key={n.id} className="au" style={!n.readAt ? { background: 'var(--warn-soft)', borderRadius: 8, padding: 8 } : undefined}>
                        <div className="au-meta"><b>{n.authorName}</b><span className="mono">{fmtTs(n.ts)}</span>{n.readAt ? <span className="h-sub">확인함</span> : <button className="btn sm" onClick={() => markRead([n.id])}>확인</button>}</div>
                        <p className="au-sum" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.text}</p></li>)}</ul> : <p className="hint">관리자·영업팀장이 팀 성과에서 남긴 메모가 여기에 보입니다.</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{notes.length > 4 ? <button className="btn sm ghost" onClick={() => setShowAll(!showAll)}>{showAll ? '접기' : `전체 ${fmtN(notes.length)}건 보기`}</button> : null}{unread.length > 1 ? <button className="btn sm" onClick={() => markRead(unread.map(n => n.id))}>모두 확인</button> : null}</div>
                    {reviews.length ? <><h3 className="rv-h">보고서 검토 의견 <small className="hint">최근 2주</small></h3><ul className="plain">{reviews.slice(0, 5).map(r => <li key={r.id}><button className="au-target" onClick={() => openReportAt(r.date)}>{fd(r.date)} 보고서</button> <span className={`badge ${REP_ST[r.status][1]}`}>{REP_ST[r.status][0]}</span><div className="h-sub" style={{ whiteSpace: 'pre-wrap' }}>{r.reviewComment}</div></li>)}</ul></> : null}
                </section>
                <section className="panel"><h2>내 메모·할 일 <small>나만 보입니다</small></h2><div className="inline-add" style={{ marginBottom: 10 }}><input id="todo-text" value={todoText} onChange={e => setTodoText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); tdAdd(); } }} placeholder="예: 견적서 PDF 다시 보내기" /><button className="btn" data-act="tdAdd" onClick={tdAdd}>추가</button></div>
                    {todos.length ? <ul className="todo-list">{todos.map(x => <li key={x.id} className={x.done ? 'done' : ''}><label className="check"><input type="checkbox" data-act="tdToggle" data-v={x.id} checked={x.done} onChange={() => tdToggle(x.id)} /><span>{x.text}</span></label>{x.date < t && !x.done ? <small className="h-sub">{fd(x.date)}부터</small> : null}<button className="icon-btn" onClick={() => tdDel(x.id)} aria-label="삭제">{I.x}</button></li>)}</ul> : <p className="hint">못 끝낸 할 일은 다음 날로 넘어갑니다.</p>}</section>
                <section className="panel"><h2>이번 주 다가오는 일정</h2>{week.length || myAtt.length ? <ul className="plain">{myAtt.map(a => <li key={a.id}><span className={`badge ${a.status === 'approved' ? 'f-오늘' : 'st-pending'}`}>{a.type}</span> {attPeriod(a)}</li>)}
                    {week.map(h => <li key={h.id}><span className="mono h-sub">{fd(h.next.date)}</span> <button className="au-target" onClick={() => openDetail(h.id)}>{h.name}</button> <span className="h-sub">{h.next.todo || ''}</span></li>)}</ul> : <p className="hint">7일 안에 예정된 일이 없습니다</p>}</section>
                <section className="panel"><h2>오늘 기록한 활동 <small>{fmtN(actsToday.length)}건</small></h2>{actsToday.length ? <ul className="plain">{actsToday.map(a => <li key={a.id}><b>{hName(a.hid)}</b> <span className="h-sub">{a.type}{a.purpose ? ' · ' + a.purpose : ''}{a.reaction ? ' · ' + a.reaction : ''}</span></li>)}</ul> : <p className="hint">아직 없습니다. 방문 후 바로 ‘기록’을 누르세요.</p>}</section>
            </div></div>
    </>;
}
