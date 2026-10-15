// 카테고리: 추가·수정·삭제, 카테고리별 단계 분포, 지도에서 보기
import { useState } from 'react';
import { CAT_COLORS } from '../lib/constants';
import { can, canRead, catById, cur, inCat, liveH, logEntry, mutateH, need, roleOf } from '../lib/domain';
import { I } from '../lib/icons';
import { confirmBox, S, save, setView, STAGES, toast, ui } from '../lib/store';
import { uid } from '../lib/utils';
import { DistBar, css } from '../components/ui';

type Edit = { id: string | null; name: string; desc: string; color: string; err?: string };
export const mapCat = (key: string) => { if (!canRead('map')) return; ui.map.cats = new Set(key ? [key] : []); ui.map.stages = new Set(STAGES); Object.assign(ui.map, { sido: '', sigungu: '', owner: '', info: '', grade: '', viewId: '', q: '' }); ui.map.sel = null; setView('map'); };

export function Categories() {
    const H = liveH(); const [ce, setCe] = useState<Edit | null>(null);
    const cU = can('category', 'update'), cD = can('category', 'delete'), cC = can('category', 'create');
    function ceSave() {
        const c = { ...ce!, name: ce!.name.trim() }; if (!need('category', c.id ? 'update' : 'create')) return;
        if (!c.name) { setCe({ ...c, err: '이름을 입력하세요.' }); return; }
        if (c.name === '미분류' || S.categories.some(x => x.name === c.name && x.id !== c.id)) { setCe({ ...c, err: '같은 이름의 카테고리가 이미 있습니다.' }); return; }
        if (c.id) {
            const o = catById(c.id)!; const ch = ([['이름', 'name'], ['설명', 'desc'], ['색상', 'color']] as const).filter(([, k]) => ((o as any)[k] || '') !== ((c as any)[k] || '')).map(([l, k]) => ({ field: l, before: (o as any)[k] || '', after: (c as any)[k] || '' }));
            if (ch.length) logEntry({ entity: 'category', entityId: o.id, targetName: c.name, action: 'update', section: '카테고리', changes: ch });
            Object.assign(o, { name: c.name, desc: c.desc, color: c.color }); toast('카테고리를 변경했습니다');
        } else {
            const id = 'c' + uid(); S.categories.push({ id, name: c.name, desc: c.desc, color: c.color });
            logEntry({ entity: 'category', entityId: id, targetName: c.name, action: 'create', section: '카테고리', changes: [{ field: '이름', before: '', after: c.name }, { field: '설명', before: '', after: c.desc || '' }, { field: '색상', before: '', after: c.color }].filter(x => x.after) });
            toast(`‘${c.name}’ 추가됨`);
        }
        setCe(null); save();
    }
    async function ceDel(id: string) {
        if (!need('category', 'delete')) return; const c = catById(id)!; const used = S.hospitals.filter(h => h.categoryIds.includes(c.id)); const orphan = used.filter(h => h.categoryIds.length === 1).length;
        if (!await confirmBox({ title: `‘${c.name}’ 카테고리를 삭제할까요?`, body: <p>{used.length}개 병원에서 이 카테고리가 빠집니다.{orphan ? <> 그중 {orphan}곳은 다른 카테고리가 없어 <b>미분류</b>가 됩니다.</> : null} 각 병원 변경 이력에도 기록됩니다.</p>, ok: '삭제', danger: true })) return;
        used.forEach(h => mutateH(h, '카테고리', x => { x.categoryIds = x.categoryIds.filter(y => y !== c.id); }, { summary: `카테고리 ‘${c.name}’ 삭제로 제외` }));
        logEntry({ entity: 'category', entityId: c.id, targetName: c.name, action: 'delete', section: '카테고리', changes: [{ field: '이름', before: c.name, after: '' }, { field: '지정 병원 수', before: String(used.length), after: '0' }] });
        S.categories = S.categories.filter(x => x !== c); ui.map.cats.delete(c.id); save(); toast('카테고리를 삭제했습니다');
    }
    const form = (c: Edit) => <div className="cat-form" key="form"><div className="form-grid">
        <label className="fld"><span>이름 <em>*</em></span><input id="ce-name" autoFocus value={c.name} onChange={e => setCe({ ...c, name: e.target.value })} placeholder="예: 11월 세미나 초청" /></label>
        <label className="fld"><span>설명</span><input id="ce-desc" value={c.desc || ''} onChange={e => setCe({ ...c, desc: e.target.value })} placeholder="선택" /></label>
        <div className="fld span2"><span>색상 <small>지도·목록에서 구분용</small></span><div className="swatches">{CAT_COLORS.map(col => <button key={col} type="button" className={`sw ${c.color === col ? 'on' : ''}`} style={css({ '--cc': col })} onClick={() => setCe({ ...c, color: col })} aria-label={`색상 ${col}`} />)}</div></div>
        {c.err ? <p className="err span2">{c.err}</p> : null}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn" onClick={() => setCe(null)}>취소</button><button className="btn primary" data-act="ceSave" onClick={ceSave}>{c.id ? '변경 저장' : '추가'}</button></div></div>;
    const row = (c: { id: string; name: string; desc?: string; color: string }, sys?: boolean) => {
        const list = H.filter(h => inCat(h, sys ? '__none' : c.id)); if (ce && ce.id === c.id && !sys) return form(ce);
        return <div className="cat-row" key={sys ? '__none' : c.id}><div className="cat-name" style={css({ '--cc': sys ? 'var(--none)' : c.color })}><i /><div style={{ minWidth: 0 }}><b>{c.name}</b>{sys ? <span className="lock">기본</span> : null}<p>{sys ? '카테고리를 하나도 선택하지 않은 병원' : c.desc || '설명 없음'}</p></div></div>
            <div className="dist"><DistBar list={list} /><div className="dist-cap"><span><b className="num">{list.length}</b>곳</span>{STAGES.map(s => { const n = list.filter(h => h.stage === s).length; return n ? <span key={s}>{s} {n}</span> : null; })}</div></div>
            <div className="cat-actions">{canRead('map') ? <button className="btn sm" onClick={() => mapCat(sys ? '__none' : c.id)}>{I.map}지도</button> : null}
                {sys ? null : <>{cU ? <button className="icon-btn" data-act="ceEdit" data-v={c.id} onClick={() => { if (need('category', 'update')) setCe({ ...(catById(c.id) as any), err: '' }); }} aria-label="수정">{I.edit}</button> : null}
                    {cD ? <button className="icon-btn" data-act="ceDel" data-v={c.id} onClick={() => ceDel(c.id)} aria-label="삭제">{I.trash}</button> : null}</>}</div></div>;
    };
    return <>
        <div className="page-head"><div><h1>카테고리</h1><p>권역, 캠페인, 관심사 등으로 병원을 묶어 두면 지도에서 한 번에 볼 수 있습니다. 병원 하나에 여러 카테고리를 지정할 수 있어요.</p></div>
            {(ce && !ce.id) || !cC ? null : <button className="btn primary" data-act="ceNew" onClick={() => { if (need('category', 'create')) setCe({ id: null, name: '', desc: '', color: CAT_COLORS[S.categories.length % CAT_COLORS.length] }); }}>{I.plus}카테고리 추가</button>}</div>
        {!cC && !cU && !cD ? <div className="ro-note" style={{ marginBottom: 12 }}>{I.lock}읽기 전용 · {roleOf(cur())!.name} 역할에는 카테고리 편집 권한이 없습니다</div> : null}
        <div className="cat-rows">{ce && !ce.id ? form(ce) : null}{S.categories.map(c => row(c))}{row({ id: '__none', name: '미분류', color: '' }, true)}</div>
    </>;
}
