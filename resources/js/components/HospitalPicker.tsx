// 병원 검색 자동완성 (병원명·지역·원장 이름)
import { useEffect, useRef, useState } from 'react';
import { hName, hpSearch, region } from '../lib/domain';
import type { Hospital } from '../lib/types';

export function HospitalPicker({ value, onPick, placeholder, dayIds = [], exclude = [], planMode, id }:
    { value: string; onPick: (id: string) => void; placeholder?: string; dayIds?: string[]; exclude?: string[]; planMode?: boolean; id?: string }) {
    const [text, setText] = useState(planMode ? '' : hName(value)); const [open, setOpen] = useState(false); const [act, setAct] = useState(0);
    const [res, setRes] = useState<Hospital[]>([]); const inp = useRef<HTMLInputElement>(null); const list = useRef<HTMLUListElement>(null);
    useEffect(() => { if (!planMode && document.activeElement !== inp.current) setText(hName(value)); }, [value, planMode]);
    const search = (q: string) => { setRes(hpSearch(q, dayIds, exclude, planMode)); setAct(0); setOpen(true); };
    const pick = (hid: string) => {
        setOpen(false); onPick(hid);
        if (planMode) { setText(''); setTimeout(() => inp.current?.focus(), 20); } else setText(hName(hid));
    };
    useEffect(() => { list.current?.children[act]?.scrollIntoView({ block: 'nearest' }); }, [act]);
    return <div className="hp">
        <input ref={inp} id={id} className="hp-in" value={text} placeholder={placeholder || '병원명·지역·원장 이름으로 검색'} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open}
            onChange={e => { setText(e.target.value); if (!e.target.value.trim() && !planMode) onPick(''); search(e.target.value); }}
            onFocus={() => search(text)}
            onBlur={() => setTimeout(() => { setOpen(false); setText(planMode ? '' : hName(value)); }, 160)}
            onKeyDown={e => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!open) search(text); setAct(a => Math.max(0, Math.min(res.length - 1, a + (e.key === 'ArrowDown' ? 1 : -1)))); }
                else if (e.key === 'Enter') { if (open && res[act]) { e.preventDefault(); pick(res[act].id); } }
                else if (e.key === 'Escape') { if (open) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setOpen(false); } }
            }} />
        <ul ref={list} className="hp-list" role="listbox" hidden={!open}>
            {res.length ? res.map((h, i) => <li key={h.id} role="option" aria-selected={i === act} className={i === act ? 'act' : ''} data-hp-pick={h.id} onPointerDown={e => { e.preventDefault(); pick(h.id); }}>
                <b>{h.name}</b><span>{region(h)} · {h.stage}{h.director ? ` · ${h.director} 원장` : ''}{dayIds.includes(h.id) ? ' · 오늘 접촉' : ''}</span></li>) : <li className="none">검색 결과가 없습니다</li>}
        </ul>
    </div>;
}
