<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** 대표 관리자가 다른 사용자로 보는 중에는 보기 전용: 저장·변경 요청을 막는다 (돌아가기·로그아웃·오류 보고만 허용) */
class ViewOnlyWhenImpersonating
{
    private const ALLOW = ['api/auth/impersonate/stop', 'api/auth/logout', 'api/client-errors'];

    public function handle(Request $request, Closure $next)
    {
        if ($request->hasSession() && $request->session()->has('imp_by') && ! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true) && ! $request->is(...self::ALLOW)) {
            return response()->json(['code' => 'VIEW_ONLY', 'message' => '다른 사용자로 보는 중에는 저장·변경할 수 없습니다 (보기 전용)'], 403);
        }

        return $next($request);
    }
}
