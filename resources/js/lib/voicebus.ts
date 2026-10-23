/* 음성 입력 멈추기: 메뉴·탭을 옮기거나 다른 앱·브라우저 탭으로 가면 듣고 있던 음성 입력을 멈춘다 */
const stops = new Set<() => void>();
export const onVoiceStop = (f: () => void) => { stops.add(f); return () => { stops.delete(f); }; };
export const stopAllVoice = () => stops.forEach(f => { try { f(); } catch { /* 이미 멈춤 */ } });
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stopAllVoice(); });
    window.addEventListener('pagehide', stopAllVoice);
}
