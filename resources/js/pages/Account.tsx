import { useState, type FormEvent } from 'react';
import { api, errMsg } from '../lib/api';
import { useStore } from '../lib/store';
import { Field } from '../components/ui';

export default function Account() {
    const { me, toast } = useStore();
    const [f, setF] = useState({ current: '', password: '', password2: '' });
    const [err, setErr] = useState('');
    if (!me) return null;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr('');
        if (f.password.length < 8) return setErr('새 비밀번호는 8자 이상이어야 합니다');
        if (f.password !== f.password2) return setErr('새 비밀번호 확인이 일치하지 않습니다');
        try {
            await api.post('/auth/password', { current: f.current, password: f.password });
            toast('비밀번호를 바꿨습니다');
            setF({ current: '', password: '', password2: '' });
        } catch (er) {
            setErr(errMsg(er));
        }
    };

    return (
        <>
            <div className="page-head">
                <div>
                    <h1>내 정보</h1>
                    <p>
                        {me.user.name} · 아이디 {me.user.username}
                    </p>
                </div>
            </div>
            <div className="grid2">
                <section className="panel">
                    <h2>계정</h2>
                    <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-[14px]">
                        <dt className="muted">역할</dt>
                        <dd>{me.user.role_name}</dd>
                        <dt className="muted">수정 범위</dt>
                        <dd>{me.scope === 'own' ? '담당 병원만' : '전체 병원'}</dd>
                        <dt className="muted">소속</dt>
                        <dd>{me.user.team ?? '-'}</dd>
                        <dt className="muted">연락처</dt>
                        <dd>{me.user.phone ?? '-'}</dd>
                    </dl>
                </section>
                <form className="panel grid gap-3" onSubmit={submit}>
                    <h2 className="!mb-0">비밀번호 변경</h2>
                    <Field label="현재 비밀번호">
                        <input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" />
                    </Field>
                    <Field label="새 비밀번호" hint="8자 이상">
                        <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
                    </Field>
                    <Field label="새 비밀번호 확인">
                        <input type="password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} autoComplete="new-password" />
                    </Field>
                    {err && <p className="err">{err}</p>}
                    <button className="btn primary justify-self-start">변경</button>
                </form>
            </div>
        </>
    );
}
