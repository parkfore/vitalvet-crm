<?php

namespace App\Http\Middleware;

use App\Support\Store;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 데이터 버전: 저장·변경 요청이 성공할 때마다 버전을 바꾼다.
 * 화면은 /api/ping 으로 버전만 물어보고, 바뀌었을 때만 전체 자료를 다시 받는다.
 * 응답 머리글로 바뀌기 전·후 버전을 알려 주어, 내가 바꾼 것 때문에 다시 받는 일이 없게 한다.
 */
class DataVersion
{
    private const SKIP = ['api/ping', 'api/client-errors', 'api/auth/login', 'api/auth/logout', 'api/push/*', 'api/notif/test'];

    public function handle(Request $r, Closure $next): Response
    {
        $res = $next($r);
        if ($r->isMethod('GET') || $res->getStatusCode() >= 400 || $r->is(...self::SKIP)) {
            return $res;
        }
        try {
            $prev = (string) Store::setting('data_ver', '');
            $ver = base_convert((string) (int) (microtime(true) * 1000), 10, 36).bin2hex(random_bytes(2));
            Store::putSetting('data_ver', $ver);
            $res->headers->set('X-Data-Prev', $prev);
            $res->headers->set('X-Data-Ver', $ver);
        } catch (\Throwable) {
            // 버전 기록 실패는 무시 (다음 확인 때 다시 받는다)
        }

        return $res;
    }
}
