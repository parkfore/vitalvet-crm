<?php

namespace App\Support;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/** 오류 기록: 같은 오류(종류+위치+메시지)는 횟수만 늘린다. 기록하다 실패해도 앱은 멈추지 않는다 */
class ErrorLog
{
    private static bool $busy = false;

    private static ?bool $ready = null;

    public static function server(Throwable $e): void
    {
        // 명령어 오타 등 콘솔 입력 오류는 제외
        if ($e instanceof \Symfony\Component\Console\Exception\ExceptionInterface) {
            return;
        }
        $file = str_replace(base_path().DIRECTORY_SEPARATOR, '', $e->getFile());
        $msg = class_basename($e).': '.$e->getMessage();
        $trace = collect($e->getTrace())->take(8)->map(fn ($f) => ($f['file'] ?? '') ? str_replace(base_path().DIRECTORY_SEPARATOR, '', $f['file']).':'.($f['line'] ?? '') : ($f['class'] ?? '').($f['type'] ?? '').($f['function'] ?? ''))->implode("\n");
        $req = app()->runningInConsole() ? 'artisan '.implode(' ', array_slice($_SERVER['argv'] ?? [], 1, 3)) : request()->method().' '.request()->path();
        self::record('server', $msg, "$file:{$e->getLine()}\n$trace", $req, get_class($e).$file.$e->getLine());
    }

    /** @param string $key 같은 오류로 묶을 기준 (없으면 메시지) */
    public static function record(string $source, string $message, string $detail = '', string $url = '', string $key = ''): void
    {
        if (self::$busy) {
            return;
        }
        self::$busy = true;
        try {
            self::$ready ??= Schema::hasTable('error_logs');
            if (! self::$ready) {
                return;
            }
            $message = mb_substr(trim($message) ?: '(내용 없음)', 0, 500);
            // 숫자·id 가 달라도 같은 오류로 묶는다
            $norm = preg_replace('/\d+/', '#', $source.'|'.($key ?: $message));
            $fp = hash('sha256', $norm);
            $u = Auth::user();
            $now = now();
            $n = DB::table('error_logs')->where('fingerprint', $fp)->increment('count', 1, [
                'last_at' => $now, 'message' => $message, 'detail' => mb_substr($detail, 0, 4000), 'url' => mb_substr($url, 0, 300),
                'user_id' => $u?->id, 'user_name' => $u ? mb_substr($u->name(), 0, 60) : null,
            ]);
            if (! $n) {
                $new = DB::table('error_logs')->insertOrIgnore([
                    'fingerprint' => $fp, 'source' => $source, 'message' => $message, 'detail' => mb_substr($detail, 0, 4000), 'url' => mb_substr($url, 0, 300),
                    'user_id' => $u?->id, 'user_name' => $u ? mb_substr($u->name(), 0, 60) : null, 'count' => 1, 'first_at' => $now, 'last_at' => $now,
                ]);
                // 처음 보는 오류면 관리자에게 알림 (알림 기능 자체의 오류는 제외 - 되풀이 방지)
                if ($new && ! str_starts_with($key, 'notify') && ! str_starts_with($key, 'webpush')) {
                    Notify::emit('sys_error', Notify::admins(), '⚠️ 새 오류 ('.($source === 'server' ? '서버' : '화면').')', mb_substr($message, 0, 120), '/users?tab=errors', 'err');
                }
            }
            // 오래된 기록 정리 (90일)
            if (random_int(1, 50) === 1) {
                DB::table('error_logs')->where('last_at', '<', $now->copy()->subDays(90))->delete();
            }
        } catch (Throwable) {
            // 기록 실패는 무시 (DB 가 멈췄을 때 등)
        } finally {
            self::$busy = false;
        }
    }

    public static function recentCount(int $hours = 24): int
    {
        try {
            return (int) DB::table('error_logs')->where('last_at', '>=', now()->subHours($hours))->count();
        } catch (Throwable) {
            return 0;
        }
    }
}
