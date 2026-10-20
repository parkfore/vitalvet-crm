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
        \App\Support\Store::putSetting('notify_ping', now()->toIso8601ZuluString());
        $b = Notify::briefs();
        $s = Notify::flush();
        // 받은 알림은 15일 보관 (한 시간에 한 번 정리)
        if ((int) now()->format('i') === 7) {
            Notify::prune();
        }
        if ($b || $s) {
            $this->info("요약 {$b}건 · 보냄 {$s}건");
        }

        return self::SUCCESS;
    }
}
