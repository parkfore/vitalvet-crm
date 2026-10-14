// 전체 변경 이력: 대상·작성자·작업·검색어로 거르기
import { AuditList } from '../components/Audit';
import { ACTION_LABEL, ENTITY_LABEL } from '../lib/constants';
import { I } from '../lib/icons';
import { notify, S, ui } from '../lib/store';

export function History() {
    const F = ui.hist; const q = F.q.trim();
    const list = S.audit.filter(e => (!F.entity || e.entity === F.entity) && (!F.user || e.userId === F.user) && (!F.action || e.action === F.action)
        && (!q || (e.targetName || '').includes(q) || (e.changes || []).some(c => (c.before + c.after).includes(q)))).sort((a, b) => b.ts.localeCompare(a.ts));
    const set = (k: 'entity' | 'user' | 'action' | 'q') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { F[k] = e.target.value; F.limit = 60; notify(); };
    return <>
        <div className="page-head"><div><h1>변경 이력</h1><p>누가, 언제, 무엇을, 어떻게 바꿨는지 모든 등록·수정·삭제·복원을 기록합니다. 이력은 수정하거나 지울 수 없습니다.</p></div></div>
        <div className="toolbar"><label className="search">{I.search}<input type="search" id="hq" value={F.q} onChange={set('q')} placeholder="병원명·내용 검색" /></label>
            <select id="hf-ent" value={F.entity} onChange={set('entity')} aria-label="대상">{[['', '대상 전체'], ...Object.entries(ENTITY_LABEL)].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select id="hf-user" value={F.user} onChange={set('user')} aria-label="작성자"><option value="">작성자 전체</option>{S.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <select id="hf-act" value={F.action} onChange={set('action')} aria-label="작업">{[['', '작업 전체'], ...Object.entries(ACTION_LABEL)].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <p className="count-line">{list.length}건</p><AuditList items={list.slice(0, F.limit)} showTarget />
        {list.length > F.limit ? <div style={{ textAlign: 'center', marginTop: 12 }}><button className="btn" onClick={() => { F.limit += 60; notify(); }}>더 보기 ({list.length - F.limit}건 남음)</button></div> : null}
    </>;
}
