// ⓘ 계산 기준 말풍선 (팀 성과 지표 설명)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AXES } from '../lib/constants';
import { teamData, type Metrics } from '../lib/domain';
import { I } from '../lib/icons';
import { S, ui } from '../lib/store';

type Info = { t: string; f: string; d: string[]; ex?: (m: Metrics, D: ReturnType<typeof teamData>) => string };
export const INFO: Record<string, Info> = {
    activity: { t: '활동량', f: '방문 수 ÷ 근무일 방문 목표 합 × 100 (최대 100점)', d: ['방문은 본인이 기록한 ‘방문’ 활동만 셉니다. 전화·문자는 넣지 않습니다.', '근무일은 주말, 회사 휴일, 승인된 연차·병가·경조사를 뺀 날입니다.', '하루 목표는 설정의 일일 방문 목표(지금 ${G}곳)이고, 반차인 날은 절반, 교육인 날은 0곳입니다.'], ex: m => `방문 ${m.visits}곳 ÷ 목표 ${m.goalSum}곳 (근무 ${m.worked}일)` },
    coverage: { t: '관리 범위', f: '최근 14일 안에 연락한 담당 병원 ÷ 진행 중인 담당 병원 × 100', d: ['진행 중 = 이탈 단계(보류·Lost 등)가 아닌 담당 병원입니다.', '연락은 방문·전화·문자·이메일 등 모든 활동 기록을 셉니다.', '기간 선택과 관계없이 오늘 기준 최근 14일로 봅니다.'], ex: m => `연락 ${m.contacted}곳 ÷ 담당 ${m.own}곳` },
    progress: { t: '단계 진척', f: '기간 중 담당 병원의 단계 진전 건수 ÷ 팀에서 가장 많은 사람의 건수 × 100', d: ['진행 단계 순서에서 앞으로 나아간 변경만 셉니다. 이탈 단계로 가거나 뒤로 간 것은 빼고 셉니다.', '누가 바꿨는지와 관계없이 그 사람이 담당한 병원 기준입니다.', '팀 전체에 진전이 하나도 없으면 ‘데이터 없음’으로 두고 종합 점수에서 뺍니다.'], ex: (m, D) => `진전 ${m.ups}건 ÷ 팀 최고 ${D.maxUp}건` },
    followup: { t: '팔로우업', f: '기한이 지나지 않은 다음 액션 ÷ 진행 중인 다음 액션 × 100', d: ['완료 처리하지 않은 다음 액션만 셉니다.', '다음 액션일이 오늘보다 앞이면 ‘지연’입니다.', '진행 중인 다음 액션이 없으면 100점입니다.'], ex: m => `기한 내 ${m.withNext - m.overdue.length}건 ÷ 진행 중 ${m.withNext}건 (지연 ${m.overdue.length}건)` },
    report: { t: '보고 성실도', f: '보고서를 제출한 근무일 ÷ 제출해야 할 근무일 × 100', d: ['제출 또는 팀장 확인 상태만 제출로 봅니다. 임시 저장·반려는 빼고 셉니다.', '오늘은 아직 작성 중일 수 있어 빼고, 어제까지만 봅니다.', '연차·병가·경조사로 쉰 날은 제출할 날에서 뺍니다.'], ex: m => `제출 ${m.subm}일 ÷ ${m.due}일` },
    response: { t: '고객 반응', f: '긍정 ÷ (긍정 + 보통 + 부정) × 100', d: ['기간 중 본인이 기록한 방문·통화의 ‘반응’ 값을 셉니다.', '‘부재’와 반응을 고르지 않은 기록은 빼고 셉니다.'], ex: m => `긍정 ${m.re.긍정} ÷ ${m.ans}건 (보통 ${m.re.보통}, 부정 ${m.re.부정})` },
    quality: { t: '평가 입력', f: '리드 평가 3항목을 모두 입력한 병원 ÷ 평가 대상 담당 병원 × 100', d: ['3항목은 디지털 수용도, 서비스 호감도, 월 마취 건수이고 각각 0~5점으로 평가합니다.', '평가 대상은 1차 방문 이후 단계의 담당 병원입니다. 이탈 단계는 방문 기록이 있을 때만 대상입니다.'], ex: m => `완료 ${m.evalOk}곳 ÷ ${m.elig}곳` },
    total: { t: '종합 점수·등급', f: '7개 항목 점수의 평균 (데이터가 없는 항목은 빼고 평균)', d: ['A 80점 이상 우수 · B 65~79 양호 · C 50~64 보통 · D 50 미만 관리 필요', '레이더 차트의 점선은 팀 평균이고, 항목별 팀 평균도 데이터가 있는 사람만으로 냅니다.', '점수는 사람을 줄 세우기보다 코칭할 항목을 찾는 용도로 보세요.'], ex: m => AXES.map(([k, l]) => `${l} ${m.scores[k] == null ? '—' : Math.round(m.scores[k]!)}`).join(' · ') + ` → 평균 ${Math.round(m.total)}점` },
    alerts: { t: '주의 항목', f: '아래 규칙에 걸린 항목 수 (빨강·주황만 셉니다)', d: ['빨강: 팔로우업 지연이 있음, 보고서 미제출 2일 이상', '주황: 2주 넘게 연락 없는 담당 병원, 보고서 미제출 1일, 일평균 방문이 목표의 75% 미만', '파랑(참고): 리드 평가 미완료 3곳 이상 · 초록(좋음): 회원가입 전환'] },
    visitsKpi: { t: '기간 방문', f: '기간 중 팀원이 기록한 ‘방문’ 활동 합계', d: ['아래 작은 글씨는 같은 기간의 ‘전화’ 기록 합계입니다.'] },
    upsKpi: { t: '단계 진전', f: '기간 중 팀원 담당 병원의 단계 진전 합계', d: ['회원가입 전환은 회원가입일이 기간 안에 있는 담당 병원 수입니다.'] },
};

const INFO_SVG = <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
let closeOpen: (() => void) | null = null; // 한 번에 하나만 열림

export function InfoBtn({ k, u }: { k: string; u?: string }) {
    const [open, setOpen] = useState(false); const btn = useRef<HTMLButtonElement>(null);
    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        if (open) { setOpen(false); return; }
        closeOpen?.(); closeOpen = () => setOpen(false); setOpen(true);
    };
    return <>
        <button type="button" ref={btn} className="info-btn" aria-label={`${INFO[k].t} 계산 기준 보기`} aria-expanded={open} onClick={toggle}>{INFO_SVG}</button>
        {open && <Pop k={k} u={u} anchor={btn.current!} onClose={(focus) => { setOpen(false); closeOpen = null; if (focus) btn.current?.focus(); }} />}
    </>;
}

function Pop({ k, u, anchor, onClose }: { k: string; u?: string; anchor: HTMLElement; onClose: (focus?: boolean) => void }) {
    const el = useRef<HTMLDivElement>(null); const I2 = INFO[k];
    let ex: React.ReactNode = null;
    if (I2.ex && u) {
        const D = teamData(ui.team.weeks); const m = D.M.find(x => x.u.id === u);
        if (m) { const v = k === 'total' ? null : m.scores[k]; ex = <div className="ip-ex"><b>{m.u.name}</b> · {I2.ex(m, D)}{k !== 'total' ? <> = <b>{v == null ? '데이터 없음' : Math.round(v) + '점'}</b></> : null}</div>; }
    }
    useLayoutEffect(() => {
        const p = el.current!; const r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
        let x = r.left + r.width / 2 - pw / 2, y = r.bottom + 8; x = Math.max(8, Math.min(innerWidth - pw - 8, x)); if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
        p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.setProperty('--ax', (r.left + r.width / 2 - x) + 'px'); p.classList.toggle('up', y < r.top);
        p.querySelector<HTMLButtonElement>('[data-info-close]')?.focus();
    }, [anchor]);
    useEffect(() => {
        const out = (e: MouseEvent) => { if (!el.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose(); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(true); } };
        const close = () => onClose(); const sc = (e: Event) => { if (!el.current?.contains(e.target as Node)) onClose(); };
        document.addEventListener('click', out, true); document.addEventListener('keydown', esc, true); window.addEventListener('resize', close); document.addEventListener('scroll', sc, true);
        return () => { document.removeEventListener('click', out, true); document.removeEventListener('keydown', esc, true); window.removeEventListener('resize', close); document.removeEventListener('scroll', sc, true); };
    }, [anchor, onClose]);
    return createPortal(<div className="info-pop" ref={el} role="dialog" aria-label={I2.t + ' 계산 기준'}>
        <div className="ip-head"><b>{I2.t}</b><button type="button" className="icon-btn" data-info-close aria-label="닫기" onClick={() => onClose(true)}>{I.x}</button></div>
        <div className="ip-f">{I2.f}</div><ul>{I2.d.map((x, i) => <li key={i}>{x.replace('${G}', String(S.settings.visitGoal || 4))}</li>)}</ul>{ex}
    </div>, document.body);
}
