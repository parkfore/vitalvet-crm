<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * 접속·이용 기록
 * login · login_fail · logout · signup · password · password_reset · open(앱 열기, 하루 한 번) · import · backup · backup_download
 */
class AccessLog
{
    public const EVENTS = [
        'login' => '로그인', 'login_fail' => '로그인 실패', 'logout' => '로그아웃', 'signup' => '가입 신청', 'password' => '비밀번호 변경',
        'password_reset' => '비밀번호 초기화', 'open' => '앱 열기', 'import' => '병원 가져오기', 'backup' => '백업 만들기', 'backup_download' => '백업 내려받기',
    ];

    public static function log(string $event, ?User $u = null, string $detail = '', ?string $username = null): void
    {
        try {
            $r = request();
            DB::table('access_logs')->insert([
                'created_at' => now(), 'user_id' => $u?->id, 'username' => mb_substr((string) ($u?->username ?? $username ?? ''), 0, 40) ?: null,
                'name' => $u ? mb_substr($u->name(), 0, 60) : null, 'event' => $event, 'detail' => mb_substr($detail, 0, 300) ?: null,
                'ip' => $r?->ip(), 'ua' => mb_substr((string) $r?->userAgent(), 0, 255) ?: null,
            ]);
        } catch (\Throwable) {
            // 기록 실패가 본 작업을 막지 않도록
        }
    }

    /** 같은 사람·같은 내용은 $minutes 안에 한 번만 (앱 열기) */
    public static function once(string $event, User $u, string $detail, int $minutes): void
    {
        $dup = DB::table('access_logs')->where('user_id', $u->id)->where('event', $event)->where('detail', $detail)
            ->where('created_at', '>=', now()->subMinutes($minutes))->exists();
        if (! $dup) {
            self::log($event, $u, $detail);
        }
    }

    public static function prune(int $days = 365): int
    {
        return DB::table('access_logs')->where('created_at', '<', now()->subDays($days))->delete();
    }
}
