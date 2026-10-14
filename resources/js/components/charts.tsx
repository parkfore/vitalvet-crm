/*
 * 차트 (SVG, 컨테이너 폭에 맞춰 그림) — 꺾은선·막대·가로 막대·레이더·스파크라인
 * 마우스를 올리면 data-tip 내용을 말풍선으로 보여준다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AXES, AXIS_HELP } from '../lib/constants';
import { fmtN, textW } from '../lib/utils';

export type Series = { name: string; color: string; values: (number | null)[] };
export type LineSpec = { type: 'line'; title?: string; labels: string[]; full?: string[]; series: Series[]; goal?: number; unit?: string; h?: number };
export type ColSpec = { type: 'col'; title?: string; labels: string[]; full?: string[]; series: Series[]; stacked?: boolean; unit?: string; h?: number };
export type HRow = { label: string; segs: { name?: string; value: number; color: string }[]; note?: string; valueLabel?: string };
export type HbarSpec = { type: 'hbar'; title?: string; rows: HRow[]; unit?: string; percent?: boolean; max?: number; rowH?: number; labelW?: number; valueName?: string };
export type ChartSpec = LineSpec | ColSpec | HbarSpec;

const tip = (lines: (string | number)[]) => ({ 'data-tip': lines.join('\n') });

function niceStep(max: number, count = 4) { if (max <= count) return 1; const raw = max / count; const p = 10 ** Math.floor(Math.log10(raw)); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
function niceMax(max: number) { const s = niceStep(max); return Math.max(s, Math.ceil(max / s) * s); }
function YAxis({ max, H, pt, pb, pl, W, pr }: any) {
    const st = niceStep(max); const out: ReactNode[] = [];
    for (let v = 0; v <= max + 1e-9; v += st) {
        const y = pt + (H - pt - pb) * (1 - v / max);
        out.push(<g key={v}><line x1={pl} x2={W - pr} y1={y} y2={y} stroke="var(--grid)" strokeWidth="1" /><text x={pl - 6} y={y + 4} textAnchor="end" className="ax">{fmtN(Math.round(v * 10) / 10)}</text></g>);
    }
    return <>{out}</>;
}
function XLabels({ labels, x, H, pb, avail }: { labels: string[]; x: (i: number) => number; H: number; pb: number; avail: number }) {
    const n = labels.length; const k = Math.max(1, Math.ceil(n * 48 / avail));
    return <>{labels.map((l, i) => (i % k === 0 || (i === n - 1 && (n - 1) % k > k / 2)) ? <text key={i} x={x(i)} y={H - pb + 16} textAnchor="middle" className="ax">{l}</text> : null)}</>;
}
function topRounded(x: number, y: number, w: number, h: number, r: number) { if (h <= 0) return ''; r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; }
function rightRounded(x: number, y: number, w: number, h: number, r: number) { if (w <= 0) return ''; r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; }

function LineSVG({ s, W }: { s: LineSpec; W: number }) {
    const H = s.h || 220, pl = 36, pr = 14, pt = 14, pb = 26; const n = s.labels.length;
    const vals = s.series.flatMap(x => x.values).filter(v => v != null) as number[];
    const max = niceMax(Math.max(s.goal || 0, ...vals, 1)); const aw = W - pl - pr;
    const x = (i: number) => pl + (n <= 1 ? aw / 2 : i * aw / (n - 1)); const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
    const xh = useRef<SVGLineElement>(null);
    const bw = n <= 1 ? aw : aw / (n - 1);
    return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <YAxis max={max} H={H} pt={pt} pb={pb} pl={pl} W={W} pr={pr} /><XLabels labels={s.labels} x={x} H={H} pb={pb} avail={aw} />
        {s.goal ? <><line x1={pl} x2={W - pr} y1={y(s.goal)} y2={y(s.goal)} stroke="var(--muted)" strokeWidth="1" strokeDasharray="4 4" /><text x={W - pr} y={y(s.goal) - 5} textAnchor="end" className="ax">목표 {s.goal}</text></> : null}
        {s.series.map((se, si) => {
            let d = '', pen = false; se.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i)},${y(v)}`; pen = true; });
            return <g key={si}><path d={d} fill="none" stroke={se.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {se.values.map((v, i) => {
                    if (v == null) return null; const lone = se.values[i - 1] == null && se.values[i + 1] == null; const last = i === se.values.length - 1 || se.values.slice(i + 1).every(z => z == null);
                    return lone || last ? <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={se.color} stroke="var(--surface)" strokeWidth="2" /> : null;
                })}</g>;
        })}
        <line ref={xh} className="xh" x1="0" x2="0" y1={pt} y2={H - pb} stroke="var(--muted)" strokeWidth="1" visibility="hidden" />
        {s.labels.map((l, i) => <rect key={i} x={x(i) - bw / 2} y={pt} width={bw} height={H - pt - pb} fill="transparent" data-cx={x(i)}
            {...tip([s.full?.[i] || l, ...s.series.map(se => `${se.name}: ${se.values[i] == null ? '보고 없음' : fmtN(se.values[i]) + (s.unit || '')}`)])} />)}
    </svg>;
}
function ColSVG({ s, W }: { s: ColSpec; W: number }) {
    const H = s.h || 220, pl = 36, pr = 10, pt = 14, pb = 26; const n = s.labels.length; const k = s.series.length;
    const tot = s.labels.map((_, i) => (s.stacked ? s.series.reduce((a, se) => a + (se.values[i] || 0), 0) : Math.max(...s.series.map(se => se.values[i] || 0))));
    const max = niceMax(Math.max(...tot, 1)); const aw = W - pl - pr; const band = aw / n; const x = (i: number) => pl + band * i + band / 2; const y = (v: number) => pt + (H - pt - pb) * (1 - v / max); const base = y(0);
    return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <YAxis max={max} H={H} pt={pt} pb={pb} pl={pl} W={W} pr={pr} /><XLabels labels={s.labels} x={x} H={H} pb={pb} avail={aw} />
        {s.labels.map((l, i) => {
            const t = tip([s.full?.[i] || l, ...s.series.map(se => `${se.name}: ${fmtN(se.values[i] || 0)}${s.unit || ''}`), ...(s.stacked && k > 1 ? [`합계: ${fmtN(tot[i])}${s.unit || ''}`] : [])]);
            const bars: ReactNode[] = [];
            if (s.stacked) {
                const bwid = Math.min(24, band * .62); let acc = 0; const segs = s.series.map(se => ({ c: se.color, v: se.values[i] || 0 })).filter(z => z.v > 0);
                segs.forEach((z, j) => {
                    const y1 = y(acc + z.v), y0 = y(acc); const top = j === segs.length - 1; const h = y0 - y1 - (j > 0 ? 2 : 0);
                    if (h > 0) bars.push(top ? <path key={j} d={topRounded(x(i) - bwid / 2, y1, bwid, h, 4)} fill={z.c} /> : <rect key={j} x={x(i) - bwid / 2} y={y1} width={bwid} height={h} fill={z.c} />);
                    acc += z.v;
                });
            } else {
                const gw = Math.min(16, band * .8 / k); const start = x(i) - gw * k / 2 - (k - 1);
                s.series.forEach((se, j) => { const v = se.values[i] || 0; const y1 = y(v); bars.push(<path key={j} d={topRounded(start + j * (gw + 2), y1, gw, base - y1, 4)} fill={se.color} />); });
            }
            return <g key={i}>{bars}<rect x={pl + band * i} y={pt} width={band} height={H - pt - pb} fill="transparent" {...t} /></g>;
        })}
    </svg>;
}
export const hbarHeight = (s: HbarSpec) => s.rows.length * (s.rowH || 30) + 8;
function HbarSVG({ s, W }: { s: HbarSpec; W: number }) {
    const rh = s.rowH || 30, bh = Math.min(16, rh - 12); const H = hbarHeight(s); const lw = Math.min(s.labelW || 110, W * .34);
    const vlab = (r: HRow) => (s.percent ? (r.note ?? '') : (r.valueLabel ?? `${fmtN(r.segs.reduce((a, z) => a + z.value, 0))}${s.unit || ''}`));
    const vw = Math.min(W * .3, Math.max(36, ...s.rows.map(r => textW(vlab(r)) + 14))); const aw = Math.max(40, W - lw - vw - 8);
    const tots = s.rows.map(r => r.segs.reduce((a, z) => a + z.value, 0)); const max = s.percent ? 1 : (s.max || Math.max(...tots, 1));
    return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {s.rows.map((r, i) => {
            const cy = 4 + i * rh + rh / 2; const t = tots[i]; let acc = lw;
            const mc = Math.max(3, Math.floor((lw - 10) / 11.5)); const lab0 = r.label.length > mc ? r.label.slice(0, mc - 1) + '…' : r.label;
            const segs = r.segs.filter(z => z.value > 0);
            return <g key={i}>
                <text x={lw - 8} y={cy + 4} textAnchor="end" className="lb"><title>{r.label}</title>{lab0}</text>
                <rect x={lw} y={cy - bh / 2} width={aw} height={bh} fill="var(--track)" rx="3" />
                {segs.map((z, j) => {
                    const w = (s.percent ? (t ? z.value / t : 0) : z.value / max) * aw; const last = j === segs.length - 1; const ww = w - (last ? 0 : 2); const x0 = acc; acc += w;
                    const tp = tip([r.label, `${z.name || s.valueName || '값'}: ${fmtN(z.value)}${s.unit || ''}${s.percent && t ? ` (${Math.round(z.value / t * 100)}%)` : ''}`]);
                    if (ww <= 0) return null;
                    return last ? <path key={j} d={rightRounded(x0, cy - bh / 2, ww, bh, 4)} fill={z.color} {...tp} /> : <rect key={j} x={x0} y={cy - bh / 2} width={ww} height={bh} fill={z.color} {...tp} />;
                })}
                <text x={lw + aw + 8} y={cy + 4} className="vl">{vlab(r)}</text>
            </g>;
        })}
    </svg>;
}

/** 폭을 재서 그리는 차트 상자 */
export function Chart({ spec }: { spec: ChartSpec }) {
    const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(0);
    useEffect(() => {
        const el = ref.current!; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
        return () => ro.disconnect();
    }, []);
    const h = spec.type === 'hbar' ? hbarHeight(spec) : spec.h || 220;
    return <div className="chart" ref={ref} style={{ height: h }} role="img" aria-label={spec.title || '차트'}>
        {w ? spec.type === 'line' ? <LineSVG s={spec} W={w} /> : spec.type === 'col' ? <ColSVG s={spec} W={w} /> : <HbarSVG s={spec} W={w} /> : null}
    </div>;
}
export function Legend({ series }: { series: { name: string; color: string }[] }) {
    if (series.length < 2) return null;
    return <div className="legend">{series.map((s, i) => <span key={i}><i style={{ background: s.color }} />{s.name}</span>)}</div>;
}
export function TableView({ head, rows }: { head: string[]; rows: (string | number | null | undefined)[][] }) {
    return <details className="tview"><summary>표로 보기</summary><div className="tbl-wrap"><table><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''}>{c ?? '—'}</td>)}</tr>)}</tbody></table></div></details>;
}

/** 팀 성과 레이더 */
export function Radar({ vals, avg, color, size, compact }: { vals: Record<string, number | null>; avg: Record<string, number>; color: string; size: number; compact?: boolean }) {
    const n = AXES.length, c = size / 2, r = size / 2 - (compact ? 26 : 40); const mx = compact ? 56 : 64;
    const P = (i: number, v: number | null) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * r * (v || 0) / 100, c + Math.sin(a) * r * (v || 0) / 100]; };
    return <svg viewBox={`${-mx} 0 ${size + mx * 2} ${size}`} className="radar" role="img" aria-label="역량 레이더">
        {[25, 50, 75, 100].map(v => <polygon key={v} points={AXES.map((_, i) => P(i, v).join(',')).join(' ')} fill="none" stroke="var(--grid)" strokeWidth="1" />)}
        {AXES.map(([k, l], i) => {
            const [x, y] = P(i, 100); const [lx, ly] = P(i, compact ? 118 : 122); const anc = Math.abs(lx - c) < 4 ? 'middle' : lx > c ? 'start' : 'end';
            return <g key={k}><line x1={c} y1={c} x2={x} y2={y} stroke="var(--grid)" strokeWidth="1" /><text x={lx} y={ly + 4} textAnchor={anc} className="ax" fontSize={compact ? 15 : 13} fontWeight="600">{l}</text></g>;
        })}
        <polygon points={AXES.map(([k], i) => P(i, avg[k] || 0).join(',')).join(' ')} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points={AXES.map(([k], i) => P(i, vals[k]).join(',')).join(' ')} fill={color} fillOpacity=".16" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {AXES.map(([k, l], i) => { const [x, y] = P(i, vals[k]); return <circle key={k} cx={x} cy={y} r={compact ? 3.5 : 4.5} fill={color} stroke="var(--surface)" strokeWidth="2" {...tip([l, vals[k] == null ? '이 기간 데이터 없음 · 종합 점수에서 제외' : `${Math.round(vals[k]!)}점 (팀 평균 ${Math.round(avg[k])})`, AXIS_HELP[k]])} />; })}
    </svg>;
}
export function Spark({ vals, color }: { vals: number[]; color: string }) {
    const w = 120, h = 28, max = Math.max(1, ...vals); const x = (i: number) => 4 + i * (w - 8) / (vals.length - 1 || 1), y = (v: number) => h - 4 - (h - 8) * v / max;
    return <svg viewBox={`0 0 ${w} ${h}`} className="spark"><polyline points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /><circle cx={x(vals.length - 1)} cy={y(vals.at(-1)!)} r="3" fill={color} /></svg>;
}

/* 말풍선: 화면 전체에 한 번만 설치 */
let tipInstalled = false;
export function installChartTip() {
    if (tipInstalled) return; tipInstalled = true;
    const tipEl = document.createElement('div'); tipEl.className = 'ctip'; tipEl.hidden = true; document.body.appendChild(tipEl); let xh: Element | null = null;
    const show = (e: PointerEvent, t: string) => {
        tipEl.textContent = t; tipEl.hidden = false; const r = tipEl.getBoundingClientRect(); let x = e.clientX + 14, y = e.clientY + 14;
        if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
        tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
    };
    const hideTip = () => { tipEl.hidden = true; if (xh) { xh.setAttribute('visibility', 'hidden'); xh = null; } };
    document.addEventListener('click', () => setTimeout(hideTip, 0), true); document.addEventListener('scroll', hideTip, true);
    document.addEventListener('pointerdown', e => { if (!(e.target as Element).closest?.('[data-tip]')) hideTip(); });
    document.addEventListener('pointermove', e => {
        const t = (e.target as Element).closest?.('[data-tip]') as (SVGElement & { dataset: DOMStringMap }) | null;
        if (!t) { if (!tipEl.hidden) hideTip(); return; }
        show(e, t.dataset.tip || '');
        if (t.dataset.cx) { const l = (t as any).ownerSVGElement?.querySelector('.xh'); if (l) { if (xh && xh !== l) xh.setAttribute('visibility', 'hidden'); xh = l; l.setAttribute('x1', t.dataset.cx); l.setAttribute('x2', t.dataset.cx); l.setAttribute('visibility', 'visible'); } }
    });
}
