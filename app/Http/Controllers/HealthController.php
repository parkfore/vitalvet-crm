<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * 배포 점검용 상태 확인 API.
 *
 * 운영(production)에서는 정상/실패 여부만 알려주고,
 * 버전·오류 내용 같은 세부 정보는 로컬·디버그 환경에서만 보여준다.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $dbOk = true;
        $dbError = null;

        try {
            DB::select('select 1');
        } catch (Throwable $e) {
            $dbOk = false;
            $dbError = $e->getMessage();
        }

        $provider = config('services.maps.provider');
        $mapKeySet = match ($provider) {
            'naver' => filled(config('services.maps.naver.client_id')),
            default => filled(config('services.maps.kakao.js_key')),
        };

        $showDetail = app()->isLocal() || config('app.debug');

        return response()->json([
            'status' => $dbOk ? 'ok' : 'degraded',
            'app' => config('app.name'),
            'env' => app()->environment(),
            'time' => now()->format('Y-m-d H:i:s'),
            'timezone' => config('app.timezone'),
            'checks' => [
                'api' => true,
                'database' => $dbOk,
                'map_key' => $mapKeySet,
            ],
            'map_provider' => $provider,
            'detail' => $showDetail ? [
                'php' => PHP_VERSION,
                'laravel' => app()->version(),
                'db_connection' => config('database.default'),
                'db_error' => $dbError,
            ] : null,
        ], $dbOk ? 200 : 503);
    }
}
