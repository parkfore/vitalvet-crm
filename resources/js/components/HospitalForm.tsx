// 병원 등록 · 기본 정보 수정
import { useState, type FormEvent } from 'react';
import { api, errMsg } from '../lib/api';
import { useStore } from '../lib/store';
import type { HospitalDetail, HospitalItem } from '../lib/types';
import AddressSearch from './AddressSearch';
import { Field, fmtPhone, Modal } from './ui';

type Form = {
    name: string;
    zip: string;
    address: string;
    jibun: string;
    address_detail: string;
    sido: string;
    sigungu: string;
    grade: string;
    specialty: string;
    phone: string;
    director: string;
    director_phone: string;
    vet_count: string;
    owner_id: string;
    pre_type: string;
    sources: string[];
    category_ids: number[];
    competitor_id: string;
    competitor_until: string;
    memo: string;
};

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default function HospitalForm({ initial, onClose, onSaved }: { initial?: HospitalDetail; onClose: () => void; onSaved: (h: HospitalItem | HospitalDetail) => void }) {
    const { meta, me, toast } = useStore();
    const [f, setF] = useState<Form>(() => ({
        name: s(initial?.name),
        zip: s(initial?.zip),
        address: s(initial?.address),
        jibun: s(initial?.jibun),
        address_detail: s(initial?.address_detail),
        sido: s(initial?.sido),
        sigungu: s(initial?.sigungu),
        grade: s(initial?.grade),
        specialty: s(initial?.specialty),
        phone: s(initial?.phone),
        director: s(initial?.director),
        director_phone: s(initial?.director_phone),
        vet_count: s(initial?.vet_count),
        owner_id: s(initial ? initial.owner_id : me?.user.id),
        pre_type: s(initial?.pre_type ?? 'call'),
        sources: initial?.sources ?? [],
        category_ids: initial?.category_ids ?? [],
        competitor_id: s(initial?.competitor_id),
        competitor_until: s(initial?.competitor_until),
        memo: s(initial?.memo),
    }));
    const [addrOpen, setAddrOpen] = useState(false);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    if (!meta) return null;

    const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
    const inp = (k: keyof Form) => ({
        value: f[k] as string,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, (k.includes('phone') ? fmtPhone(e.target.value) : e.target.value) as never),
    });
    const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    const ownScope = me?.scope === 'own';
    const initialStageId = meta.stages.find((x) => x.kind === 'main')?.id;
    const showPre = !initial || initial.stage_id === initialStageId;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr('');
        if (!f.name.trim()) return setErr('병원명을 입력하세요');
        if (!f.address.trim()) return setErr('주소를 입력하세요');
        const body = {
            ...f,
            name: f.name.trim(),
            vet_count: f.vet_count === '' ? null : Number(f.vet_count),
            owner_id: f.owner_id ? Number(f.owner_id) : null,
            competitor_id: f.competitor_id ? Number(f.competitor_id) : null,
            competitor_until: f.competitor_until || null,
            pre_type: showPre ? f.pre_type || 'call' : initial?.pre_type ?? null,
        };
        setBusy(true);
        try {
            const h = initial ? await api.put<HospitalDetail>(`/hospitals/${initial.id}`, body) : await api.post<HospitalItem>('/hospitals', body);
            toast(initial ? '기본 정보를 저장했습니다' : `‘${h.name}’ 병원을 등록했습니다`);
            onSaved(h);
        } catch (e) {
            setErr(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            size="wide"
            title={initial ? '기본 정보 수정' : '병원 등록'}
            sub={initial ? initial.name : '등록하면 ‘미접촉(예정)’ 단계로 시작합니다'}
            onClose={onClose}
            footer={
                <>
                    {err && (
                        <span className="err mr-auto self-center" role="alert">
                            {err}
                        </span>
                    )}
                    <button className="btn" onClick={onClose} type="button">
                        취소
                    </button>
                    <button className="btn primary" form="hform" disabled={busy}>
                        {busy ? '저장 중…' : initial ? '저장' : '등록'}
                    </button>
                </>
            }
        >
            <form id="hform" onSubmit={submit} className="form-grid" noValidate>
                <Field label="병원명" req className="span2">
                    <input {...inp('name')} maxLength={100} autoFocus={!initial} />
                </Field>

                <div className="fld span2">
                    <span>
                        주소 <em className="text-danger not-italic">*</em> <small>· 도로명 검색 후 상세주소 입력</small>
                    </span>
                    <div className="flex gap-2">
                        <input value={f.zip} readOnly placeholder="우편번호" className="!w-28" aria-label="우편번호" />
                        <input {...inp('address')} placeholder="주소 검색을 누르세요" aria-label="주소" />
                        <button type="button" className="btn" onClick={() => setAddrOpen(!addrOpen)}>
                            {addrOpen ? '닫기' : '주소 검색'}
                        </button>
                    </div>
                    {addrOpen && (
                        <AddressSearch
                            onPick={(a) => {
                                setF((x) => ({ ...x, ...a }));
                                setAddrOpen(false);
                            }}
                        />
                    )}
                    <input {...inp('address_detail')} placeholder="상세주소 (층·호수)" aria-label="상세주소" />
                </div>

                <Field label="병원 등급">
                    <select {...inp('grade')}>
                        <option value="">선택 안 함</option>
                        {meta.codes.grade?.map((g) => (
                            <option key={g}>{g}</option>
                        ))}
                    </select>
                </Field>
                <Field label="전문과">
                    <select {...inp('specialty')}>
                        <option value="">선택 안 함</option>
                        {meta.codes.specialty?.map((g) => (
                            <option key={g}>{g}</option>
                        ))}
                    </select>
                </Field>
                <Field label="대표 전화">
                    <input type="tel" {...inp('phone')} placeholder="02-000-0000" />
                </Field>
                <Field label="봉직수의사 수">
                    <input type="number" min={0} {...inp('vet_count')} />
                </Field>
                <Field label="원장님 이름">
                    <input {...inp('director')} maxLength={40} />
                </Field>
                <Field label="원장님 연락처">
                    <input type="tel" {...inp('director_phone')} placeholder="010-0000-0000" />
                </Field>
                <Field label="담당 영업사원" hint={ownScope ? '담당만 수정 역할은 바꿀 수 없음' : undefined}>
                    <select {...inp('owner_id')} disabled={ownScope}>
                        <option value="">담당 없음</option>
                        {meta.users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                                {u.team ? ` (${u.team})` : ''}
                            </option>
                        ))}
                    </select>
                </Field>
                {showPre && (
                    <div className="fld">
                        <span>미접촉(예정) 구분</span>
                        <div className="seg">
                            {Object.entries(meta.pre_types).map(([k, [label]]) => (
                                <button type="button" key={k} className={f.pre_type === k ? 'on' : ''} onClick={() => set('pre_type', k)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="fld span2">
                    <span>
                        접촉 경로 <small>· 여러 개 선택</small>
                    </span>
                    <div className="chips">
                        {meta.lead_sources.map((src) => (
                            <button type="button" key={src} className={`chip toggle ${f.sources.includes(src) ? 'on' : ''}`} onClick={() => set('sources', toggle(f.sources, src))} aria-pressed={f.sources.includes(src)}>
                                {src}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="fld span2">
                    <span>
                        카테고리 <small>· 여러 개 선택, 비우면 미분류</small>
                    </span>
                    <div className="chips">
                        {meta.categories.map((c) => (
                            <button
                                type="button"
                                key={c.id}
                                style={{ '--cc': c.color } as React.CSSProperties}
                                className={`chip toggle ${f.category_ids.includes(c.id) ? 'on' : ''}`}
                                onClick={() => set('category_ids', toggle(f.category_ids, c.id))}
                                aria-pressed={f.category_ids.includes(c.id)}
                            >
                                <i />
                                {c.name}
                            </button>
                        ))}
                        {!meta.categories.length && <span className="hint">카테고리가 없습니다</span>}
                    </div>
                </div>
                <Field label="사용 중인 경쟁 제품">
                    <select {...inp('competitor_id')}>
                        <option value="">없음 · 모름</option>
                        {meta.competitors.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="경쟁 제품 계약 만료일">
                    <input type="date" {...inp('competitor_until')} />
                </Field>
                <Field label="메모" className="span2">
                    <textarea rows={3} {...inp('memo')} maxLength={2000} />
                </Field>
            </form>
        </Modal>
    );
}
