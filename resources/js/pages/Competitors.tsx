// 경쟁사: 목록 카드, 등록·수정 창, 상세 창 (사용 병원·영업 보고 언급)
import { useState } from 'react';
import { openDetail } from '../components/HospitalDrawer';
import { useAddress } from '../components/HospitalForm';
import { Modal, PhoneInput } from '../components/ui';
import { COMP_TYPES, THREAT } from '../lib/constants';
import { canComp, compById, compHosp, compMentions, cur, diffSnap, hName, logEntry, mutateH, region, snapComp, userName } from '../lib/domain';
import { I } from '../lib/icons';
import { confirmBox, notify, S, save, toast, ui } from '../lib/store';
import type { Competitor } from '../lib/types';
import { addDays, clone, fd, fmtPhone, phoneErr, today, uid, fmtN } from '../lib/utils';

const blankComp = (): Competitor => ({ id: '', name: '', company: '', type: COMP_TYPES[0], threat: '중간', website: '', phone: '', zip: '', address: '', jibun: '', addressDetail: '', sido: '', sigungu: '', lat: null, lng: null, regions: '', products: [{ name: '', price: '', note: '' }], strengths: '', weaknesses: '', counter: '', memo: '' });
export const openComp = (id: string) => { ui.modal = { type: 'compView', id }; notify(); };

export function Competitors() {
    const L = S.competitors || []; const since = addDays(-30); const q = (ui.cq || '').trim().toLowerCase();
    const list = L.filter(c => !q || [c.name, c.company, c.type, (c.products || []).map(p => p.name).join(' '), c.regions].join(' ').toLowerCase().includes(q));
    return <>
        <div className="page-head"><div><h1>경쟁사</h1><p>경쟁 제품과 회사 정보를 모아 두면 영업 보고의 경쟁사 동향, 병원별 사용 제품과 연결되어 대응 포인트를 바로 찾을 수 있습니다.</p></div>
            {canComp('create') ? <button className="btn primary" data-act="compNew" onClick={() => { ui.modal = { type: 'comp', f: blankComp() }; notify(); }}>{I.plus}경쟁사 등록</button> : null}</div>
        <div className="toolbar"><label className="search">{I.search}<input type="search" value={ui.cq || ''} onChange={e => { ui.cq = e.target.value; notify(); }} placeholder="회사·제품·지역 검색" /></label></div>
        <div className="comp-grid">{list.length ? list.map(c => {
            const m = compMentions(c); const m30 = m.filter(x => x.date >= since).length; const hs = compHosp(c);
            return <article key={c.id} className="comp-card" onClick={() => openComp(c.id)}><div className="cc-top"><div style={{ minWidth: 0 }}><h3>{c.name}</h3><p className="h-sub">{c.company || '회사명 미입력'}{c.sigungu ? ` · ${c.sido} ${c.sigungu}` : ''}</p></div><span className={`badge ${THREAT[c.threat || ''] || 'f-없음'}`}>위협 {c.threat || '—'}</span></div>
                <div className="chips"><span className="cat-chip">{c.type || '유형 미지정'}</span>{(c.products || []).slice(0, 3).map((p, i) => <span key={i} className="cat-chip none">{p.name}</span>)}</div>
                <div className="cc-stats"><div><b className="num">{fmtN(hs.length)}</b><span>사용 병원</span></div><div><b className="num">{fmtN(m30)}</b><span>최근 30일 언급</span></div><div><b className="num">{fmtN(m.length)}</b><span>전체 언급</span></div></div>
                {c.counter ? <p className="cc-counter"><b>대응</b> {c.counter}</p> : null}</article>;
        }) : <div className="panel empty">등록된 경쟁사가 없습니다</div>}</div>
    </>;
}

export function CompFormModal({ f0 }: { f0: Competitor }) {
    const [f, setF] = useState<Competitor>(() => { const x = clone(f0); if (!x.products?.length) x.products = [{ name: '', price: '', note: '' }]; return x; });
    const [err, setErr] = useState(''); const addr = useAddress(fn => setF(fn));
    const set = (k: keyof Competitor) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
    const setP = (i: number, k: string, v: string) => setF({ ...f, products: f.products!.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
    function compSave() {
        const isNew = !f.id; if (!canComp(isNew ? 'create' : 'update')) { toast('경쟁사 등록·수정 권한이 없습니다'); return; }
        const name = (f.name || '').trim(); if (!name) { setErr('제품·서비스명을 입력하세요.'); return; }
        if ((S.competitors || []).some(c => c.name === name && c.id !== f.id)) { setErr('같은 이름의 경쟁사가 있습니다.'); return; }
        if (phoneErr(f.phone, 'tel')) { setErr(`대표 전화: ${phoneErr(f.phone, 'tel')}`); return; }
        const data: Competitor = { ...clone(f), name, website: f.website && !/^https?:\/\//.test(f.website) ? 'https://' + f.website.trim() : f.website, phone: fmtPhone(f.phone), products: (f.products || []).filter(p => p.name || p.price || p.note) };
        if (isNew) {
            data.id = 'cp_' + uid(); data.createdAt = today(); data.createdBy = cur()!.id; (S.competitors ||= []).push(data);
            logEntry({ entity: 'competitor', entityId: data.id, targetName: data.name, action: 'create', section: '경쟁사', changes: diffSnap({}, snapComp(data)) });
        } else {
            const o = compById(f.id)!; const ch = diffSnap(snapComp(o), snapComp(data)); const oldName = o.name; Object.assign(o, data);
            if (oldName !== o.name) S.reports.forEach(r => (r.comp || []).forEach(x => { if (x.competitorId === o.id) x.name = o.name; }));
            if (ch.length) logEntry({ entity: 'competitor', entityId: o.id, targetName: o.name, action: 'update', section: '경쟁사', changes: ch });
        }
        ui.modal = null; save(); toast(isNew ? `${data.name} 등록` : '저장했습니다');
    }
    return <>
        <Modal title={f.id ? '경쟁사 수정' : '경쟁사 등록'} size="wide" foot={<><button className="btn" onClick={() => { ui.modal = null; notify(); }}>취소</button><button className="btn primary" data-act="compSave" onClick={compSave}>{f.id ? '저장' : '등록'}</button></>}>
            <div className="form-grid">
                <label className="fld"><span>제품·서비스명 <em>*</em></span><input id="f-name" data-f="name" autoFocus value={f.name} onChange={set('name')} placeholder="예: 모니로그" /></label>
                <label className="fld"><span>회사명</span><input value={f.company || ''} onChange={set('company')} /></label>
                <label className="fld"><span>유형</span><select value={f.type} onChange={set('type')}>{COMP_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
                <div className="fld"><span>위협도</span><div className="seg">{['높음', '중간', '낮음'].map(t => <button key={t} type="button" className={f.threat === t ? 'on' : ''} onClick={() => setF({ ...f, threat: t })}>{t}</button>)}</div></div>
                <label className="fld"><span>웹사이트</span><input value={f.website || ''} onChange={set('website')} placeholder="https://" inputMode="url" /></label>
                <label className="fld"><span>대표 전화</span><PhoneInput id="cf-phone" kind="tel" value={f.phone || ''} onChange={v => setF({ ...f, phone: v })} /></label>
                <div className="fld span2"><span>본사 위치</span><div className="addr-row"><input id="f-zip" className="zip-in" value={f.zip || ''} placeholder="우편번호" readOnly data-act="openAddr" onClick={() => addr.setOpen(true)} /><button type="button" className="btn" onClick={() => addr.setOpen(true)}>{I.search}주소 검색</button></div>
                    <input id="f-addr" className="addr-in" value={f.address || ''} placeholder="주소 검색을 눌러 선택" readOnly data-act="openAddr" onClick={() => addr.setOpen(true)} /><input id="f-detail" value={f.addressDetail || ''} onChange={set('addressDetail')} placeholder="상세주소" style={{ marginTop: 6 }} /></div>
                <label className="fld span2"><span>주요 영업 지역·대상</span><input value={f.regions || ''} onChange={set('regions')} placeholder="예: 수도권 1차 병원, 전자차트 기존 고객" /></label>
                <div className="fld span2"><span>경쟁 품목 <small>제품, 가격 정책, 특징</small></span><div className="rr-list">{(f.products || []).map((p, i) => <div key={i} className="rr rr-cp">
                    <input value={p.name} onChange={e => setP(i, 'name', e.target.value)} placeholder="제품명" /><input value={p.price} onChange={e => setP(i, 'price', e.target.value)} placeholder="가격·조건 (예: 월 9만원, 첫해 50%)" /><input value={p.note} onChange={e => setP(i, 'note', e.target.value)} placeholder="특징" />
                    <button className="icon-btn" onClick={() => setF({ ...f, products: f.products!.filter((_, j) => j !== i) })} aria-label="삭제">{I.x}</button></div>)}
                    <button className="btn sm" onClick={() => setF({ ...f, products: [...(f.products || []), { name: '', price: '', note: '' }] })}>{I.plus}품목 추가</button></div></div>
                <label className="fld"><span>강점</span><textarea rows={3} value={f.strengths || ''} onChange={set('strengths')} placeholder="병원이 이 제품을 고르는 이유" /></label>
                <label className="fld"><span>약점</span><textarea rows={3} value={f.weaknesses || ''} onChange={set('weaknesses')} placeholder="불만, 한계" /></label>
                <label className="fld span2"><span>우리 대응 포인트</span><textarea rows={3} value={f.counter || ''} onChange={set('counter')} placeholder="영업사원이 쓸 비교 포인트·세일즈 토크" /></label>
                <label className="fld span2"><span>메모</span><textarea rows={2} value={f.memo || ''} onChange={set('memo')} /></label>{err ? <p className="err span2">{err}</p> : null}</div>
        </Modal>{addr.modal}</>;
}

export function CompViewModal({ id }: { id: string }) {
    const c = compById(id); if (!c) return null; const m = compMentions(c); const hs = compHosp(c);
    async function compDelete() {
        if (!canComp('delete')) { toast('삭제 권한이 없습니다'); return; }
        if (!await confirmBox({ title: `‘${c!.name}’을 삭제할까요?`, body: <p>{hs.length ? `사용 병원 ${hs.length}곳의 경쟁 제품 지정이 비워지고 각 병원 이력에 남습니다. ` : ''}{m.length ? `영업 보고의 언급 ${m.length}건은 이름 그대로 남습니다.` : ''}</p>, ok: '삭제', danger: true })) return;
        hs.forEach(h => mutateH(h, '기본 정보', x => { x.compId = ''; x.compUntil = ''; }, { summary: `경쟁사 ‘${c!.name}’ 삭제` }));
        S.reports.forEach(r => (r.comp || []).forEach(x => { if (x.competitorId === c!.id) delete x.competitorId; }));
        logEntry({ entity: 'competitor', entityId: c!.id, targetName: c!.name, action: 'delete', section: '경쟁사', changes: diffSnap(snapComp(c!), {}) });
        S.competitors = S.competitors.filter(x => x !== c); ui.modal = null; save(); toast('삭제했습니다');
    }
    return <Modal title="경쟁사 정보" size="wide" headExtra={<>{canComp('update') ? <button className="btn sm" onClick={() => { if (!canComp('update')) return; ui.modal = { type: 'comp', f: clone(c) }; notify(); }}>{I.edit}수정</button> : null}{canComp('delete') ? <button className="btn sm danger" onClick={compDelete}>{I.trash}삭제</button> : null}</>}>
        <div className="rv-head"><div style={{ minWidth: 0 }}><h3 style={{ margin: 0, fontSize: 18 }}>{c.name}</h3><div className="au-meta"><span>{c.company || ''}</span><span className="cat-chip">{c.type}</span><span className={`badge ${THREAT[c.threat || ''] || 'f-없음'}`}>위협 {c.threat || '—'}</span></div></div></div>
        <dl className="mc-grid"><dt>웹사이트</dt><dd>{c.website ? <a href={c.website} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>{c.website}</a> : '—'}</dd><dt>대표 전화</dt><dd className="mono">{c.phone || '—'}</dd>
            <dt>본사</dt><dd>{c.address ? `${c.zip ? `(${c.zip}) ` : ''}${c.address} ${c.addressDetail || ''}` : '—'}</dd><dt>영업 지역</dt><dd>{c.regions || '—'}</dd><dt>등록</dt><dd>{fd(c.createdAt)} {userName(c.createdBy) || ''}</dd></dl>
        <h3 className="rv-h">경쟁 품목</h3>{(c.products || []).filter(p => p.name).length ? <div className="tbl-wrap"><table><thead><tr><th>제품</th><th>가격·조건</th><th>특징</th></tr></thead><tbody>{c.products!.filter(p => p.name).map((p, i) => <tr key={i}><td><b>{p.name}</b></td><td>{p.price || '—'}</td><td className="h-sub">{p.note || ''}</td></tr>)}</tbody></table></div> : <p className="hint">없음</p>}
        <div className="rv-2"><div><h3 className="rv-h">강점</h3><p className="rv-p">{c.strengths || '—'}</p></div><div><h3 className="rv-h">약점</h3><p className="rv-p">{c.weaknesses || '—'}</p></div></div>
        <h3 className="rv-h">우리 대응 포인트</h3><p className="rv-p cc-counter">{c.counter || '—'}</p>{c.memo ? <><h3 className="rv-h">메모</h3><p className="rv-p">{c.memo}</p></> : null}
        <h3 className="rv-h">사용 중인 병원 · {fmtN(hs.length)}곳</h3>{hs.length ? <ul className="plain">{hs.map(h => <li key={h.id}><button className="au-target" onClick={() => { ui.modal = null; openDetail(h.id); }}>{h.name}</button> <span className="h-sub">{region(h)} · {h.stage}{h.compUntil ? ` · 계약 만료 ${fd(h.compUntil)}` : ''}</span></li>)}</ul> : <p className="hint">병원 기본 정보에서 사용 중인 경쟁 제품을 지정하면 여기에 모입니다.</p>}
        <h3 className="rv-h">영업 보고 언급 · {fmtN(m.length)}건</h3>{m.length ? <ul className="feed">{m.slice(0, 8).map((v, i) => <li key={i}><span className="badge f-없음">{fd(v.date).slice(5)}</span><div><div>{v.text}</div><div className="h-sub">{hName(v.hospitalId) || '병원 미지정'} · {userName(v.author)}</div></div></li>)}</ul> : <p className="hint">없음</p>}
    </Modal>;
}
