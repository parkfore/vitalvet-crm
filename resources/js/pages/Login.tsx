import { useState, type FormEvent } from 'react';
import { api, errMsg } from '../lib/api';
import { useStore } from '../lib/store';
import type { Me } from '../lib/types';
import { Field, fmtPhone, Icon } from '../components/ui';

export default function Login() {
    const { setMe, toast } = useStore();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [f, setF] = useState({ username: '', email: '', password: '', password2: '', name: '', team: '', phone: '' });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'phone' ? fmtPhone(e.target.value) : e.target.value });

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr('');
        if (mode === 'signup' && f.password !== f.password2) return setErr('비밀번호 확인이 일치하지 않습니다');
        setBusy(true);
        try {
            if (mode === 'login') {
                setMe(await api.post<Me>('/auth/login', { username: f.username.trim(), password: f.password }));
            } else {
                const r = await api.post<{ message: string }>('/auth/signup', { name: f.name.trim(), username: f.username.trim(), email: f.email.trim() || null, password: f.password, team: f.team || null, phone: f.phone || null });
                toast(r.message);
                setMode('login');
                setF({ ...f, password: '', password2: '' });
            }
        } catch (e) {
            setErr(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="grid min-h-dvh place-items-center px-4 py-10">
            <form onSubmit={submit} className="panel grid w-full max-w-sm gap-4 !p-6" noValidate>
                <div className="flex items-center gap-3">
                    <span className="brand-mark">
                        <Icon name="pulse" className="size-5" />
                    </span>
                    <div>
                        <b className="block text-[17px]">VitalVET CRM</b>
                        <small className="muted">{mode === 'login' ? '영업 관리 로그인' : '가입 신청 · 관리자 승인 후 사용'}</small>
                    </div>
                </div>

                {mode === 'signup' && (
                    <Field label="이름" req>
                        <input value={f.name} onChange={set('name')} autoComplete="name" required maxLength={40} />
                    </Field>
                )}
                <Field label="아이디" req hint={mode === 'signup' ? '영문 소문자·숫자 4자 이상' : undefined}>
                    <input value={f.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
                </Field>
                <Field label="비밀번호" req hint={mode === 'signup' ? '8자 이상' : undefined}>
                    <input type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
                </Field>
                {mode === 'signup' && (
                    <>
                        <Field label="비밀번호 확인" req>
                            <input type="password" value={f.password2} onChange={set('password2')} autoComplete="new-password" />
                        </Field>
                        <Field label="이메일" hint="선택">
                            <input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
                        </Field>
                        <div className="form-grid">
                            <Field label="소속">
                                <input value={f.team} onChange={set('team')} placeholder="예: 영업1팀" />
                            </Field>
                            <Field label="연락처">
                                <input type="tel" value={f.phone} onChange={set('phone')} placeholder="010-0000-0000" />
                            </Field>
                        </div>
                    </>
                )}
                {err && (
                    <p className="err" role="alert">
                        {err}
                    </p>
                )}
                <button className="btn primary h-11" disabled={busy}>
                    {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입 신청'}
                </button>
                <p className="hint text-center">
                    {mode === 'login' ? '처음이신가요? ' : '이미 계정이 있나요? '}
                    <button
                        type="button"
                        className="font-semibold text-brand underline"
                        onClick={() => {
                            setMode(mode === 'login' ? 'signup' : 'login');
                            setErr('');
                        }}
                    >
                        {mode === 'login' ? '가입 신청' : '로그인'}
                    </button>
                </p>
            </form>
        </main>
    );
}
