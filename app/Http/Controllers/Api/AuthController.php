<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public function login(Request $r)
    {
        $data = $r->validate(['username' => 'required|string|max:30', 'password' => 'required|string']);
        $username = strtolower(trim($data['username']));
        $key = 'login:'.$username.'|'.$r->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return $this->fail('로그인 시도가 너무 많습니다. '.ceil(RateLimiter::availableIn($key) / 60).'분 후 다시 시도하세요', 429, 'TOO_MANY_ATTEMPTS');
        }
        if (! Auth::attempt(['username' => $username, 'password' => $data['password']], true)) {
            RateLimiter::hit($key, 600);

            return $this->fail('아이디 또는 비밀번호가 올바르지 않습니다', 422);
        }
        $u = Auth::user();
        if (! $u->isActive() || ! $u->role_id) {
            Auth::guard('web')->logout();

            return $this->fail($u->status === 'pending' ? '가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다' : '사용할 수 없는 계정입니다. 관리자에게 문의하세요', 403, 'ACCOUNT_NOT_ACTIVE');
        }
        RateLimiter::clear($key);
        $r->session()->regenerate();
        $u->forceFill(['last_login_at' => now()])->saveQuietly();

        return $this->meData($u);
    }

    public function logout(Request $r)
    {
        Auth::guard('web')->logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function signup(Request $r)
    {
        $data = $r->validate([
            'name' => 'required|string|max:40',
            'username' => [...User::USERNAME_RULE, 'unique:users,username'],
            'email' => 'nullable|email|max:120|unique:users,email',
            'password' => 'required|string|min:8|max:100',
            'team' => 'nullable|string|max:40',
            'phone' => 'nullable|string|max:20',
        ]);
        $u = User::create($data + ['status' => 'pending', 'phone' => $this->phone($data['phone'] ?? null)]);
        Audit::log('user', $u->id, $u->name, 'create', '회원가입 신청', [['field' => '아이디', 'before' => '', 'after' => $u->username]]);

        return response()->json(['ok' => true, 'message' => '가입 신청을 보냈습니다. 관리자 승인 후 로그인할 수 있습니다'], 201);
    }

    public function me(Request $r)
    {
        $u = $r->user();
        if (! $u || ! $u->isActive() || ! $u->role_id) {
            return response()->json(['user' => null]);
        }

        return $this->meData($u);
    }

    public function changePassword(Request $r)
    {
        $data = $r->validate(['current' => 'required|string', 'password' => 'required|string|min:8|max:100']);
        if (! Auth::validate(['username' => $this->actor()->username, 'password' => $data['current']])) {
            return $this->fail('현재 비밀번호가 올바르지 않습니다');
        }
        $this->actor()->update(['password' => $data['password']]);

        return response()->json(['ok' => true]);
    }

    private function meData(User $u)
    {
        $u->load('role');

        return response()->json([
            'user' => $u->toPublic(),
            'perms' => Perm::of($u),
            'scope' => Perm::scope($u),
            'is_admin' => (bool) $u->role?->locked,
            'csrf' => csrf_token(),
        ]);
    }
}
