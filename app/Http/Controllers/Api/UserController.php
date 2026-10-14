<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hospital;
use App\Models\Role;
use App\Models\User;
use App\Support\Audit;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        Perm::need($this->actor(), 'users', 'read');
        $counts = Hospital::query()->whereNull('deleted_at')->selectRaw('owner_id, count(*) as n')->groupBy('owner_id')->pluck('n', 'owner_id');

        return response()->json(User::query()->with('role')->orderByRaw("case status when 'pending' then 0 when 'active' then 1 else 2 end")->orderBy('name')->get()
            ->map(fn ($u) => $u->toPublic() + ['hospitals' => (int) ($counts[$u->id] ?? 0)])->values());
    }

    private function snap(User $u): array
    {
        $u->load('role');

        return ['name' => ['이름', $u->name], 'email' => ['이메일', $u->email], 'team' => ['소속', $u->team], 'phone' => ['연락처', $u->phone],
            'role' => ['역할', $u->role?->name], 'status' => ['상태', ['pending' => '승인 대기', 'active' => '활성', 'inactive' => '비활성'][$u->status] ?? $u->status],
            'leave' => ['연간 연차', (string) $u->annual_leave]];
    }

    public function store(Request $r)
    {
        Perm::need($this->actor(), 'users', 'create');
        $d = $r->validate(['name' => 'required|string|max:40', 'email' => 'required|email|max:120|unique:users,email', 'password' => 'required|string|min:8|max:100',
            'team' => 'nullable|string|max:40', 'phone' => 'nullable|string|max:20', 'role_id' => 'required|exists:roles,id', 'annual_leave' => 'nullable|numeric|min:0|max:60']);
        $u = User::create($d + ['status' => 'active', 'phone' => $this->phone($d['phone'] ?? null), 'annual_leave' => $d['annual_leave'] ?? 15]);
        Audit::log('user', $u->id, $u->name, 'create', '사용자', Audit::diff([], $this->snap($u)));

        return response()->json($u->toPublic(), 201);
    }

    public function update(Request $r, User $user)
    {
        Perm::need($this->actor(), 'users', 'update');
        $d = $r->validate(['name' => 'required|string|max:40', 'email' => ['required', 'email', 'max:120', Rule::unique('users')->ignore($user->id)],
            'team' => 'nullable|string|max:40', 'phone' => 'nullable|string|max:20', 'role_id' => 'nullable|exists:roles,id',
            'status' => 'required|in:pending,active,inactive', 'annual_leave' => 'nullable|numeric|min:0|max:60', 'password' => 'nullable|string|min:8|max:100']);
        $isSelf = $user->id === $this->actor()->id;
        if ($isSelf && ($d['status'] !== 'active' || (int) ($d['role_id'] ?? 0) !== (int) $user->role_id)) {
            return $this->fail('내 계정의 역할과 상태는 바꿀 수 없습니다');
        }
        if ($d['status'] === 'active' && empty($d['role_id'])) {
            return $this->fail('활성 사용자는 역할을 정해야 합니다');
        }
        if ($this->isLastAdmin($user) && ((int) ($d['role_id'] ?? 0) !== (int) $user->role_id || $d['status'] !== 'active')) {
            return $this->fail('마지막 관리자는 역할이나 상태를 바꿀 수 없습니다');
        }
        $before = $this->snap($user);
        $user->fill(collect($d)->except('password')->all());
        $user->phone = $this->phone($d['phone'] ?? null);
        $user->annual_leave = $d['annual_leave'] ?? $user->annual_leave;
        if (! empty($d['password'])) {
            $user->password = $d['password'];
        }
        $user->save();
        $ch = Audit::diff($before, $this->snap($user));
        if (! empty($d['password'])) {
            $ch[] = ['field' => '비밀번호', 'before' => '', 'after' => '변경됨'];
        }
        if ($ch) {
            Audit::log('user', $user->id, $user->name, 'update', '사용자', $ch);
        }

        return response()->json($user->fresh()->toPublic());
    }

    public function approve(Request $r, User $user)
    {
        Perm::need($this->actor(), 'users', 'update');
        $d = $r->validate(['role_id' => 'required|exists:roles,id']);
        $before = $this->snap($user);
        $user->update(['role_id' => $d['role_id'], 'status' => 'active']);
        Audit::log('user', $user->id, $user->name, 'update', '가입 승인', Audit::diff($before, $this->snap($user)));

        return response()->json($user->fresh()->toPublic());
    }

    public function destroy(User $user)
    {
        Perm::need($this->actor(), 'users', 'delete');
        if ($user->id === $this->actor()->id) {
            return $this->fail('내 계정은 삭제할 수 없습니다');
        }
        if ($this->isLastAdmin($user)) {
            return $this->fail('마지막 관리자는 삭제할 수 없습니다');
        }
        $own = Hospital::query()->where('owner_id', $user->id)->get();
        foreach ($own as $h) {
            Audit::log('hospital', $h->id, $h->name, 'update', '기본 정보', [['field' => '담당 영업사원', 'before' => $user->name, 'after' => '']], $h->id, "사용자 {$user->name} 삭제로 담당 미지정");
        }
        Hospital::query()->where('owner_id', $user->id)->update(['owner_id' => null]);
        Audit::log('user', $user->id, $user->name, 'delete', '사용자', Audit::diff($this->snap($user), []));
        $user->delete();

        return response()->json(['ok' => true, 'unassigned' => $own->count()]);
    }

    private function isLastAdmin(User $u): bool
    {
        $admin = Role::where('locked', true)->pluck('id');

        return $admin->contains($u->role_id) && $u->status === 'active'
            && User::query()->whereIn('role_id', $admin)->where('status', 'active')->count() <= 1;
    }
}
