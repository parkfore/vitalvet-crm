<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Perm;
use App\Support\Sync;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    /** 아이디·비밀번호 로그인 */
    public function login(Request $r)
    {
        $data = $r->validate(['username' => 'required|string|max:30', 'password' => 'required|string|max:100']);
        $username = strtolower(trim($data['username']));
        $key = 'login:'.$username.'|'.$r->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return $this->fail('로그인 시도가 너무 많습니다. '.ceil(RateLimiter::availableIn($key) / 60).'분 후 다시 시도하세요', 429, 'TOO_MANY_ATTEMPTS');
        }
        $u = User::where('username', $username)->first();
        if (! $u || ! Hash::check($data['password'], $u->password)) {
            RateLimiter::hit($key, 600);

            return $this->fail('아이디 또는 비밀번호가 올바르지 않습니다');
        }
        if ($u->status === 'pending') {
            return $this->fail("{$u->name()}님은 관리자 승인 대기 중이라 로그인할 수 없습니다.", 403, 'ACCOUNT_NOT_ACTIVE');
        }
        if (! $u->isActive() || ! $u->role_id) {
            return $this->fail('사용할 수 없는 계정입니다. 관리자에게 문의하세요', 403, 'ACCOUNT_NOT_ACTIVE');
        }
        RateLimiter::clear($key);
        Auth::login($u, true);
        $r->session()->regenerate();
        $u->forceFill(['last_login_at' => now()])->saveQuietly();

        return response()->json(['user' => $u->present()]);
    }

    public function logout(Request $r)
    {
        Auth::guard('web')->logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    /** 회원가입 신청 → 승인 대기 */
    public function signup(Request $r)
    {
        $r->merge(['username' => strtolower(trim((string) $r->input('username')))]);
        $data = $r->validate([
            'name' => 'required|string|max:40',
            'username' => ['required', 'string', 'regex:'.User::USERNAME_REGEX, 'unique:users,username'],
            'password' => 'required|string|min:8|max:100',
            'team' => ['required', 'string', \Illuminate\Validation\Rule::in(\App\Support\Store::codes()['teams'])],
            'phone' => 'nullable|string|max:20',
        ], [
            'team.required' => '소속을 선택하세요.',
            'team.in' => '목록에 있는 소속을 선택하세요.',
            'username.regex' => '아이디는 영문 소문자로 시작하고 영문 소문자·숫자·. _ - 로 4~30자여야 합니다.',
            'username.unique' => '이미 사용 중인 아이디입니다.',
        ]);
        $slot = 1 + (int) User::all()->max(fn ($u) => (int) ($u->data['slot'] ?? 0));
        $u = User::create([
            'id' => User::newId(), 'username' => $data['username'], 'password' => $data['password'], 'status' => 'pending', 'role_id' => null,
            'data' => ['name' => trim($data['name']), 'team' => trim((string) ($data['team'] ?? '')), 'phone' => (string) $this->phone($data['phone'] ?? ''),
                'slot' => $slot, 'joinedAt' => now()->toDateString()],
        ]);
        Sync::log($u, ['entity' => 'user', 'entityId' => $u->id, 'targetName' => $u->name(), 'action' => 'create', 'section' => '가입 신청',
            'changes' => array_values(array_filter([['field' => '아이디', 'before' => '', 'after' => $u->username], ['field' => '소속', 'before' => '', 'after' => $u->data['team']]], fn ($c) => $c['after'] !== ''))]);

        return response()->json(['ok' => true], 201);
    }

    /** 회원가입 화면의 소속 목록 (로그인 전) */
    public function teams()
    {
        return response()->json(['teams' => \App\Support\Store::codes()['teams']]);
    }

    public function me(Request $r)
    {
        $u = $r->user();
        if (! $u || ! $u->isActive() || ! $u->role_id) {
            return response()->json(['user' => null]);
        }

        return response()->json(['user' => $u->present()]);
    }

    /** 내 비밀번호 바꾸기 */
    public function changePassword(Request $r)
    {
        $data = $r->validate(['current' => 'required|string', 'password' => 'required|string|min:8|max:100']);
        $me = $this->actor();
        if (! Hash::check($data['current'], $me->password)) {
            return $this->fail('현재 비밀번호가 올바르지 않습니다');
        }
        $me->update(['password' => $data['password']]);

        return response()->json(['ok' => true]);
    }

    /** 관리자: 사용자 비밀번호 지정 (사용자 추가·비밀번호 초기화) */
    public function setPassword(Request $r, string $id)
    {
        $data = $r->validate(['password' => 'required|string|min:8|max:100']);
        $me = $this->actor();
        $u = User::findOrFail($id);
        $created = $u->created_at && $u->created_at->gt(now()->subMinutes(10)) && ! $u->last_login_at;
        if (! Perm::can($me, 'users', 'update') && ! ($created && Perm::can($me, 'users', 'create'))) {
            return $this->fail('사용자·권한 수정 권한이 없습니다', 403, 'FORBIDDEN');
        }
        $u->update(['password' => $data['password']]);
        Sync::log($me, ['entity' => 'user', 'entityId' => $u->id, 'targetName' => $u->name(), 'action' => 'update', 'section' => '사용자',
            'changes' => [['field' => '비밀번호', 'before' => '', 'after' => '설정됨']]]);

        return response()->json(['ok' => true]);
    }
}
