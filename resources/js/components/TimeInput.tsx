// 시간 입력: 오전/오후 + 시 + 분을 직접 입력하거나, 시계 버튼으로 골라 넣는다. 값은 'HH:MM' (24시간)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');
const split = (v: string) => { const [H, M] = (v || '00:00').split(':').map(n => +n || 0); return { pm: H >= 12, h: H % 12 || 12, m: M }; };
const join = (pm: boolean, h: number, m: number) => `${pad((h % 12) + (pm ? 12 : 0))}:${pad(m)}`;
export const timeLabel = (t: string) => { if (!t) return ''; const x = split(t); return `${x.pm ? '오후' : '오전'} ${x.h}:${pad(x.m)}`; };

const CLOCK = <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;

export function TimeInput({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
    const cur = split(value); const [hs, setHs] = useState(String(cur.h)); const [ms, setMs] = useState(pad(cur.m)); const [focus, setFocus] = useState(false);
    const [open, setOpen] = useState(false); const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
    const wrap = useRef<HTMLDivElement>(null); const hRef = useRef<HTMLInputElement>(null); const mRef = useRef<HTMLInputElement>(null); const pop = useRef<HTMLDivElement>(null);
    // 바깥에서 값이 바뀌면 (입력 중이 아닐 때) 칸을 맞춘다
    useEffect(() => { if (!focus) { setHs(String(cur.h)); setMs(pad(cur.m)); } }, [value, focus]); // eslint-disable-line react-hooks/exhaustive-deps
    const commit = (pm = cur.pm, h = cur.h, m = cur.m) => { const v = join(pm, Math.min(12, Math.max(1, h)), Math.min(59, Math.max(0, m))); if (v !== value) onChange(v); };
    // 시: 1~12 는 그대로, 13~23 은 오후로 바꾸고, 0 은 오전 12시, 그 밖의 값은 원래 시로 되돌린다
    const blurH = () => { const n = parseInt((hRef.current?.value ?? hs).replace(/\D/g, ''), 10); if (isNaN(n) || n > 23) { setHs(String(cur.h)); return; } const h = n === 0 ? 12 : n > 12 ? n - 12 : n; const pm = n > 12 ? true : n === 0 ? false : cur.pm; setHs(String(h)); commit(pm, h, cur.m); };
    const blurM = () => { const n = Math.min(59, Math.max(0, parseInt((mRef.current?.value ?? ms).replace(/\D/g, ''), 10) || 0)); setMs(pad(n)); commit(cur.pm, cur.h, n); };
    const keyH = (e: React.KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const h = ((cur.h - 1 + (e.key === 'ArrowUp' ? 1 : 11)) % 12) + 1; setHs(String(h)); commit(cur.pm, h, cur.m); } else if (e.key === ':' || e.key === 'Enter') { e.preventDefault(); mRef.current?.focus(); } };
    const keyM = (e: React.KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const st = e.shiftKey ? 10 : 1; const m = (cur.m + (e.key === 'ArrowUp' ? st : 60 - st)) % 60; setMs(pad(m)); commit(cur.pm, cur.h, m); } else if (e.key === 'Backspace' && !ms) { hRef.current?.focus(); } else if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } };
    const onH = (v: string) => setHs(v.replace(/\D/g, '').slice(0, 2));
    // 같은 숫자를 다시 쳐도(값이 그대로여도) 다음 칸으로 넘어가도록 input 이벤트에서 처리
    const advH = (e: React.FormEvent<HTMLInputElement>) => { const d = e.currentTarget.value.replace(/\D/g, ''); if (d.length >= 2 || (d.length === 1 && +d > 2)) { mRef.current?.focus(); mRef.current?.select(); } };
    const onM = (v: string) => setMs(v.replace(/\D/g, '').slice(0, 2));

    // 고르기 창: 화면 밖으로 나가지 않게 고정 위치로 띄운다
    useLayoutEffect(() => {
        if (!open || !wrap.current) return; const r = wrap.current.getBoundingClientRect(); const W = 268, H = 300;
        const top = r.bottom + 6 + H > window.innerHeight ? Math.max(8, r.top - H - 6) : r.bottom + 6; const left = Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8);
        setPos({ left, top });
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const down = (e: Event) => { if (!pop.current?.contains(e.target as Node) && !wrap.current?.contains(e.target as Node)) setOpen(false); };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
        const close = () => setOpen(false);
        document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key, true); window.addEventListener('resize', close);
        return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', close); };
    }, [open]);

    return <div className={`ti ${disabled ? 'dis' : ''} ${focus ? 'focus' : ''}`} ref={wrap} id={id} data-value={value}>
        <button type="button" className="ti-ap" disabled={disabled} aria-label="오전·오후 바꾸기" onClick={() => commit(!cur.pm)}>{cur.pm ? '오후' : '오전'}</button>
        <input ref={hRef} className="ti-h" aria-label="시" inputMode="numeric" value={hs} disabled={disabled} onFocus={e => { setFocus(true); e.target.select(); }} onBlur={() => { setFocus(false); blurH(); }} onChange={e => onH(e.target.value)} onInput={advH} onKeyDown={keyH} />
        <span className="ti-c">:</span>
        <input ref={mRef} className="ti-m" aria-label="분" inputMode="numeric" value={ms} disabled={disabled} onFocus={e => { setFocus(true); e.target.select(); }} onBlur={() => { setFocus(false); blurM(); }} onChange={e => onM(e.target.value)} onKeyDown={keyM} />
        <button type="button" className="ti-pick" disabled={disabled} aria-label="시간 고르기" aria-expanded={open} onClick={() => setOpen(o => !o)}>{CLOCK}</button>
        {open && pos ? <div className="ti-pop" ref={pop} style={{ left: pos.left, top: pos.top }} role="dialog" aria-label="시간 고르기">
            <div className="seg ti-seg">{[false, true].map(pm => <button key={String(pm)} type="button" className={cur.pm === pm ? 'on' : ''} onClick={() => commit(pm)}>{pm ? '오후' : '오전'}</button>)}</div>
            <div className="ti-lbl">시</div>
            <div className="ti-grid">{Array.from({ length: 12 }, (_, i) => i + 1).map(h => <button key={h} type="button" className={cur.h === h ? 'on' : ''} onClick={() => { setHs(String(h)); commit(cur.pm, h, cur.m); }}>{h}</button>)}</div>
            <div className="ti-lbl">분 <small>5분 단위 · 다른 분은 칸에 직접 입력</small></div>
            <div className="ti-grid">{Array.from({ length: 12 }, (_, i) => i * 5).map(m => <button key={m} type="button" className={cur.m === m ? 'on' : ''} onClick={() => { setMs(pad(m)); commit(cur.pm, cur.h, m); setOpen(false); }}>{pad(m)}</button>)}</div>
        </div> : null}
    </div>;
}
