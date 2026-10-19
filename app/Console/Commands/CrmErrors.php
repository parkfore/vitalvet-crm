<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** 최근 오류 요약 (서버 점검용). 오류가 있으면 실패(1)로 끝나 GitHub 이 메일로 알려 준다 */
class CrmErrors extends Command
{
    protected $signature = 'crm:errors {--hours=24}';

    protected $description = '최근 오류 기록 요약 (있으면 종료 코드 1)';

    public function handle(): int
    {
        $h = max(1, (int) $this->option('hours'));
        $rows = DB::table('error_logs')->where('last_at', '>=', now()->subHours($h))->orderByDesc('count')->limit(30)->get();
        if ($rows->isEmpty()) {
            $this->info("최근 {$h}시간 오류 없음");

            return self::SUCCESS;
        }
        $this->line("최근 {$h}시간 오류 {$rows->count()}종류");
        foreach ($rows as $r) {
            $this->line("- [{$r->source}] {$r->count}회 · ".mb_substr($r->message, 0, 160).($r->url ? " · {$r->url}" : '').($r->user_name ? " · {$r->user_name}" : ''));
        }

        return self::FAILURE;
    }
}
