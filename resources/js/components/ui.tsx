// 공통 화면 조각 (배지, 아바타, 날짜 입력, 비밀번호 입력, 창 틀, 알림)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EVAL_TOTAL, FNAME, type Feature } from '../lib/constants';
import { catById, followOf, gradeOf, preLabel, roNote, sc, scoreOf, userById } from '../lib/domain';
import { I } from '../lib/icons';
import { dialog, S, STAGES, toastMsg, ui, notify } from '../lib/store';
import type { Hospital } from '../lib/types';
import { distKm, fmtN, fmtPhone, hashColor, phoneErr, WD } from '../lib/utils';
import { BIZ_CLS, bizOf, missingOf, ORIGIN_LABEL } from '../lib/hinfo';

export const css = (o: Record<string, string | number | undefined>) => o as React.CSSProperties;

export function Av({ u, cls = '' }: { u?: { id?: string; userId?: string; name?: string; userName?: string } | null; cls?: string }) {
    const n = u?.name || u?.userName || '?'; const id = u?.id || u?.userId; const sl = userById(id)?.slot; const k = sl ? (sl - 1) % 8 + 1 : 0;
    return <span className={`av ${cls}`} style={css({ '--av': k ? `var(--v${k})` : hashColor(id || n), ...([3, 4, 5].includes(k) ? { color: '#10201c' } : {}) })}>{n[0]}</span>;
}
export const StageBadge = ({ s, pad }: { s: string; pad?: boolean }) => <span className="badge stage" style={css({ '--c': sc(s), ...(pad ? { padding: '0 6px' } : {}) })}>{s}</span>;
export function GradeBadge({ h }: { h: Hospital }) {
    const g = gradeOf(h), s = scoreOf(h);
    return <span className={`badge g-${g}`}>{s != null ? '리드 ' : ''}{g}{s != null ? <> <span className="mono">{s}/{EVAL_TOTAL}</span></> : null}</span>;
}
export function FollowBadge({ h }: { h: Hospital }) { const f = followOf(h); if (f === '없음') return <span className="muted">—</span>; return <span className={`badge f-${f}`}>{f}</span>; }
export function PreBadge({ h }: { h: Hospital }) { const p = preLabel(h); return p ? <span className="badge pre" style={css({ '--c': p[1] })}>{p[0]}</span> : null; }
/** 영업 상태 (휴업·폐업만 표시) · 정보 미완성 · 좌표 없음 · 가져온 경로 */
export function BizBadge({ h }: { h: Hospital }) { const b = bizOf(h); return b === '영업' ? null : <span className={`badge ${BIZ_CLS[b]}`} title={b === '폐업' && h.closedAt ? `폐업일 ${h.closedAt}` : undefined}>{b}</span>; }
export function InfoBadges({ h, origin }: { h: Hospital; origin?: boolean }) {
    const m = missingOf(h);
    return <>{m.length ? <span className="badge info-miss" title={`빠진 필수 정보: ${m.map(x => x[1]).join(', ')}`}>정보 미완성</span> : null}
        {!h.lat && h.address ? <span className="badge f-없음" title="주소로 지도 좌표를 찾지 못했습니다">좌표 없음</span> : null}
        {origin && h.importedFrom ? <span className="badge origin">{ORIGIN_LABEL[h.importedFrom]}</span> : null}</>;
}
export function CatChips({ h, max = 99 }: { h: Hospital; max?: number }) {
    const ids = h.categoryIds || []; if (!ids.length) return <span className="cat-chip none">미분류</span>;
    const cs = ids.map(catById).filter(Boolean) as { id: string; name: string; color: string }[];
    return <>{cs.slice(0, max).map(c => <span key={c.id} className="cat-chip" style={css({ '--cc': c.color })}><i />{c.name}</span>)}{cs.length > max ? <span className="cat-chip">+{cs.length - max}</span> : null}</>;
}
export function DistBar({ list }: { list: Hospital[] }) {
    const n = list.length || 1;
    return <div className="dist-bar">{STAGES.map(s => { const c = list.filter(h => h.stage === s).length; return c ? <i key={s} style={css({ '--c': sc(s), width: `${c / n * 100}%` })} title={`${s} ${c}`} /> : null; })}</div>;
}
export const RoNote = ({ f, h, style }: { f: Feature; h?: Hospital | null; style?: React.CSSProperties }) => <div className="ro-note" style={style}>{I.lock}{roNote(f, h)}</div>;
export const Locked = ({ f }: { f: Feature }) => <div className="lock">{I.lock}<b>{FNAME[f]} 열람 권한이 없습니다</b><span>관리자에게 권한을 요청하세요.</span></div>;

/** 날짜 입력 + 요일 표시 */
export function DateInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
    const dow = value ? `(${WD[new Date(value + 'T00:00:00').getDay()]})` : '';
    return <span className="dwrap" data-dow={dow}><input type="date" value={value || ''} onChange={e => onChange(e.target.value)} {...rest} /></span>;
}

const EYE = <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const EYE_OFF = <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1" /></svg>;
/* ---------- 방문 체크인: 지금 위치를 활동 기록에 남기고 병원과의 거리를 보여 준다 ---------- */
export type Geo = { lat: number; lng: number; acc?: number | null; dist?: number; at?: string };
/** 체크인 허용 거리(m): 관리자 설정 › 리드 등급·영업 목표 (기본 300m) */
export const checkinM = () => S?.settings?.checkinRadius || 300;
export const geoDist = (g: Geo | undefined, h?: { lat: any; lng: any } | null) => (g?.dist != null ? g.dist : g && h?.lat && h?.lng ? Math.round(distKm(g, h) * 1000) : null);
export function GeoBadge({ g, h }: { g?: Geo; h?: { lat: any; lng: any } | null }) {
    if (!g) return null; const d = geoDist(g, h);
    if (d == null) return <span className="badge f-없음" title="병원 좌표가 없어 거리를 잴 수 없습니다">위치 기록</span>;
    const txt = d < 1000 ? `${fmtN(d)}m` : `${(d / 1000).toFixed(1)}km`;
    return d <= checkinM() ? <span className="badge f-완료" title={`병원에서 ${txt}`}>현장 확인 · {txt}</span> : <span className="badge f-오늘" title="병원과 거리가 멉니다">병원에서 {txt}</span>;
}
export function CheckInButton({ h, geo, onGeo }: { h: { lat: any; lng: any } | null | undefined; geo?: Geo; onGeo: (g: Geo | undefined) => void }) {
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    if (!('geolocation' in navigator)) return null;
    const get = () => {
        setBusy(true); setErr('');
        if (!h?.lat || !h?.lng) { setBusy(false); setErr('병원 좌표가 없어 체크인할 수 없습니다. 기본 정보에서 주소를 먼저 확인하세요'); return; }
        navigator.geolocation.getCurrentPosition(p => {
            setBusy(false); const g = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }; const d = Math.round(distKm(g, h) * 1000); const lim = checkinM();
            if (d > lim) { setErr(`병원에서 ${d < 1000 ? fmtN(d) + 'm' : (d / 1000).toFixed(1) + 'km'} 떨어져 있어 체크인할 수 없습니다. 병원 ${fmtN(lim)}m 이내에서 다시 눌러 주세요${g.acc > 50 ? ` (지금 위치 정확도 ±${fmtN(g.acc)}m)` : ''}`); return; }
            onGeo(g);
        },
            e => { setBusy(false); setErr(e.code === 1 ? '위치 권한이 꺼져 있습니다. 브라우저 설정에서 위치를 허용하세요' : '현재 위치를 찾지 못했습니다. 잠시 뒤 다시 시도하세요'); },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    };
    return <div className="checkin">{geo ? <><GeoBadge g={geo} h={h} />{geo.acc ? <small className="hint">정확도 ±{fmtN(geo.acc)}m</small> : null}<button type="button" className="link-btn" onClick={() => onGeo(undefined)}>지우기</button></>
        : <><button type="button" className="btn sm" disabled={busy} onClick={get}>{I.pin}{busy ? '위치 찾는 중…' : '현재 위치로 체크인'}</button><small className="hint">병원 {fmtN(checkinM())}m 이내</small></>}{err ? <small className="field-err">{err}</small> : null}</div>;
}

/* ---------- 음성 입력: 말하면 글로 바꿔 칸에 이어 붙인다 (Chrome·Edge·삼성 인터넷·Safari) ---------- */
const SR: any = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
export function VoiceButton({ onText }: { onText: (t: string) => void }) {
    const [on, setOn] = useState(false); const rec = useRef<any>(null); const cb = useRef(onText); cb.current = onText;
    useEffect(() => () => { try { rec.current?.stop(); } catch { /* 이미 멈춤 */ } }, []);
    if (!SR) return null;
    const toggle = () => {
        if (on) { try { rec.current?.stop(); } catch { /* 이미 멈춤 */ } return; }
        const r = new SR(); r.lang = 'ko-KR'; r.continuous = true; r.interimResults = false;
        r.onresult = (e: any) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript; if (t.trim()) cb.current(t.trim()); };
        r.onend = () => setOn(false); r.onerror = () => setOn(false);
        rec.current = r; try { r.start(); setOn(true); } catch { setOn(false); }
    };
    return <button type="button" className={`btn sm voice-btn ${on ? 'on' : ''}`} onClick={toggle} title="말로 입력">{I.mic}{on ? '듣는 중… 누르면 멈춤' : '음성 입력'}</button>;
}
/** 글 뒤에 이어 붙이기 (띄어쓰기 하나) */
export const appendText = (cur: string, t: string) => (cur && !/\s$/.test(cur) ? cur + ' ' : cur || '') + t;

/** 전화번호 입력: 치는 동안 010-1234-5678 모양으로, 칸을 벗어나면 자릿수 확인 */
export function PhoneInput({ value, onChange, kind = 'mobile', id, disabled, placeholder, onKeyDown }: { value: string; onChange: (v: string) => void; kind?: 'mobile' | 'tel'; id?: string; disabled?: boolean; placeholder?: string; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> }) {
    const [touched, setTouched] = useState(false); const err = touched ? phoneErr(value, kind) : '';
    return <><input id={id} type="tel" inputMode="tel" autoComplete="tel" maxLength={14} value={value || ''} disabled={disabled} placeholder={placeholder || (kind === 'mobile' ? '010-0000-0000' : '02-000-0000')} aria-invalid={!!err}
        className={err ? 'bad' : undefined} onChange={e => onChange(fmtPhone(e.target.value))} onBlur={() => setTouched(true)} onKeyDown={onKeyDown} />{err ? <small className="field-err">{err}</small> : null}</>;
}

/** 비밀번호 입력 (보이기/숨기기 버튼) */
export function PasswordInput(props: React.ComponentProps<"input">) {
    const [show, setShow] = useState(false);
    return <span className="pw-wrap"><input {...props} type={show ? 'text' : 'password'} />
        <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보이기'} title={show ? '비밀번호 숨기기' : '비밀번호 보이기'} tabIndex={-1}>{show ? EYE_OFF : EYE}</button></span>;
}

/**
 * 바깥(배경)을 눌러 닫기: 누른 곳과 뗀 곳이 모두 배경일 때만 닫는다.
 * 입력칸에서 글자를 드래그하다 배경에서 마우스를 떼도 창이 닫히지 않는다.
 */
export function useBackdropClose(close: () => void) {
    const down = useRef(false); const fn = useRef(close); fn.current = close;
    return {
        onPointerDown: (e: React.PointerEvent) => { down.current = e.target === e.currentTarget; },
        onClick: (e: React.MouseEvent) => { if (down.current && e.target === e.currentTarget) fn.current(); down.current = false; },
    };
}

/** 가운데 창 (프로토타입의 modal 틀) */
export function Modal({ title, children, foot, size, onClose, headExtra }: { title: ReactNode; children: ReactNode; foot?: ReactNode; size?: 'sm' | 'wide'; onClose?: () => void; headExtra?: ReactNode }) {
    const close = onClose || (() => { ui.modal = null; notify(); });
    const bd = useBackdropClose(close);
    return <div className="backdrop" {...bd}>
        <div className={`modal ${size || ''}`} role="dialog" aria-modal="true" aria-labelledby="mt">
            <header><h2 id="mt">{title}</h2>{headExtra ? <div style={{ display: 'flex', gap: 6 }}>{headExtra}<button className="icon-btn" onClick={close} aria-label="닫기">{I.x}</button></div> : <button className="icon-btn" onClick={close} aria-label="닫기">{I.x}</button>}</header>
            <div className="body">{children}</div>
            {foot ? <footer>{foot}</footer> : null}
        </div>
    </div>;
}

export function ToastLayer() { return <div id="toastLayer">{toastMsg ? <div className="toast" role="status">{toastMsg}</div> : null}</div>; }

/** 확인·이름 입력 창 */
export function DialogLayer() {
    const d = dialog; const inp = useRef<HTMLInputElement>(null); const ok = useRef<HTMLButtonElement>(null); const [v, setV] = useState('');
    useEffect(() => { setV(d?.kind === 'prompt' ? d.value || '' : ''); setTimeout(() => (d?.kind === 'prompt' || d?.input ? inp.current : ok.current)?.focus(), 0); }, [d]);
    if (!d) return <div id="confirmLayer" />;
    if (d.kind === 'prompt') return <div id="confirmLayer"><div className="backdrop"><div className="modal sm" role="dialog" aria-modal="true"><header><h2>{d.title}</h2></header>
        <div className="body"><input id="pbIn" ref={inp} style={{ width: '100%' }} value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) d.resolve(v.trim()); }} /></div>
        <footer><button className="btn" id="pbNo" onClick={() => d.resolve(null)}>취소</button><button className="btn primary" id="pbOk" onClick={() => d.resolve(v.trim())}>저장</button></footer></div></div></div>;
    return <div id="confirmLayer"><div className="backdrop"><div className="modal sm" role="alertdialog" aria-modal="true"><header><h2>{d.title}</h2></header>
        <div className="body" style={{ display: 'grid', gap: 10 }}>{d.body}{d.input ? <label className="fld"><span>{d.input}</span><input id="cfIn" ref={inp} value={v} onChange={e => setV(e.target.value)} /></label> : null}</div>
        <footer><button className="btn" id="cfNo" onClick={() => d.resolve(false)}>취소</button><button id="cfOk" ref={ok} className={`btn ${d.danger ? 'danger solid' : 'primary'}`} onClick={() => d.resolve(d.input ? { v: v.trim() } : true)}>{d.ok || '확인'}</button></footer></div></div></div>;
}

/** 선택 버튼 묶음 (seg) */
export function Seg<T extends string>({ value, options, onChange, disabled, className, style }: { value: T; options: (T | [T, ReactNode])[]; onChange: (v: T) => void; disabled?: boolean; className?: string; style?: React.CSSProperties }) {
    return <div className={`seg ${className || ''}`} style={style}>{options.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return <button key={k} type="button" className={value === k ? 'on' : ''} disabled={disabled} onClick={() => onChange(k)}>{l}</button>; })}</div>;
}
