<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Support\Audit;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index()
    {
        Perm::need($this->actor(), 'users', 'read');

        return response()->json(Role::query()->withCount('users')->orderBy('id')->get()->map(fn ($r) => [
            'id' => $r->id, 'key' => $r->key, 'name' => $r->name, 'description' => $r->description, 'scope' => $r->scope,
            'locked' => $r->locked, 'permissions' => $r->effective(), 'users_count' => $r->users_count,
        ]));
    }

    private function permText(array $p): array
    {
        $out = [];
        foreach (config('crm.features') as $k => [$name]) {
            $out[$k] = [$name, implode('', array_map(fn ($op) => ! empty($p[$k][$op]) ? ['view' => '표시 ', 'read' => '읽기 ', 'create' => '입력 ', 'update' => '수정 ', 'delete' => '삭제 '][$op] : '', config('crm.ops'))) ?: '없음'];
        }

        return $out;
    }

    private function snap(Role $r): array
    {
        return ['name' => ['역할 이름', $r->name], 'desc' => ['설명', $r->description], 'scope' => ['수정 범위', $r->scope === 'own' ? '담당만' : '전체']] + $this->permText($r->effective());
    }

    private function validated(Request $r, ?Role $role = null): array
    {
        return $r->validate([
            'name' => ['required', 'string', 'max:40', Rule::unique('roles')->ignore($role?->id)],
            'description' => 'nullable|string|max:200',
            'scope' => 'required|in:all,own',
            'permissions' => 'required|array',
        ], ['name.unique' => '같은 이름의 역할이 있습니다']);
    }

    public function store(Request $r)
    {
        Perm::need($this->actor(), 'users', 'create');
        $d = $this->validated($r);
        $role = Role::create(['name' => $d['name'], 'description' => $d['description'] ?? null, 'scope' => $d['scope'], 'permissions' => Perm::normalize($d['permissions'])]);
        Audit::log('role', $role->id, $role->name, 'create', '역할', Audit::diff([], $this->snap($role)));

        return response()->json(['id' => $role->id], 201);
    }

    public function update(Request $r, Role $role)
    {
        Perm::need($this->actor(), 'users', 'update');
        if ($role->locked) {
            return $this->fail('관리자 역할은 바꿀 수 없습니다', 403, 'FORBIDDEN');
        }
        $d = $this->validated($r, $role);
        $before = $this->snap($role);
        $role->update(['name' => $d['name'], 'description' => $d['description'] ?? null, 'scope' => $d['scope'], 'permissions' => Perm::normalize($d['permissions'])]);
        if ($ch = Audit::diff($before, $this->snap($role))) {
            Audit::log('role', $role->id, $role->name, 'update', '역할', $ch);
        }

        return response()->json(['ok' => true]);
    }

    public function reset(Role $role)
    {
        Perm::need($this->actor(), 'users', 'update');
        $def = config("crm.roles.{$role->key}");
        if (! $def || $role->locked) {
            return $this->fail('기본값이 없는 역할입니다');
        }
        $before = $this->snap($role);
        $role->update(['scope' => $def[2], 'permissions' => Perm::fromSpec($def[4])]);
        if ($ch = Audit::diff($before, $this->snap($role))) {
            Audit::log('role', $role->id, $role->name, 'update', '역할', $ch, null, '기본값으로 되돌림');
        }

        return response()->json(['ok' => true]);
    }

    public function destroy(Role $role)
    {
        Perm::need($this->actor(), 'users', 'delete');
        if ($role->locked) {
            return $this->fail('관리자 역할은 삭제할 수 없습니다');
        }
        if ($role->users()->exists()) {
            return $this->fail('사용 중인 역할은 삭제할 수 없습니다. 사용자의 역할을 먼저 바꾸세요');
        }
        Audit::log('role', $role->id, $role->name, 'delete', '역할', Audit::diff($this->snap($role), []));
        $role->delete();

        return response()->json(['ok' => true]);
    }
}
