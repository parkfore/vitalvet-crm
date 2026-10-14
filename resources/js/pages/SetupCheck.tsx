import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { appConfig } from '../lib/config';

interface Health {
    status: 'ok' | 'degraded';
    app: string;
    env: string;
    time: string;
    timezone: string;
    checks: { api: boolean; database: boolean; map_key: boolean };
    map_provider: string;
    detail: null | { php: string; laravel: string; db_connection: string; db_error: string | null };
}

type State = boolean | null | 'warn';
type Row = { label: string; ok: State; note: string; optional?: boolean };

// 세팅 확인용 첫 화면: 화면·API·DB·지도 키가 연결됐는지 보여준다.
export default function SetupCheck() {
    const [health, setHealth] = useState<Health | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setHealth(await api.get<Health>('/health'));
        } catch (e) {
            if (e instanceof ApiError && typeof e.body === 'object' && e.body && 'checks' in e.body) {
                setHealth(e.body as Health); // 503: DB 실패도 내용은 보여준다
            } else {
                setHealth(null);
                setError(e instanceof ApiError ? `API 응답 오류 (${e.status})` : 'API 서버에 연결할 수 없습니다');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const mapName = appConfig.mapProvider === 'naver' ? '네이버' : '카카오';
    const rows: Row[] = [
        { label: '화면 (React)', ok: true, note: '이 화면이 보이면 정상' },
        { label: 'API 서버 (Laravel)', ok: loading ? null : !!health, note: error ?? (health ? '응답 정상' : '확인 중') },
        {
            label: '데이터베이스',
            ok: loading ? null : health ? health.checks.database : false,
            note: health ? (health.checks.database ? '연결 정상' : '연결 실패: .env의 DB 정보를 확인하세요') : '-',
        },
        {
            label: `지도 키 (${mapName})`,
            ok: loading ? null : health?.checks.map_key ? true : 'warn',
            optional: true,
            note: health ? (health.checks.map_key ? '설정됨' : '.env에 키가 비어 있음 (지도 기능 개발 전까지는 괜찮음)') : '-',
        },
    ];
    const allOk = !loading && rows.every((r) => r.ok === true || (r.optional && r.ok === 'warn'));

    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-10">
            <header className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-brand text-white" aria-hidden>
                    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 13h4l2-5 4 10 3-7 2 2h5" />
                    </svg>
                </span>
                <div>
                    <h1 className="text-xl font-bold">{appConfig.name}</h1>
                    <p className="text-sm text-muted">개발 환경 연결 확인</p>
                </div>
            </header>

            <section
                className={`rounded-xl border px-5 py-4 ${allOk ? 'border-ok bg-ok-soft' : 'border-line bg-surface'}`}
                aria-live="polite"
            >
                <p className="text-lg font-semibold">
                    {loading ? '확인 중…' : allOk ? '준비 완료 — 기능 개발을 시작할 수 있습니다' : '일부 항목을 확인해 주세요'}
                </p>
                {health && (
                    <p className="mt-1 text-sm text-muted">
                        환경 {health.env} · 서버 시각 {health.time} ({health.timezone})
                    </p>
                )}
            </section>

            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {rows.map((r) => (
                    <li key={r.label} className="flex items-center gap-3 px-5 py-3">
                        <StatusDot ok={r.ok} />
                        <span className="w-32 shrink-0 font-medium sm:w-40">{r.label}</span>
                        <span className="text-sm text-muted">{r.note}</span>
                    </li>
                ))}
            </ul>

            {health?.detail && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-5 py-4 text-sm">
                    <dt className="text-muted">PHP</dt>
                    <dd>{health.detail.php}</dd>
                    <dt className="text-muted">Laravel</dt>
                    <dd>{health.detail.laravel}</dd>
                    <dt className="text-muted">DB 종류</dt>
                    <dd>{health.detail.db_connection}</dd>
                    {health.detail.db_error && (
                        <>
                            <dt className="text-danger">DB 오류</dt>
                            <dd className="break-all text-danger">{health.detail.db_error}</dd>
                        </>
                    )}
                </dl>
            )}

            <button
                type="button"
                onClick={() => void load()}
                className="self-start rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
            >
                다시 확인
            </button>
        </main>
    );
}

function StatusDot({ ok }: { ok: State }) {
    const cls = ok === null ? 'bg-line' : ok === 'warn' ? 'bg-warn' : ok ? 'bg-ok' : 'bg-danger';
    const label = ok === null ? '확인 중' : ok === 'warn' ? '나중에 설정' : ok ? '정상' : '문제';
    return <span className={`size-2.5 shrink-0 rounded-full ${cls}`} role="img" aria-label={label} />;
}
