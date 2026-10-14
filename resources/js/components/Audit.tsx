// 변경 이력 목록 (전체 변경 이력·병원 상세 이력 탭 공용)
import { ACTION_LABEL, ENTITY_LABEL } from '../lib/constants';
import { canRead, canRep, getH, userById } from '../lib/domain';
import { notify, S, ui } from '../lib/store';
import type { AuditEntry, Change } from '../lib/types';
import { fd, fmtTs } from '../lib/utils';
import { openDetail } from './HospitalDrawer';
import { Av } from './ui';

const cell = (v: string, cls: string) => (v === '' ? <span className="nil">(없음)</span> : <span className={cls}>{v}</span>);
const Tbl = ({ list }: { list: Change[] }) => <div className="chg-wrap"><table className="chg"><thead><tr><th>항목</th><th>수정 전</th><th>수정 후</th></tr></thead>
    <tbody>{list.map((c, i) => <tr key={i}><td>{c.field}</td><td>{cell(c.before, 'bf')}</td><td>{cell(c.after, 'af')}</td></tr>)}</tbody></table></div>;

export function AuditItem({ e, showTarget }: { e: AuditEntry; showTarget: boolean }) {
    const u = userById(e.userId);
    let target: React.ReactNode = null;
    if (showTarget) {
        if (e.entity === 'hospital') target = canRead('hospital') && getH(e.hospitalId) ? <button className="au-target" onClick={() => openDetail(e.hospitalId!)}>{e.targetName}</button> : <b>{e.targetName}</b>;
        else {
            const rep = e.entity === 'report' ? S.reports.find(x => x.id === e.entityId) : undefined;
            target = rep && canRep('read', rep) ? <button className="au-target" onClick={() => { ui.rep.review = ''; ui.modal = { type: 'repView', id: rep.id }; notify(); }}>{ENTITY_LABEL[e.entity]} · {e.targetName || ''}</button> : <b>{ENTITY_LABEL[e.entity]} · {e.targetName || ''}</b>;
        }
    }
    const rows = e.changes || [];
    return <li className="au"><div className="au-head"><Av u={{ id: e.userId, name: e.userName }} /><div>
        <div><b>{e.userName}</b><span className="au-role">{e.roleName || ''}{u && u.name !== e.userName ? ` · 현재 이름 ${u.name}` : ''}</span></div>
        <div className="au-meta"><span className="mono">{fmtTs(e.ts)}</span><span className={`badge a-${e.action}`}>{ACTION_LABEL[e.action]}</span><span>{e.section || ''}</span>{target ? <>· {target}</> : null}</div></div></div>
        {e.summary ? <p className="au-sum">{e.summary}</p> : null}
        {rows.length ? (rows.length > 6 ? <><Tbl list={rows.slice(0, 5)} /><details><summary>나머지 {rows.length - 5}개 항목 보기</summary><Tbl list={rows.slice(5)} /></details></> : <Tbl list={rows} />) : null}
    </li>;
}

export function AuditList({ items, showTarget }: { items: AuditEntry[]; showTarget: boolean }) {
    if (!items.length) return <div className="panel empty">조건에 맞는 변경 이력이 없습니다</div>;
    let day = '';
    return <ul className="audit">{items.map(e => { const d = fmtTs(e.ts).slice(0, 10); const sep = d !== day ? <li className="day-sep">{fd(d)}</li> : null; day = d; return <AuditFrag key={e.id} sep={sep} e={e} showTarget={showTarget} />; })}</ul>;
}
const AuditFrag = ({ sep, e, showTarget }: { sep: React.ReactNode; e: AuditEntry; showTarget: boolean }) => <>{sep}<AuditItem e={e} showTarget={showTarget} /></>;
