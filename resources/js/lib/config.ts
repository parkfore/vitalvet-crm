// 서버(app.blade.php)가 넣어 준 공개 설정을 읽는다. 비밀 값은 여기에 없다.
export type MapProvider = 'kakao' | 'naver';

export interface AppConfig {
    name: string;
    env: string;
    mapProvider: MapProvider;
    mapJsKey: string | null;
}

declare global {
    interface Window {
        __APP__?: Partial<AppConfig>;
    }
}

export const appConfig: AppConfig = {
    name: window.__APP__?.name ?? 'VitalVET CRM',
    env: window.__APP__?.env ?? 'production',
    mapProvider: window.__APP__?.mapProvider === 'naver' ? 'naver' : 'kakao',
    mapJsKey: window.__APP__?.mapJsKey ?? null,
};
