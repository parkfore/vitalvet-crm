<?php

namespace App\Console\Commands;

use App\Support\Notify;
use Illuminate\Console\Command;

/** 매분: 아침 요약·저녁 알림 만들기 + 보낼 때가 된 알림 보내기 (조용한 시간에 모아 둔 것 포함) */
class CrmNotify extends Command
{
    protected $signature = 'crm:notify';

    protected $description = '알림 보내기 (매분 예약 실행)';

    public function handle(): int
    {
        $b = Notify::briefs();
        $s = Notify::flush();
        if ($b || $s) {
            $this->info("요약 {$b}건 · 보냄 {$s}건");
        }

        return self::SUCCESS;
    }
}
