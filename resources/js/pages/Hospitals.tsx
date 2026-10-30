// 병원 관리: 검색·필터·정렬, 표(PC)·카드(휴대폰), 삭제된 병원
import { useEffect, useState } from 'react';
import { openDetail, openRegister } from '../components/HospitalDrawer';
import { BizBadge, CatChips, FollowBadge, GradeBadge, InfoBadges, PreBadge, StageBadge } from '../components/ui';
import { BIZ, bizOf, infoMatch, SIDO_ORDER, sidoOf } from '../lib/hinfo';
import { AGE_GROUPS, LEAD_SOURCES, PRE_TYPES } from '../lib/constants';
import { can, canImport, canRead, cur, preOf, followOf, gradeOf, inCat, initialStage, region, roleOf, scoreOf, userName } from '../lib/domain';
import { I } from '../lib/icons';
import { notify, reloadState, S, STAGES, toast, ui, waitSync } from '../lib/store';
import { api } from '../lib/api';
import { exportHospitals } from '../lib/exporter';
import type { Hospital } from '../lib/types';
import { fd, fmtN } from '../lib/utils';

export function useNarrow(px = 860) {
    const [n, setN] = useState(window.innerWidth <= px);
    useEffect(() => { let t: any; const f = () => { clearTimeout(t); t = setTimeout(() => setN(window.innerWidth <= px), 150); }; window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, [px]);
    return n;
}

export function filteredList(): Hospital[] {
    const L = ui.list; const q = L.q.trim().toLowerCase(); const me = cur()!.id;
    const r = S.hospitals.filter(h => !!h.deletedAt === L.deleted && (!q || [h.name, h.director, h.directorNote, h.address, h.jibun, h.id, h.phone].join(' ').toLowerCase().includes(q))
        && (!L.cat || inCat(h, L.cat)) && (!L.stage || h.stage === L.stage) && (!L.pre || preOf(h) === L.pre) && (!L.src || (h.sources || []).includes(L.src))
        && (!L.grade || gradeOf(h) === L.grade) && (!L.follow || followOf(h) === L.follow) && (!L.owner || h.ownerId === (L.owner === '__me' ? me : L.owner === '__none' ? '' : L.owner))
        && (!L.age || (L.age === '__none' ? !h.directorAge : h.directorAge === L.age)) && (!L.biz || bizOf(h) === L.biz) && infoMatch(h, L.info) && (!L.sido || sidoOf(h) === L.sido));
    const s = L.sort; const nx = (h: Hospital) => (h.next?.date && !h.next.done ? h.next.date : '9999');
    return r.sort((a, b) => s === 'name' ? a.name.localeCompare(b.name, 'ko') : s === 'score' ? (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1) : s === 'next' ? nx(a).localeCompare(nx(b)) : a.id.localeCompare(b.id));
}

function Opts({ arr, all }: { arr: (string | [string, string])[]; all: string }) {
    return <><option value="">{all}</option>{arr.map(x => Array.isArray(x) ? <option key={x[0]} value={x[0]}>{x[1]}</option> : <option key={x}>{x}</option>)}</>;
}

export function Hospitals() {
    const L = ui.list; const delN = S.hospitals.filter(h => h.deletedAt).length; const r = roleOf(cur());
    const set = (k: keyof typeof L) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { (L as any)[k] = e.target.value; notify(); };
    return <>
        <div className="page-head"><div><h1>병원 관리</h1><p>병원을 눌러 평가·방문 기록·전환 정보와 변경 이력을 확인하세요{r?.scope === 'own' ? ' · 수정은 내 담당 병원만 가능' : ''}</p></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {can('hospital', 'delete') && delN ? <button className={`btn ${L.deleted ? 'primary' : ''}`} data-act="toggleDeleted" onClick={() => { L.deleted = !L.deleted; notify(); }}>{L.deleted ? '병원 목록으로' : `삭제된 병원 ${delN}`}</button> : null}
                {canAssign() && !L.deleted ? <button className={`btn ${ui.pick.on ? 'primary' : ''}`} data-act="pickMode" onClick={() => { ui.pick.on = !ui.pick.on; ui.pick.ids.clear(); notify(); }}>{ui.pick.on ? '선택 끝내기' : '담당 일괄 지정'}</button> : null}
                {canRead('hospital') ? <button className="btn" data-act="exportH" onClick={() => { const l = filteredList(); if (!l.length) { toast('내보낼 병원이 없습니다'); return; } exportHospitals(l).then(() => toast(`${fmtN(l.length)}곳을 엑셀로 내보냈습니다`)).catch(e => toast('내보내기 실패: ' + e.message)); }}>{I.download}엑셀</button> : null}
                {canImport() && !L.deleted ? <button className="btn" data-act="importH" onClick={() => { ui.modal = { type: 'import', tab: 'file' }; notify(); }}>{I.upload}가져오기</button> : null}
                {can('hospital', 'create') && !L.deleted ? <button className="btn primary" data-act="newH" onClick={openRegister}>{I.plus}병원 등록</button> : null}</div></div>
        <div className="toolbar"><label className="search">{I.search}<input type="search" id="lq" placeholder="병원명, 원장님, 원장님 메모, 주소, Lead # 검색" value={L.q} onChange={set('q')} /></label>
            <select id="lcat" value={L.cat} onChange={set('cat')} aria-label="카테고리"><Opts arr={[...S.categories.map(c => [c.id, c.name] as [string, string]), ['__none', '미분류']]} all="카테고리 전체" /></select>
            <select id="lstage" value={L.stage} onChange={set('stage')} aria-label="단계"><Opts arr={STAGES} all="단계 전체" /></select>
            <select id="lpre" value={L.pre} onChange={set('pre')} aria-label="예정 구분"><Opts arr={Object.entries(PRE_TYPES).map(([k, [l]]) => [k, l] as [string, string])} all="예정 구분 전체" /></select>
            <select id="lsrc" value={L.src} onChange={set('src')} aria-label="접촉 경로"><Opts arr={LEAD_SOURCES} all="접촉 경로 전체" /></select>
            {canRead('eval') ? <select id="lgrade" value={L.grade} onChange={set('grade')} aria-label="리드 등급"><Opts arr={['상', '중', '하', '미평가']} all="리드 등급 전체" /></select> : null}
            {canRead('activity') ? <select id="lfollow" value={L.follow} onChange={set('follow')} aria-label="팔로우업"><Opts arr={['지연', '오늘', '예정', '완료', '없음']} all="팔로우업 전체" /></select> : null}
            <select id="lage" value={L.age} onChange={set('age')} aria-label="원장님 나이대"><Opts arr={[...AGE_GROUPS, ['__none', '나이대 미입력']]} all="원장 나이대 전체" /></select>
            <select id="lsido" value={L.sido} onChange={set('sido')} aria-label="지역"><Opts arr={sidoList()} all="지역 전체" /></select>
            <select id="lbiz" value={L.biz} onChange={set('biz')} aria-label="영업 상태"><Opts arr={BIZ} all="영업 상태 전체" /></select>
            <select id="linfo" value={L.info} onChange={set('info')} aria-label="정보"><Opts arr={[['incomplete', '정보 미완성'], ['complete', '필수 정보 완성'], ['nogeo', '좌표 없음'], ['imported', '가져온 병원'], ['compSoon', '경쟁 제품 계약 만료 임박']]} all="정보 전체" /></select>
            <select id="lowner" value={L.owner} onChange={set('owner')} aria-label="담당자"><Opts arr={[['__me', '내 담당'], ['__none', '담당 미지정'], ...S.users.filter(u => u.status === 'active').map(u => [u.id, u.name] as [string, string])]} all="담당자 전체" /></select>
            <select id="lsort" value={L.sort} onChange={set('sort')} aria-label="정렬">{[['id', '등록순'], ['name', '병원명순'], ['score', '리드 등급 높은순'], ['next', '다음 액션일 빠른순']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        {ui.pick.on && !L.deleted ? <AssignBar /> : null}
        <div id="listBody"><ListBody /></div>
    </>;
}

const canAssign = () => can('hospital', 'update') && roleOf(cur())?.scope === 'all';

/** 담당 일괄 지정: 고른 병원(또는 지금 목록 전체)의 담당 영업사원을 한 번에 바꾼다 */
function AssignBar() {
    const P = ui.pick; const all = filteredList().filter(h => !h.deletedAt); const [owner, setOwner] = useState(''); const [busy, setBusy] = useState(false);
    const allOn = all.length > 0 && all.every(h => P.ids.has(h.id));
    async function apply() {
        const ids = [...P.ids]; if (!ids.length) { toast('병원을 고르세요'); return; }
        setBusy(true);
        try { await waitSync(); const r = await api<{ changed: number }>('POST', '/api/hospitals/assign', { ids, ownerId: owner }); await reloadState(true); P.ids.clear(); toast(`${fmtN(r.changed)}곳의 담당을 ${owner ? userName(owner) : '미지정'}(으)로 바꿨습니다`); }
        catch (e: any) { toast(e.message); } finally { setBusy(false); notify(); }
    }
    return <div className="pick-bar"><b>{fmtN(P.ids.size)}곳 선택</b>
        <button className="btn sm" onClick={() => { if (allOn) all.forEach(h => P.ids.delete(h.id)); else all.forEach(h => P.ids.add(h.id)); notify(); }}>{allOn ? '지금 목록 선택 해제' : `지금 목록 전체 선택 (${fmtN(all.length)}곳)`}</button>
        {P.ids.size ? <button className="btn sm ghost" onClick={() => { P.ids.clear(); notify(); }}>모두 해제</button> : null}
        <span className="pick-sp" /><label className="fld-inline">담당 <select value={owner} onChange={e => setOwner(e.target.value)}><option value="">미지정</option>{S.users.filter(u => u.status === 'active').map(u => <option key={u.id} value={u.id}>{u.name}{u.team ? ` (${u.team})` : ''}</option>)}</select></label>
        <button className="btn primary sm" disabled={busy || !P.ids.size} onClick={apply}>{busy ? '바꾸는 중…' : '담당 지정'}</button></div>;
}

export function sidoList() { const have = new Set(S.hospitals.map(sidoOf).filter(Boolean)); return [...SIDO_ORDER.filter(x => have.has(x)), ...[...have].filter(x => !SIDO_ORDER.includes(x)).sort()]; }

const PAGE = 200;
function ListBody() {
    const all = filteredList(); const narrow = useNarrow(); const L = ui.list;
    const fkey = JSON.stringify(L); const [lim, setLim] = useState({ k: fkey, n: PAGE }); const limit = lim.k === fkey ? lim.n : PAGE;
    const r = all.slice(0, limit);
    const more = all.length > r.length ? <div className="more-row"><button className="btn" onClick={() => setLim({ k: fkey, n: limit + PAGE })}>더 보기 ({r.length.toLocaleString('ko-KR')} / {all.length.toLocaleString('ko-KR')}곳)</button></div> : null; const ev = canRead('eval'), ac = canRead('activity'); const me = cur()!.id;
    if (!r.length) return <div className="panel empty">{L.deleted ? '삭제된 병원이 없습니다' : '조건에 맞는 병원이 없습니다. 필터를 바꾸거나 새 병원을 등록하세요.'}</div>;
    const head = <p className="count-line">{all.length.toLocaleString('ko-KR')}곳{L.deleted ? ' · 삭제된 병원은 복원 전까지 다른 화면에 나오지 않습니다' : ''}</p>;
    const P = ui.pick; const picking = P.on && !L.deleted;
    const tog = (id: string) => { if (P.ids.has(id)) P.ids.delete(id); else P.ids.add(id); notify(); };
    const click = (id: string) => (picking ? tog(id) : openDetail(id));
    if (narrow) return <>{head}<div className="cards">{r.map(h => <button key={h.id} className={`hcard ${bizOf(h) === '폐업' ? 'is-closed' : ''} ${picking && P.ids.has(h.id) ? 'picked' : ''}`} data-id={h.id} onClick={() => click(h.id)}>{picking ? <span className={`pick-box ${P.ids.has(h.id) ? 'on' : ''}`}>{P.ids.has(h.id) ? I.check : null}</span> : null}
        <div className="hcard-top"><div style={{ minWidth: 0 }}><div className="h-name">{h.name}</div><div className="h-sub"><span className="mono">{h.id}</span> · {region(h)} · {userName(h.ownerId) || '담당 미지정'}</div>{h.director || h.directorAge ? <div className="h-sub">{h.director ? `${h.director} 원장` : '원장'}{h.directorAge ? ` (${h.directorAge})` : ''}</div> : null}{h.directorNote ? <div className="dir-note">💬 {h.directorNote}</div> : null}</div>
            <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}><StageBadge s={h.stage} /><PreBadge h={h} /><BizBadge h={h} /></div></div>
        <div className="hcard-meta">{ev ? <GradeBadge h={h} /> : null} {ac && followOf(h) !== '없음' ? <><FollowBadge h={h} /><span className="h-sub mono">{fd(h.next.date)}</span></> : null}{L.deleted ? <span className="badge a-delete">삭제 {fd(h.deletedAt)}</span> : null}</div>
        <div className="chips"><CatChips h={h} max={3} /><InfoBadges h={h} /></div></button>)}</div>{more}</>;
    return <>{head}<div className="tbl-wrap"><table><thead><tr>{picking ? <th style={{ width: 34 }}><input type="checkbox" aria-label="이 화면 전체 선택" checked={r.every(h => P.ids.has(h.id))} onChange={e => { r.forEach(h => (e.target.checked ? P.ids.add(h.id) : P.ids.delete(h.id))); notify(); }} /></th> : null}<th>Lead #</th><th>병원</th><th>지역</th><th>카테고리</th><th>단계</th>{ev ? <th>리드</th> : null}{L.deleted ? <th>삭제</th> : ac ? <th>다음 액션</th> : null}<th>담당</th></tr></thead><tbody>
        {r.map(h => <tr key={h.id} className={`row ${bizOf(h) === '폐업' ? 'is-closed' : ''} ${picking && P.ids.has(h.id) ? 'picked' : ''}`} data-id={h.id} onClick={() => click(h.id)}>
            {picking ? <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`${h.name} 선택`} checked={P.ids.has(h.id)} onChange={() => tog(h.id)} /></td> : null}<td className="mono muted" style={{ whiteSpace: 'nowrap' }}>{h.id}</td>
            <td><div className="h-name">{h.name} <BizBadge h={h} /> <InfoBadges h={h} /></div><div className="h-sub">{[h.grade, h.specialty, h.director && h.director + ' 원장' + (h.directorAge ? `(${h.directorAge})` : ''), !h.director && h.directorAge ? `원장 ${h.directorAge}` : ''].filter(Boolean).join(' · ')}</div>{h.directorNote ? <div className="dir-note" title={h.directorNote}>💬 {h.directorNote}</div> : null}</td>
            <td className="h-sub" style={{ whiteSpace: 'nowrap' }}>{region(h)}</td><td><div className="chips"><CatChips h={h} max={2} /></div></td>
            <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}><StageBadge s={h.stage} /><PreBadge h={h} /></div></td>{ev ? <td><GradeBadge h={h} /></td> : null}
            {L.deleted ? <td style={{ whiteSpace: 'nowrap' }} className="h-sub">{fd(h.deletedAt)} · {userName(h.deletedBy)}</td> : ac ? <td style={{ whiteSpace: 'nowrap' }}><FollowBadge h={h} /> {h.next?.date ? <span className="mono h-sub">{fd(h.next.date)}</span> : null}</td> : null}
            <td className="h-sub" style={{ whiteSpace: 'nowrap' }}>{userName(h.ownerId) || '—'}{h.ownerId === me ? <> <span className="badge f-예정" style={{ padding: '0 6px' }}>나</span></> : null}</td></tr>)}
    </tbody></table></div>{more}</>;
}
