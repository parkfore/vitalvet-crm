// 병원 기본 정보 입력 (등록 창·상세 기본 정보 탭 공용) + 주소 검색 창
import { useEffect, useRef, useState } from 'react';
import { LEAD_SOURCES, PRE_TYPES } from '../lib/constants';
import { cur, findDup, initialStage, roleOf, type HForm } from '../lib/domain';
import { I } from '../lib/icons';
import { geocode, initPostcode, PostcodeCls, postcodeReady } from '../lib/maps';
import { S } from '../lib/store';
import { fmtPhone, today } from '../lib/utils';
import { BIZ, bizOf, isReq } from '../lib/hinfo';
import { DateInput, StageBadge, css } from './ui';

export type Addr = { zip: string; address: string; jibun: string; sido: string; sigungu: string; lat: number | null; lng: number | null };

/** 주소 검색: 카카오 우편번호 서비스. 불러오지 못하면 직접 입력 */
export function AddressModal({ onPick, onClose }: { onPick: (a: Addr) => void; onClose: () => void }) {
    const wrap = useRef<HTMLDivElement>(null); const [ok, setOk] = useState(postcodeReady && !!PostcodeCls()); const [zip, setZip] = useState(''); const [addr, setAddr] = useState('');
    useEffect(() => { if (!ok) initPostcode().then(() => { if (postcodeReady) setOk(true); }); }, [ok]);
    useEffect(() => {
        if (!ok || !wrap.current) return; const PC = PostcodeCls();
        new PC({
            width: '100%', height: '100%',
            oncomplete: (d: any) => {
                const road = d.userSelectedType === 'J' ? '' : (d.roadAddress || d.autoRoadAddress || ''); const jibun = d.jibunAddress || d.autoJibunAddress || '';
                let extra = ''; if (road) { if (d.bname && /[동로가]$/.test(d.bname)) extra += d.bname; if (d.buildingName && d.apartment === 'Y') extra += (extra ? ', ' : '') + d.buildingName; }
                onPick({ zip: d.zonecode, address: road ? road + (extra ? ` (${extra})` : '') : jibun, jibun: road ? jibun : '', sido: d.sido, sigungu: d.sigungu, lat: null, lng: null });
            },
        }).embed(wrap.current, { autoClose: true });
    }, [ok]);
    const manual = () => {
        const v = addr.trim(); if (!v) return; const parts = v.split(/\s+/);
        onPick({ zip: zip.replace(/\D/g, '').slice(0, 5), address: v, jibun: '', sido: parts[0] || '', sigungu: /시$/.test(parts[1] || '') && /구$/.test(parts[2] || '') ? parts[1] + ' ' + parts[2] : parts[1] || '', lat: null, lng: null });
    };
    return <div id="addrLayer"><div className="backdrop addr-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal sm addr-modal" role="dialog" aria-modal="true">
        <header><h2>주소 검색</h2><button className="icon-btn" onClick={onClose} aria-label="닫기">{I.x}</button></header>
        {ok ? <div ref={wrap} id="postcodeWrap" className="postcode-wrap" /> :
            <div className="body" style={{ display: 'grid', gap: 12 }}>
                <div className="warnbox">카카오 우편번호 서비스를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 창을 닫고 다시 열거나, 아래에 주소를 직접 입력하세요.</div>
                <details open><summary className="hint" style={{ cursor: 'pointer' }}>직접 입력</summary><div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <div className="addr-row"><input id="manualZip" className="zip-in" placeholder="우편번호" inputMode="numeric" maxLength={5} value={zip} onChange={e => setZip(e.target.value)} /><input id="manualAddr" autoFocus placeholder="도로명 주소" style={{ flex: 1, minWidth: 0 }} value={addr} onChange={e => setAddr(e.target.value)} /></div>
                    <p className="hint">직접 입력한 주소는 좌표가 없어 지도에 표시되지 않을 수 있습니다.</p><button className="btn" data-act="manualAddr" onClick={manual}>이 주소 사용</button></div></details>
            </div>}
    </div></div></div>;
}

/** 고른 주소를 폼에 넣고, 좌표가 없으면 지도 서비스로 찾아 채운다 */
export function useAddress(setForm: (fn: (f: any) => any) => void) {
    const [open, setOpen] = useState(false);
    const pick = (a: Addr) => {
        setForm(f => ({ ...f, ...a })); setOpen(false);
        setTimeout(() => { const d = document.getElementById('f-detail') as HTMLInputElement | null; if (d && window.innerWidth > 860) { d.focus(); d.select(); } }, 0);
        if (!a.lat) geocode(a.address).then(p => { if (p) setForm(f => (f.address === a.address ? { ...f, lat: p.lat, lng: p.lng } : f)); });
    };
    return { open, setOpen, pick, modal: open ? <AddressModal onPick={pick} onClose={() => setOpen(false)} /> : null };
}

export function HospitalFormFields({ f, set, mode, ro, err, openAddr }: { f: HForm; set: (patch: Partial<HForm>) => void; mode: 'new' | 'edit'; ro?: boolean; err?: string; openAddr: () => void }) {
    const dup = mode === 'new' && findDup({ ...f, phone: fmtPhone(f.phone) }); const ownLock = roleOf(cur())!.scope === 'own';
    const inp = (k: keyof HForm) => ({ value: (f[k] as any) ?? '', disabled: ro, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set({ [k]: e.target.value, ...(f._dupWarned && ['name', 'phone', 'addressDetail'].includes(k) ? { _dupWarned: false } : {}) } as any) });
    const phone = (k: 'phone' | 'directorPhone') => ({ ...inp(k), onBlur: () => set({ [k]: fmtPhone(f[k]) } as any) });
    const toggle = (k: 'categoryIds' | 'sources', v: string) => { const a = f[k] || []; set({ [k]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] } as any); };
    const R = (k: string) => (isReq(k) ? <> <em>*</em></> : null);
    const geo = f.address ? <span className={`addr-geo ${f.lat ? 'ok' : 'warn'}`}>{f.lat ? <>지도 좌표 확인됨 · <span className="mono">{(+f.lat).toFixed(4)}, {(+f.lng!).toFixed(4)}</span></> : '지도 좌표 없음 · 지도에 표시되지 않아요'}</span> : null;
    return <div className="form-grid">
        <label className="fld span2"><span>병원명 <em>*</em></span><input id="f-name" {...inp('name')} placeholder="예: 온누리 동물병원" autoComplete="off" /></label>
        <div className="fld span2"><span>주소 <em>*</em></span>
            <div className="addr-row"><input id="f-zip" className="zip-in" value={f.zip} placeholder="우편번호" readOnly aria-label="우편번호" disabled={ro} onClick={ro ? undefined : openAddr} data-act={ro ? undefined : 'openAddr'} />
                {ro ? null : <button type="button" className="btn" onClick={openAddr}>{I.search}{f.address ? '다시 검색' : '주소 검색'}</button>}</div>
            <input id="f-addr" value={f.address} placeholder="주소 검색을 눌러 도로명 주소를 선택하세요" readOnly aria-label="도로명 주소" disabled={ro} onClick={ro ? undefined : openAddr} data-act={ro ? undefined : 'openAddr'} className="addr-in" />
            {f.address ? <div className="addr-sub">{f.jibun ? `지번 ${f.jibun} · ` : ''}{geo}</div> : null}</div>
        <label className="fld span2"><span>상세주소</span><input id="f-detail" {...inp('addressDetail')} placeholder="층, 호수 (예: 2층 201호)" /></label>
        {mode === 'edit' ? <div className="fld span2"><span>영업 상태 <small>폐업·휴업이면 지도에서 기본으로 숨겨집니다</small></span>
            <div className="biz-row"><div className="seg" id="f-biz">{BIZ.map(b => <button key={b} type="button" className={bizOf(f) === b ? 'on' : ''} disabled={ro} onClick={() => set({ bizStatus: b, closedAt: b === '폐업' ? (f.closedAt || today()) : '' })}>{b}</button>)}</div>
                {bizOf(f) === '폐업' ? <label className="biz-date"><span className="hint">폐업일</span><DateInput value={f.closedAt || ''} onChange={v => set({ closedAt: v })} disabled={ro} /></label> : null}</div></div> : null}
        <div className="fld" id="f-grade"><span>병원 등급{R('grade')}</span><div className="seg">{S.codes.grades.map(g => <button key={g} type="button" className={f.grade === g ? 'on' : ''} disabled={ro} onClick={() => set({ grade: f.grade === g ? '' : g })}>{g}</button>)}</div></div>
        <label className="fld"><span>전문과{R('specialty')}</span><select id="f-spec" {...inp('specialty')}><option value="">선택</option>{S.codes.specialties.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="fld"><span>병원 대표 전화{R('phone')}</span><input id="f-phone" inputMode="tel" {...phone('phone')} placeholder="02-000-0000" /></label>
        <label className="fld"><span>봉직수의사 수{R('vetCount')}</span><input id="f-vets" type="number" min="0" {...inp('vetCount')} placeholder="0" /></label>
        <label className="fld"><span>원장님 이름{R('director')}</span><input id="f-dir" {...inp('director')} /></label>
        <label className="fld"><span>원장님 연락처{R('directorPhone')}</span><input id="f-dirp" inputMode="tel" {...phone('directorPhone')} placeholder="010-0000-0000" /></label>
        <label className="fld"><span>담당 영업사원{R('ownerId')}{ownLock ? <> <small>담당 병원만 관리하는 역할은 변경 불가</small></> : null}</span>
            <select id="f-owner" value={f.ownerId} disabled={ro || ownLock} onChange={e => set({ ownerId: e.target.value })}><option value="">미지정</option>{S.users.filter(u => u.status === 'active').map(u => <option key={u.id} value={u.id}>{u.name} ({roleOf(u)?.name || ''})</option>)}</select></label><div />
        <label className="fld"><span>사용 중인 경쟁 제품</span><select {...inp('compId')}><option value="">없음·모름</option>{(S.competitors || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="fld"><span>경쟁 제품 계약 만료일 <small>재접촉 시점</small></span><DateInput value={f.compUntil || ''} onChange={v => set({ compUntil: v })} disabled={ro} /></label>
        <div className="fld span2"><span>카테고리 <small>여러 개 선택 가능</small></span><div className="chips">{S.categories.map(c => <button key={c.id} type="button" className={`chip-toggle ${f.categoryIds.includes(c.id) ? 'on' : ''}`} style={css({ '--cc': c.color })} disabled={ro} onClick={() => toggle('categoryIds', c.id)}><i />{c.name}</button>)}</div>
            <p className="hint">{f.categoryIds.length ? `${f.categoryIds.length}개 선택됨` : <>선택하지 않으면 <b>미분류</b>로 등록됩니다</>}</p></div>
        {mode === 'new' || f._stage === initialStage() ? <div className="fld span2"><span>{initialStage()} 구분 <small>아직 접촉 전 · 다음에 할 일</small></span><div className="seg">{Object.entries(PRE_TYPES).map(([k, [l]]) => <button key={k} type="button" className={f.pre === k ? 'on' : ''} disabled={ro} onClick={() => set({ pre: k })}>{l}</button>)}</div></div> : null}
        <div className="fld span2"><span>접촉 경로 <small>병원을 알게 된·만나게 된 경로 · 여러 개 선택 가능</small></span><div className="chips">{LEAD_SOURCES.map(x => <button key={x} type="button" className={`chip-toggle src ${(f.sources || []).includes(x) ? 'on' : ''}`} disabled={ro} onClick={() => toggle('sources', x)}><i />{x}</button>)}</div></div>
        {mode === 'new' ? <div className="stage-note span2">등록 시 단계 <StageBadge s={initialStage()} /> 리드 평가와 방문 기록은 등록 후 병원 상세에서 입력합니다. 등록자는 <b>{cur()!.name}</b>으로 기록됩니다.</div> : null}
        {dup ? <div className="warnbox span2">이미 등록된 병원과 겹칩니다: <b>{dup.name}</b> ({dup.id}, {dup.address}){dup.deletedAt ? ' · 삭제된 병원' : ''}. 같은 병원이 아니면 한 번 더 저장하세요.</div> : null}
        {err ? <p className="err span2">{err}</p> : null}
    </div>;
}
