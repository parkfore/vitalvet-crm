/*
 * 엑셀(.xlsx) 내보내기: 병원 목록(지금 필터 그대로), 영업 보고서, 영업 활동 내역
 * 권한이 없는 항목(리드 평가·전환·사용)은 빼고 내보낸다.
 */
import { canRead, compById, gradeOf, preLabel, region, scoreOf, userName } from './domain';
import { bizOf, missingOf } from './hinfo';
import { REP_ST } from './constants';
import type { Hospital, Report } from './types';
import { today } from './utils';
import { S } from './store';

type Cell = string | number | null | { value: any; format?: string; fontWeight?: 'bold' };
const num = (v: any): Cell => (v === '' || v == null || !Number.isFinite(+v) ? null : { value: +v, format: '#,##0' });
const head = (cols: string[]): Cell[] => cols.map(c => ({ value: c, fontWeight: 'bold' }));

async function save(name: string, rows: Cell[][], widths: number[]) {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const blob: Blob = await (writeXlsxFile as any)(rows, { columns: widths.map(width => ({ width })), stickyRowsCount: 1 }).toBlob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vitalvet-${name}-${today()}.xlsx`;   // 파일 이름은 영문 (일부 브라우저가 한글 이름을 버림)
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function exportHospitals(list: Hospital[]) {
    const ev = canRead('eval'), ac = canRead('activity'), cv = canRead('conv');
    const cols = ['Lead #', '병원명', '영업 상태', '시·도', '시·군·구', '주소', '상세주소', '우편번호', '대표 전화', '원장님', '원장님 연락처', '원장님 나이대', '병원 등급', '전문과', '봉직수의사 수', '담당', '단계',
        '카테고리', '접촉 경로', '경쟁 제품', '계약 만료일', '정보 미완성', ...(ev ? ['리드 등급', '리드 점수'] : []), ...(ac ? ['예정 구분', '다음 액션일', '팔로우업 할 사항', '활동 수'] : []),
        ...(cv ? ['회원가입일', '누적 사용 건수', '최근 사용일'] : []), '인허가 관리번호', '등록일'];
    const rows: Cell[][] = [head(cols), ...list.map(h => [
        h.id, h.name, bizOf(h), h.sido, h.sigungu, h.address, h.addressDetail, h.zip, h.phone, h.director, h.directorPhone, h.directorAge || '', h.grade, h.specialty, num(h.vetCount), userName(h.ownerId), h.stage,
        (h.categoryIds || []).map(id => S.categories.find(c => c.id === id)?.name).filter(Boolean).join(', '), (h.sources || []).join(', '), compById(h.compId)?.name || '', h.compUntil || '',
        missingOf(h).map(x => x[1]).join(', '), ...(ev ? [gradeOf(h), num(scoreOf(h))] : []),
        ...(ac ? [preLabel(h)?.[0] || '', h.next?.date && !h.next.done ? h.next.date : '', h.next?.done ? '' : h.next?.todo || '', num((h.activities || []).length)] : []),
        ...(cv ? [h.signupDate || '', num(h.usageCount), h.lastUsedDate || ''] : []), h.extId || '', h.createdAt || '',
    ] as Cell[])];
    await save('hospitals', rows, cols.map(c => (c === '주소' ? 40 : c === '병원명' ? 24 : /팔로우업|카테고리|미완성/.test(c) ? 28 : 13)));
}

export async function exportReports(list: Report[]) {
    const cols = ['날짜', '작성자', '상태', '근무 형태', '방문 지역', '방문', '방문 목표', '통화', '문자·메일', '신규 등록', '단계 진전', '회원가입', '오늘 요약', '고객의 소리', '경쟁사', '지원 요청', '내일 계획 병원', '경비 합계', '이동 거리(km)', '검토자', '검토 의견'];
    const rows: Cell[][] = [head(cols), ...list.map(r => {
        const st = r.stats || {}; const exp = (r.exp || []).reduce((a, e) => a + (+e.amount || 0), 0);
        return [r.date, userName(r.authorId), REP_ST[r.status]?.[0] || r.status, r.workType, r.region, num(st.visits), num(r.goal), num(st.calls), num(st.msgs), num(st.newHosp), num(st.stageUps), num(st.signups),
            r.highlights, (r.voc || []).map((v: any) => `[${v.type}] ${v.text}`).join('\n'), (r.comp || []).map((v: any) => `${v.name}: ${v.text || ''}`).join('\n'), (r.issues || []).map((v: any) => `[${v.type}] ${v.text}`).join('\n'),
            (r.plan?.hospitalIds || []).map(id => S.hospitals.find(h => h.id === id)?.name).filter(Boolean).join(', '), num(exp), num(r.mileage), userName(r.reviewerId), r.reviewComment || ''] as Cell[];
    })];
    await save('reports', rows, cols.map(c => (/요약|소리|경쟁사|지원|계획|의견/.test(c) ? 36 : 11)));
}

export async function exportActivities(list: Hospital[], from: string, to: string, userId = '') {
    const cols = ['날짜', '병원', 'Lead #', '지역', '유형', '목적', '면담', '반응', '내용', '고객의 소리', '경쟁사 언급', '지원 요청', '작성자', '체크인'];
    const rows: Cell[][] = [head(cols)];
    const acts = list.flatMap(h => (h.activities || []).filter(a => a.date >= from && a.date <= to && (!userId || a.authorId === userId)).map(a => ({ h, a })))
        .sort((p, q) => q.a.date.localeCompare(p.a.date) || p.h.name.localeCompare(q.h.name, 'ko'));
    acts.forEach(({ h, a }) => rows.push([a.date, h.name, h.id, region(h), a.type, a.purpose || '', a.contact || '', a.reaction || '', a.note || '',
        a.voc ? `[${a.voc.type}] ${a.voc.text}` : '', a.comp ? `${compById(a.comp.competitorId)?.name || ''} ${a.comp.text || ''}`.trim() : '', a.issue ? `[${a.issue.type}] ${a.issue.text}` : '',
        userName(a.authorId), (a as any).geo ? ((a as any).geo.dist != null ? `${Math.round((a as any).geo.dist)}m` : '위치 기록') : a.manual ? `수동 ${a.manual.time}${a.manual.reason ? ' · ' + a.manual.reason : ''}` : '']));
    await save('activities', rows, cols.map(c => (/내용|소리|언급|요청/.test(c) ? 36 : c === '병원' ? 22 : 11)));
    return acts.length;
}
