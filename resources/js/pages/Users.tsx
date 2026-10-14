import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errMsg } from '../lib/api';
import { useStore } from '../lib/store';
import type { Op, PermMap, Role, User } from '../lib/types';
import { Empty, Field, fmtPhone, Icon, Loading, Modal, useConfirm } from '../components/ui';

const STATUS: Record<User['status'], [string, string]> = { pending: ['승인 대기', 'warn'], active: ['활성', 'ok'], inactive: ['비활성', ''] };
const OPS: [Op, string][] = [
    ['view', '표시'],
    ['read', '읽기'],
    ['create', '입력'],
    ['update', '수정'],
    ['delete', '삭제'],
];

export default function Users() {
    const { can, toast, me, refreshMeta } = useStore();
    const confirm = useConfirm();
    const [tab, setTab] = useState<'users' | 'roles'>('users');
    const [users, setUsers] = useState<User[] | null>(null);
    const [roles, setRoles] = useState<Role[] | null>(null);
    const [editUser, setEditUser] = useState<User | 'new' | null>(null);
    const [editRole, setEditRole] = useState<Role | 'new' | null>(null);
    const [approving, setApproving] = useState<User | null>(null);

    const load = useCallback(async () => {
        try {
            const [u, r] = await Promise.all([api.get<User[]>('/users'), api.get<Role[]>('/roles')]);
            setUsers(u);
            setRoles(r);
        } catch (e) {
            toast(errMsg(e), true);
        }
    }, [toast]);
    useEffect(() => void load(), [load]);

    const after = async (msg: string) => {
        toast(msg);
        await load();
        void refreshMeta();
    };
    const delUser = async (u: User) => {
        if (!(await confirm({ title: '사용자 삭제', body: <>‘{u.name}’을(를) 삭제할까요?{u.hospitals ? <> 담당 병원 {u.hospitals}곳은 ‘담당 없음’이 됩니다.</> : null}</>, ok: '삭제', danger: true }))) return;
        try {
            await api.del(`/users/${u.id}`);
            await after('사용자를 삭제했습니다');
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    const delRole = async (r: Role) => {
        if (!(await confirm({ title: '역할 삭제', body: `‘${r.name}’ 역할을 삭제할까요?`, ok: '삭제', danger: true }))) return;
        try {
            await api.del(`/roles/${r.id}`);
            await after('역할을 삭제했습니다');
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    const resetRole = async (r: Role) => {
        if (!(await confirm({ title: '기본값으로 되돌리기', body: `‘${r.name}’ 역할의 권한을 처음 값으로 되돌릴까요?`, ok: '되돌리기' }))) return;
        try {
            await api.post(`/roles/${r.id}/reset`);
            await after('기본값으로 되돌렸습니다');
        } catch (e) {
            toast(errMsg(e), true);
        }
    };

    if (!users || !roles) return <Loading />;
    const pending = users.filter((u) => u.status === 'pending');

    return (
        <>
            <div className="page-head">
                <div>
                    <h1>사용자·권한</h1>
                    <p>가입 승인, 사용자 관리, 역할별 권한 (표시 · 읽기 · 입력 · 수정 · 삭제)</p>
                </div>
                <div className="flex gap-2">
                    <div className="seg">
                        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>
                            사용자 {pending.length > 0 && `· 대기 ${pending.length}`}
                        </button>
                        <button className={tab === 'roles' ? 'on' : ''} onClick={() => setTab('roles')}>
                            역할 {roles.length}
                        </button>
                    </div>
                    {tab === 'users' && can('users', 'create') && (
                        <button className="btn primary" onClick={() => setEditUser('new')}>
                            <Icon name="plus" /> 사용자 추가
                        </button>
                    )}
                    {tab === 'roles' && can('users', 'create') && (
                        <button className="btn primary" onClick={() => setEditRole('new')}>
                            <Icon name="plus" /> 역할 추가
                        </button>
                    )}
                </div>
            </div>

            {tab === 'users' ? (
                <div className="tbl-wrap">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>소속 · 연락처</th>
                                <th>역할</th>
                                <th>상태</th>
                                <th>담당 병원</th>
                                <th>최근 로그인</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="h-name">
                                            {u.name} {u.id === me?.user.id && <span className="badge">나</span>}
                                        </div>
                                        <div className="h-sub mono">{u.username}</div>
                                    </td>
                                    <td>
                                        <div>{u.team ?? '-'}</div>
                                        <div className="h-sub">{u.phone}</div>
                                    </td>
                                    <td>{u.role_name ?? <span className="muted">미지정</span>}</td>
                                    <td>
                                        <span className={`badge ${STATUS[u.status][1]}`}>{STATUS[u.status][0]}</span>
                                    </td>
                                    <td className="mono">{u.hospitals ?? 0}</td>
                                    <td className="mono h-sub">{u.last_login_at ?? '-'}</td>
                                    <td className="whitespace-nowrap text-right">
                                        {u.status === 'pending' && can('users', 'update') && (
                                            <button className="btn sm primary mr-1" onClick={() => setApproving(u)}>
                                                승인
                                            </button>
                                        )}
                                        {can('users', 'update') && (
                                            <button className="icon-btn" onClick={() => setEditUser(u)} aria-label="수정">
                                                <Icon name="edit" />
                                            </button>
                                        )}
                                        {can('users', 'delete') && u.id !== me?.user.id && (
                                            <button className="icon-btn" onClick={() => void delUser(u)} aria-label="삭제">
                                                <Icon name="trash" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid gap-3">
                    {roles.map((r) => (
                        <section key={r.id} className="panel">
                            <h2>
                                {r.locked && <Icon name="lock" className="size-4 text-muted" />}
                                {r.name}
                                <span className="badge">{r.scope === 'own' ? '담당 병원만 수정' : '전체 병원 수정'}</span>
                                <span className="badge">사용자 {r.users_count}명</span>
                                <small className="flex gap-1">
                                    {!r.locked && r.key && can('users', 'update') && (
                                        <button className="btn sm ghost" onClick={() => void resetRole(r)}>
                                            기본값
                                        </button>
                                    )}
                                    {!r.locked && can('users', 'update') && (
                                        <button className="btn sm" onClick={() => setEditRole(r)}>
                                            <Icon name="edit" /> 편집
                                        </button>
                                    )}
                                    {!r.locked && can('users', 'delete') && (
                                        <button className="icon-btn" onClick={() => void delRole(r)} aria-label="삭제">
                                            <Icon name="trash" />
                                        </button>
                                    )}
                                </small>
                            </h2>
                            <p className="hint mb-2">{r.locked ? '관리자는 항상 모든 권한을 가지며 바꿀 수 없습니다' : r.description}</p>
                            <PermSummary p={r.permissions} />
                        </section>
                    ))}
                </div>
            )}

            {editUser && roles && <UserModal u={editUser === 'new' ? null : editUser} roles={roles} onClose={() => setEditUser(null)} onSaved={(m) => { setEditUser(null); void after(m); }} />}
            {editRole && <RoleModal r={editRole === 'new' ? null : editRole} onClose={() => setEditRole(null)} onSaved={(m) => { setEditRole(null); void after(m); }} />}
            {approving && (
                <ApproveModal
                    u={approving}
                    roles={roles}
                    onClose={() => setApproving(null)}
                    onSaved={() => {
                        setApproving(null);
                        void after('가입을 승인했습니다');
                    }}
                />
            )}
        </>
    );
}

function PermSummary({ p }: { p: PermMap }) {
    const { meta } = useStore();
    if (!meta) return null;
    return (
        <div className="chips">
            {meta.features.map((f) => {
                const ops = OPS.filter(([o]) => p[f.key]?.[o]).map(([, l]) => l);
                if (!ops.length) return null;
                return (
                    <span key={f.key} className="chip" title={ops.join(' · ')}>
                        <b className="font-semibold">{f.name}</b>
                        <span className="muted">{ops.length === f.ops.length ? '전체' : ops.join('·')}</span>
                    </span>
                );
            })}
        </div>
    );
}

function ApproveModal({ u, roles, onClose, onSaved }: { u: User; roles: Role[]; onClose: () => void; onSaved: () => void }) {
    const { toast } = useStore();
    const [roleId, setRoleId] = useState(String(roles.find((r) => r.key === 'sales')?.id ?? roles[0]?.id ?? ''));
    const save = async () => {
        try {
            await api.post(`/users/${u.id}/approve`, { role_id: Number(roleId) });
            onSaved();
        } catch (e) {
            toast(errMsg(e), true);
        }
    };
    return (
        <Modal
            size="sm"
            title="가입 승인"
            sub={`${u.name} · 아이디 ${u.username}`}
            onClose={onClose}
            footer={
                <>
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button className="btn primary" onClick={() => void save()}>
                        승인
                    </button>
                </>
            }
        >
            <Field label="역할">
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                    {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                            {r.name}
                        </option>
                    ))}
                </select>
            </Field>
        </Modal>
    );
}

function UserModal({ u, roles, onClose, onSaved }: { u: User | null; roles: Role[]; onClose: () => void; onSaved: (msg: string) => void }) {
    const [f, setF] = useState({
        name: u?.name ?? '',
        username: u?.username ?? '',
        email: u?.email ?? '',
        password: '',
        team: u?.team ?? '',
        phone: u?.phone ?? '',
        role_id: String(u?.role_id ?? roles.find((r) => r.key === 'sales')?.id ?? ''),
        status: u?.status ?? 'active',
        annual_leave: String(u?.annual_leave ?? 15),
    });
    const [err, setErr] = useState('');
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: k === 'phone' ? fmtPhone(e.target.value) : e.target.value });

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr('');
        const body = { ...f, role_id: f.role_id ? Number(f.role_id) : null, annual_leave: Number(f.annual_leave), password: f.password || null, team: f.team || null, phone: f.phone || null, email: f.email || null };
        try {
            if (u) await api.put(`/users/${u.id}`, body);
            else await api.post('/users', body);
            onSaved(u ? '사용자 정보를 저장했습니다' : '사용자를 추가했습니다');
        } catch (er) {
            setErr(errMsg(er));
        }
    };

    return (
        <Modal
            title={u ? '사용자 수정' : '사용자 추가'}
            sub={u ? `아이디 ${u.username}` : '바로 활성 상태로 추가됩니다'}
            onClose={onClose}
            footer={
                <>
                    {err && <span className="err mr-auto self-center">{err}</span>}
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button className="btn primary" form="uform">
                        저장
                    </button>
                </>
            }
        >
            <form id="uform" className="form-grid" onSubmit={submit}>
                <Field label="이름" req>
                    <input value={f.name} onChange={set('name')} maxLength={40} />
                </Field>
                <Field label="아이디" req hint="로그인용">
                    <input value={f.username} onChange={set('username')} autoCapitalize="none" spellCheck={false} />
                </Field>
                <Field label="이메일" hint="선택">
                    <input type="email" value={f.email} onChange={set('email')} />
                </Field>
                <Field label={u ? '새 비밀번호' : '비밀번호'} req={!u} hint={u ? '바꿀 때만 입력' : '8자 이상'}>
                    <input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" />
                </Field>
                <Field label="역할">
                    <select value={f.role_id} onChange={set('role_id')}>
                        <option value="">미지정</option>
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="소속">
                    <input value={f.team} onChange={set('team')} maxLength={40} />
                </Field>
                <Field label="연락처">
                    <input type="tel" value={f.phone} onChange={set('phone')} />
                </Field>
                {u && (
                    <Field label="상태">
                        <select value={f.status} onChange={set('status')}>
                            <option value="pending">승인 대기</option>
                            <option value="active">활성</option>
                            <option value="inactive">비활성 (로그인 불가)</option>
                        </select>
                    </Field>
                )}
                <Field label="연간 연차 (일)">
                    <input type="number" step="0.5" min={0} value={f.annual_leave} onChange={set('annual_leave')} />
                </Field>
            </form>
        </Modal>
    );
}

/** 의존 규칙: 입력·수정·삭제 → 표시·읽기 자동, 읽기 끄면 입력·수정·삭제 끔, 표시 끄면 전부 끔 */
function applyRule(p: Record<Op, boolean>, op: Op, on: boolean): Record<Op, boolean> {
    const n = { ...p, [op]: on };
    if (on && ['create', 'update', 'delete'].includes(op)) n.view = n.read = true;
    if (on && op === 'read') n.view = true;
    if (!on && op === 'read') n.create = n.update = n.delete = false;
    if (!on && op === 'view') return { view: false, read: false, create: false, update: false, delete: false };
    return n;
}

function RoleModal({ r, onClose, onSaved }: { r: Role | null; onClose: () => void; onSaved: (msg: string) => void }) {
    const { meta } = useStore();
    const [name, setName] = useState(r?.name ?? '');
    const [desc, setDesc] = useState(r?.description ?? '');
    const [scope, setScope] = useState<'all' | 'own'>(r?.scope ?? 'own');
    const [perms, setPerms] = useState<PermMap>(() => r?.permissions ?? {});
    const [err, setErr] = useState('');
    if (!meta) return null;

    const toggle = (key: string, op: Op) => {
        const cur = perms[key] ?? { view: false, read: false, create: false, update: false, delete: false };
        setPerms({ ...perms, [key]: applyRule(cur, op, !cur[op]) });
    };
    const save = async () => {
        setErr('');
        try {
            const body = { name: name.trim(), description: desc || null, scope, permissions: perms };
            if (r) await api.put(`/roles/${r.id}`, body);
            else await api.post('/roles', body);
            onSaved(r ? '역할을 저장했습니다' : '역할을 추가했습니다');
        } catch (e) {
            setErr(errMsg(e));
        }
    };

    return (
        <Modal
            size="wide"
            title={r ? '역할 편집' : '역할 추가'}
            onClose={onClose}
            footer={
                <>
                    {err && <span className="err mr-auto self-center">{err}</span>}
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button className="btn primary" onClick={() => void save()}>
                        저장
                    </button>
                </>
            }
        >
            <div className="form-grid mb-4">
                <Field label="역할 이름" req>
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
                </Field>
                <div className="fld">
                    <span>수정 범위 (병원·리드 평가·영업 활동·전환)</span>
                    <div className="seg">
                        <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
                            전체 병원
                        </button>
                        <button type="button" className={scope === 'own' ? 'on' : ''} onClick={() => setScope('own')}>
                            담당 병원만
                        </button>
                    </div>
                </div>
                <Field label="설명" className="span2">
                    <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} />
                </Field>
            </div>
            <p className="hint mb-2">입력·수정·삭제를 켜면 표시·읽기가 함께 켜지고, 읽기를 끄면 입력·수정·삭제가 꺼집니다. ‘담당 병원만’은 읽기는 전체, 입력·수정·삭제만 담당 병원으로 제한합니다.</p>
            <div className="tbl-wrap">
                <table className="tbl perm-tbl">
                    <thead>
                        <tr>
                            <th>기능</th>
                            {OPS.map(([, l]) => (
                                <th key={l}>{l}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {meta.features.map((f) => (
                            <tr key={f.key}>
                                <td>
                                    <b>{f.name}</b>
                                    <div className="h-sub">{f.desc}</div>
                                </td>
                                {OPS.map(([op, l]) => (
                                    <td key={op}>
                                        {f.ops.includes(op) ? (
                                            <input type="checkbox" className="size-4" checked={!!perms[f.key]?.[op]} onChange={() => toggle(f.key, op)} aria-label={`${f.name} ${l}`} />
                                        ) : (
                                            <span className="muted">-</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}

export function NoAccess() {
    return <Empty>이 화면을 볼 권한이 없습니다</Empty>;
}
