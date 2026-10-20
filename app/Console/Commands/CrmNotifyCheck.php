<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Notify;
use App\Support\Store;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** 알림 점검: 예약 실행 상태, 사람별 알림 설정·기기·오늘 요약 발송 여부 (데이터는 바꾸지 않는다) */
class CrmNotifyCheck extends Command
{
    protected $signature = 'crm:notify-check';

    protected $description = '알림 점검';

    public function handle(): int
    {
        $now = now()->setTimezone(Notify::TZ);
        $this->line('지금(한국) '.$now->format('Y-m-d H:i:s').' · 쉬는 날 '.(Notify::isOffDay($now) ? '예' : '아니오'));
        $this->line('마지막 예약 실행 표시(schedule_ping): '.json_encode(Store::setting('schedule_ping')));
        $this->line('마지막 crm:notify 실행: '.json_encode(Store::setting('notify_ping')));
        $this->line('대기 중 알림: '.DB::table('notif_queue')->whereNull('sent_at')->count().'건 · 가장 이른 발송 예정 '.DB::table('notif_queue')->whereNull('sent_at')->min('send_after'));
        $dev = DB::table('push_subscriptions')->get()->groupBy('user_id');
        foreach (User::where('status', 'active')->get() as $u) {
            $p = Notify::effective($u);
            $d = $dev[$u->id] ?? collect();
            $this->line(sprintf('%s(%s) 기기 %d대%s | 전체끔 %s | 아침 %s %s | 저녁 %s %s | 조용 %s %s~%s | 주말 %s | 오늘표시 %s',
                $u->name(), $u->id, $d->count(), $d->count() ? ' ['.$d->map(fn ($x) => parse_url($x->endpoint, PHP_URL_HOST).($x->last_ok_at ? ' ok '.$x->last_ok_at : ' 성공 기록 없음'))->implode(', ').']' : '',
                $p['off'] ? '예' : '아니오', $p['morning'] ?: '-', empty($p['types']['morning']) ? '(끔)' : '', $p['evening'] ?: '-', empty($p['types']['evening']) ? '(끔)' : '',
                $p['quietOn'] ? '켬' : '끔', $p['quietFrom'], $p['quietTo'], $p['weekend'] ? '받음' : '안 받음', json_encode(Store::setting('brief:'.$u->id))));
        }
        foreach (DB::table('notif_queue')->whereIn('type', ['morning', 'evening'])->orderByDesc('id')->limit(10)->get() as $r) {
            $this->line("요약 기록: {$r->created_at} {$r->user_id} {$r->type} ".($r->result ?? '대기').' '.mb_substr($r->body ?? '', 0, 80));
        }

        return self::SUCCESS;
    }
}
