<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** 로그인 중에 비활성·승인 대기로 바뀐 사용자는 즉시 로그아웃 */
class EnsureActiveUser
{
    public function handle(Request $request, Closure $next)
    {
        $u = $request->user();
        if (! $u) {
            return response()->json(['code' => 'UNAUTHENTICATED', 'message' => '로그인이 필요합니다'], 401);
        }
        if (! $u->isActive() || ! $u->role_id) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();

            return response()->json(['code' => 'ACCOUNT_NOT_ACTIVE', 'message' => '사용할 수 없는 계정입니다. 관리자에게 문의하세요'], 401);
        }

        return $next($request);
    }
}
