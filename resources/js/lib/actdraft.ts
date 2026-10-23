/* 활동 기록 임시 저장: '기록 추가'를 누르기 전에 쓴 내용(음성 입력 포함)을 이 기기에 보관했다가 다시 열면 이어서 쓴다 */
const pre = 'vv-act-draft:';
const EMPTY_KEYS = ['note', 'purpose', 'contact', 'reaction', 'vocText', 'compText', 'issText'];
export const draftHasContent = (d: any) => !!d && EMPTY_KEYS.some(k => String(d[k] || '').trim() !== '');
export function loadDraft<T>(key: string): T | null { try { const v = localStorage.getItem(pre + key); if (!v) return null; const d = JSON.parse(v); return draftHasContent(d) ? d : null; } catch { return null; } }
export function saveDraft(key: string, d: any) {
    try { if (draftHasContent(d)) { const { geo, ...rest } = d; void geo; localStorage.setItem(pre + key, JSON.stringify({ ...rest, savedAt: Date.now() })); } else localStorage.removeItem(pre + key); } catch { /* 저장 불가 */ }
}
export const clearDraft = (key: string) => { try { localStorage.removeItem(pre + key); } catch { /* 저장 불가 */ } };
