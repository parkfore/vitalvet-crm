<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// 매일 새벽 3시 자동 백업 (서버 cron 에 schedule:run 이 등록돼 있을 때).
// cron 이 없어도 하루 첫 접속 때 자동으로 백업한다 (App\Support\Backup::autoIfDue).
Illuminate\Support\Facades\Schedule::command('crm:backup')->dailyAt('03:00')->timezone('Asia/Seoul')->withoutOverlapping();
// 서버 예약 실행(cron)이 살아 있는지 관리자 화면에 보여 주기 위한 표시
Illuminate\Support\Facades\Schedule::call(fn () => App\Support\Store::putSetting('schedule_ping', now()->toIso8601ZuluString()))->hourly();
