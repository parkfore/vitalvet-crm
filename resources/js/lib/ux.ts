// 화면 도우미: 빠진 입력칸으로 이동, 금액 한글 표기, 방문 횟수 세기

/** 빠진 입력칸으로 화면을 옮기고, 커서를 두고, 잠깐 빨갛게 표시한다 */
export function goTo(selector: string) {
    setTimeout(() => {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const field = el.matches('input,select,textarea') ? el : el.querySelector<HTMLElement>('input,select,textarea');
        field?.focus({ preventScroll: true });
        el.classList.remove('need-fix');
        void el.offsetWidth; // 같은 칸을 다시 표시할 때도 깜박이도록
        el.classList.add('need-fix');
        setTimeout(() => el.classList.remove('need-fix'), 2000);
    }, 30);
}

/** 숫자를 한글로: 13000 → '일만 삼천', 1250000 → '백이십오만' */
export function koreanNumber(n: number): string {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (!n) return '영';
    const D = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const S = ['', '십', '백', '천'];
    const BIG = ['', '만', '억', '조'];
    const groups: string[] = [];
    for (let g = 0; n > 0 && g < BIG.length; g++, n = Math.floor(n / 10000)) {
        const part = n % 10000; if (!part) continue;
        let s = '';
        String(part).padStart(4, '0').split('').forEach((c, i) => {
            const d = +c; if (!d) return;
            const unit = S[3 - i];
            s += (d === 1 && unit ? '' : D[d]) + unit; // 십·백·천 앞의 '일'은 생략
        });
        groups.unshift(s + BIG[g]);
    }
    return groups.join(' ');
}
/** 13000 → '13,000원 (일만 삼천원)' */
export const wonText = (v: any) => { const n = Math.floor(+v || 0); return `${n.toLocaleString('ko-KR')}원 (${koreanNumber(n)}원)`; };

/** 방문 횟수: 같은 병원·같은 날 방문 기록이 여러 개여도 1번으로 센다 */
export function visitCount(acts: { type: string; date: string; hid?: string; hospitalId?: string }[]) {
    return new Set(acts.filter(a => a.type === '방문').map(a => `${a.hid ?? a.hospitalId ?? ''}|${a.date}`)).size;
}
