<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * 알림 (웹푸시)
 * - 관리자가 역할별 기본값을 정하고, 꼭 받아야 하는 알림은 '고정'(끌 수 없음)한다
 * - 각자 종류별 켜기·끄기, 전체 끄기, 아침 요약·저녁 알림 시간, 조용한 시간, 주말·공휴일 수신을 바꿀 수 있다
 * - 내 알림을 꺼도 내가 한 일은 관리자·팀장에게 그대로 알림이 간다 (받는 사람 기준으로만 거른다)
 * - 조용한 시간·주말에 생긴 알림은 모아 두었다가 조용한 시간이 끝나면 보낸다
 * - 모든 알림은 대기열(notif_queue)에 넣고, 요청이 끝난 뒤와 매분 예약 실행 때 보낸다
 */
class Notify
{
    public const TZ = 'Asia/Seoul';

    /** 이 거리(m) 안이면 현장 확인 (관리자 설정 · 기본 300m) */
    public static function radius(): int
    {
        return (int) (Store::settings()['checkinRadius'] ?? 300);
    }

    /** 종류 => [이름, 묶음, 설명] · 묶음: team(관리자·팀장이 받는 팀 소식) mine(내 일) brief(요약) */
    public const TYPES = [
        'report_submitted' => ['보고서 제출 (검토 요청)', 'team', '영업사원이 보고서를 제출하면'],
        'support_request' => ['지원 요청', 'team', '보고서에 지원 요청을 적어 제출하면'],
        'comp_info' => ['경쟁사 정보', 'team', '보고서에 경쟁사 동향을 적어 제출하면'],
        'stage_up' => ['영업 단계 상승', 'team', '병원이 다음 영업 단계로 올라가면'],
        'conversion' => ['회원가입·사용 시작', 'team', '병원이 회원가입하거나 VitalVET 사용을 시작하면'],
        'checkin' => ['현장 확인 (체크인)', 'team', '영업사원이 방문 기록에 현재 위치를 넣으면'],
        'checkin_issue' => ['방문 위치 이상', 'team', '방문 위치가 병원과 300m 넘게 떨어졌거나, 위치 없이 방문을 기록하거나, 수동 체크인하면'],
        'att_request' => ['근태 신청', 'team', '연차·외근 등 근태 승인 요청이 오면'],
        'signup_request' => ['가입 신청', 'team', '새 직원이 가입을 신청하면'],
        'sys_error' => ['새 오류 (관리자)', 'team', '서버나 화면에 새로운 오류가 생기면'],
        'report_returned' => ['보고서 반려', 'mine', '내 보고서가 반려되면'],
        'report_confirmed' => ['보고서 확인', 'mine', '내 보고서를 검토자가 확인하면'],
        'coaching' => ['코칭 메모', 'mine', '나에게 코칭 메모가 남겨지면'],
        'support_update' => ['내 지원 요청 변경', 'mine', '관리자·팀장이 내 지원 요청의 긴급도를 바꾸면'],
        'assigned' => ['담당 병원 배정', 'mine', '나에게 병원이 배정되면'],
        'att_result' => ['근태 승인·반려', 'mine', '내 근태 신청이 처리되면'],
        'morning' => ['아침 요약', 'brief', '오늘 팔로우업·지연·계약 만료 임박 (팀장·관리자는 팀 상황 포함)'],
        'evening' => ['저녁 알림', 'brief', '보고서 미제출 알림 (팀장·관리자는 오늘 팀 활동 요약)'],
    ];

    private const BASE = ['types' => [], 'morning' => '08:50', 'evening' => '18:30', 'quietOn' => true, 'quietFrom' => '21:00', 'quietTo' => '08:00', 'weekend' => false];

    private const OFF_BY_DEFAULT = ['report_confirmed'];

    private static bool $flushQueued = false;

    /* ---------------- 설정 ---------------- */

    /** 기본값: {roles:{역할id:{types,morning,evening,quietOn,quietFrom,quietTo,weekend}}, locked:{역할id:[종류]}} */
    public static function defaults(): array
    {
        $d = (array) Store::setting('notif_defaults', []);

        return ['roles' => (array) ($d['roles'] ?? []), 'locked' => (array) ($d['locked'] ?? [])];
    }

    public static function roleBase(?string $roleId): array
    {
        $types = [];
        foreach (self::TYPES as $k => $_) {
            $types[$k] = ! in_array($k, self::OFF_BY_DEFAULT, true);
        }
        $r = (array) (self::defaults()['roles'][$roleId ?? ''] ?? []);
        $o = array_merge(self::BASE, array_intersect_key($r, self::BASE));
        $o['types'] = array_merge($types, array_intersect_key((array) ($r['types'] ?? []), self::TYPES));

        return $o;
    }

    public static function locked(?string $roleId): array
    {
        return array_values(array_intersect(array_keys(self::TYPES), (array) (self::defaults()['locked'][$roleId ?? ''] ?? [])));
    }

    /** 개인 설정 (바꾼 것만): {off, types:{}, morning, evening, quietOn, quietFrom, quietTo, weekend, at} */
    public static function mine(string $uid): array
    {
        return (array) Store::setting('notif:'.$uid, []);
    }

    /** 최종 적용 값 */
    public static function effective(User $u): array
    {
        $base = self::roleBase($u->role_id);
        $m = self::mine($u->id);
        $lock = self::locked($u->role_id);
        $o = array_merge($base, array_intersect_key($m, self::BASE));
        $o['types'] = array_merge($base['types'], array_intersect_key((array) ($m['types'] ?? []), self::TYPES));
        $o['off'] = (bool) ($m['off'] ?? false);
        foreach ($o['types'] as $k => $v) {
            $o['types'][$k] = in_array($k, $lock, true) || (! $o['off'] && $v);
        }
        $o['locked'] = $lock;

        return $o;
    }

    public static function validTime($v): bool
    {
        return $v === '' || (is_string($v) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v));
    }

    /** 화면에서 받은 설정 정리 (모르는 값 제거). $partial: 개인 설정이면 없는 값은 '기본값 따름' */
    public static function clean(array $in, bool $personal): array
    {
        $o = [];
        foreach (['morning', 'evening', 'quietFrom', 'quietTo'] as $k) {
            if (array_key_exists($k, $in) && $in[$k] !== null && self::validTime($in[$k])) {
                $o[$k] = $in[$k];
            }
        }
        foreach (['quietOn', 'weekend'] as $k) {
            if (array_key_exists($k, $in) && $in[$k] !== null) {
                $o[$k] = (bool) $in[$k];
            }
        }
        $t = [];
        foreach ((array) ($in['types'] ?? []) as $k => $v) {
            if (isset(self::TYPES[$k]) && $v !== null) {
                $t[$k] = (bool) $v;
            }
        }
        $o['types'] = (object) $t;
        if ($personal && ! empty($in['off'])) {
            $o['off'] = true;
        }

        return $o;
    }

    /** 화면용 (state.notif) */
    public static function forState(User $u): array
    {
        $types = [];
        foreach (self::TYPES as $k => [$l, $g, $d]) {
            $types[] = ['key' => $k, 'label' => $l, 'group' => $g, 'desc' => $d];
        }

        return [
            'types' => $types, 'base' => self::roleBase($u->role_id), 'locked' => self::locked($u->role_id), 'mine' => (object) self::mine($u->id),
            'effective' => self::effective($u), 'vapid' => self::vapidSafe(), 'devices' => DB::table('push_subscriptions')->where('user_id', $u->id)->count(),
        ];
    }

    private static function vapidSafe(): string
    {
        try {
            return WebPush::publicKey();
        } catch (Throwable) {
            return '';
        }
    }

    /* ---------------- 받는 사람 ---------------- */

    /** @return User[] */
    private static function active(): array
    {
        static $c = null;

        return $c ??= User::where('status', 'active')->get()->all();
    }

    public static function reset(): void
    {
        // 테스트용
        self::$flushQueued = false;
    }

    /** 이 사람의 보고서·영업을 검토하는 사람 (관리자·팀장) */
    public static function managersOf(?string $uid): array
    {
        $rep = ['authorId' => $uid ?: '__none'];

        return array_values(array_map(fn ($u) => $u->id, array_filter(User::where('status', 'active')->get()->all(), fn ($u) => Perm::canReview($u, $rep))));
    }

    /** 이 사람의 근태를 승인하는 사람 (같은 팀 범위 안) */
    public static function attManagers(?string $uid = null): array
    {
        return User::where('status', 'active')->get()->filter(fn ($u) => Perm::attManager($u) && Perm::sameTeam($u, $uid))->pluck('id')->all();
    }

    public static function userManagers(): array
    {
        return User::where('status', 'active')->get()->filter(fn ($u) => Perm::can($u, 'users', 'update'))->pluck('id')->all();
    }

    public static function admins(): array
    {
        return User::where('status', 'active')->where('role_id', config('crm.admin_role'))->pluck('id')->all();
    }

    /* ---------------- 보내기 ---------------- */

    /**
     * 알림 만들기 (받는 사람마다 설정을 보고 대기열에 넣는다)
     *
     * @param  string[]  $to
     */
    public static function emit(string $type, array $to, string $title, string $body, string $url = '/', string $tag = '', ?string $exceptId = null): int
    {
        try {
            if (! isset(self::TYPES[$type])) {
                return 0;
            }
            $to = array_values(array_unique(array_filter($to, fn ($id) => $id && $id !== $exceptId)));
            if (! $to) {
                return 0;
            }
            $users = User::whereIn('id', $to)->where('status', 'active')->get();
            $now = now();
            $rows = [];
            foreach ($users as $u) {
                $p = self::effective($u);
                if (empty($p['types'][$type])) {
                    continue;
                }
                $rows[] = ['user_id' => $u->id, 'type' => $type, 'title' => mb_substr($title, 0, 120), 'body' => mb_substr($body, 0, 300), 'url' => mb_substr($url, 0, 200),
                    'tag' => mb_substr($tag ?: $type, 0, 60), 'created_at' => $now, 'send_after' => self::nextAllowed($now, $p)];
            }
            if ($rows) {
                DB::table('notif_queue')->insert($rows);
                self::flushLater();
            }

            return count($rows);
        } catch (Throwable $e) {
            ErrorLog::record('server', '알림 만들기 실패: '.$e->getMessage(), $e->getFile().':'.$e->getLine(), 'notify:'.$type);

            return 0;
        }
    }

    /** 요청 응답을 보낸 뒤 바로 보내기 (예약 실행이 없어도 바로 간다) */
    public static function flushLater(): void
    {
        if (self::$flushQueued || app()->runningUnitTests()) {
            return;
        }
        self::$flushQueued = true;
        app()->terminating(function () {
            self::$flushQueued = false;
            self::flush();
        });
    }

    public static function isOffDay(Carbon $d): bool
    {
        $hol = (array) Store::setting('holidays', config('crm.holidays'));

        return $d->isWeekend() || isset($hol[$d->toDateString()]);
    }

    /** 조용한 시간·주말을 피해 보낼 수 있는 가장 이른 때 (UTC 로 저장) */
    public static function nextAllowed(Carbon $nowUtc, array $p): Carbon
    {
        $t = $nowUtc->copy()->setTimezone(self::TZ);
        for ($i = 0; $i < 20; $i++) {
            if (! $p['weekend'] && self::isOffDay($t)) {
                $t = $t->copy()->addDay()->setTimeFromTimeString($p['quietOn'] ? $p['quietTo'] : '08:00');

                continue;
            }
            if ($p['quietOn'] && $p['quietFrom'] !== $p['quietTo'] && self::inQuiet($t->format('H:i'), $p['quietFrom'], $p['quietTo'])) {
                $end = $t->copy()->setTimeFromTimeString($p['quietTo']);
                if ($end->lte($t)) {
                    $end->addDay();
                }
                $t = $end;

                continue;
            }
            break;
        }

        return $t->setTimezone('UTC');
    }

    public static function inQuiet(string $hm, string $from, string $to): bool
    {
        return $from < $to ? ($hm >= $from && $hm < $to) : ($hm >= $from || $hm < $to);
    }

    /** 보낼 때가 된 알림 보내기. 사람마다 4건 이상 모였으면 한 번에 묶어서 보낸다 */
    public static function flush(int $limit = 300): int
    {
        try {
            $token = Str::random(16);
            $ids = DB::table('notif_queue')->whereNull('sent_at')->whereNull('claim')->where('send_after', '<=', now())->orderBy('id')->limit($limit)->pluck('id')->all();
            if (! $ids) {
                return 0;
            }
            DB::table('notif_queue')->whereIn('id', $ids)->whereNull('claim')->update(['claim' => $token]);
            $rows = DB::table('notif_queue')->where('claim', $token)->orderBy('id')->get()->groupBy('user_id');
            $sent = 0;
            foreach ($rows as $uid => $list) {
                $subs = DB::table('push_subscriptions')->where('user_id', $uid)->get();
                $result = 'nodevice';
                if ($subs->count()) {
                    $msgs = $list->count() > 3
                        ? [['title' => "새 알림 {$list->count()}건", 'body' => $list->take(3)->pluck('title')->implode(' · ').($list->count() > 3 ? ' 외' : ''), 'url' => '/today?notif=1', 'tag' => 'vv-batch']]
                        : $list->map(fn ($r) => ['title' => $r->title, 'body' => $r->body, 'url' => $r->url, 'tag' => $r->tag])->all();
                    $ok = 0;
                    foreach ($subs as $s) {
                        foreach ($msgs as $m) {
                            $st = self::sendOne($s, $m);
                            if ($st >= 200 && $st < 300) {
                                $ok++;
                            } elseif (in_array($st, [404, 410], true)) {
                                DB::table('push_subscriptions')->where('id', $s->id)->delete();
                                break;
                            }
                        }
                    }
                    $result = $ok ? 'sent' : 'failed';
                    $sent += $ok ? $list->count() : 0;
                }
                DB::table('notif_queue')->whereIn('id', $list->pluck('id'))->update(['sent_at' => now(), 'result' => $result]);
            }
            return $sent;
        } catch (Throwable $e) {
            ErrorLog::record('server', '알림 보내기 실패: '.$e->getMessage(), $e->getFile().':'.$e->getLine(), 'notify:flush');

            return 0;
        }
    }

    /** 받은 알림 보관 기간 */
    public const KEEP_DAYS = 15;

    public static function prune(): int
    {
        return DB::table('notif_queue')->where('created_at', '<', now()->subDays(self::KEEP_DAYS))->delete();
    }

    /** 내 알림 내역 (최근 15일) */
    public static function history(string $uid): array
    {
        return DB::table('notif_queue')->where('user_id', $uid)->where('created_at', '>=', now()->subDays(self::KEEP_DAYS))->orderByDesc('id')->limit(300)->get()
            ->map(fn ($r) => ['id' => $r->id, 'type' => $r->type, 'title' => $r->title, 'body' => $r->body, 'url' => $r->url,
                'at' => Carbon::parse($r->created_at)->toIso8601ZuluString(), 'sendAfter' => Carbon::parse($r->send_after)->toIso8601ZuluString(),
                'sentAt' => $r->sent_at ? Carbon::parse($r->sent_at)->toIso8601ZuluString() : null, 'result' => $r->result])->all();
    }

    public static function sendOne(object $s, array $m): int
    {
        try {
            $st = WebPush::send(['endpoint' => $s->endpoint, 'p256dh' => $s->p256dh, 'auth' => $s->auth], $m);
        } catch (Throwable $e) {
            $st = 0;
            ErrorLog::record('server', '웹푸시 전송 실패: '.mb_substr($e->getMessage(), 0, 200), parse_url($s->endpoint, PHP_URL_HOST) ?: '', 'webpush:'.(parse_url($s->endpoint, PHP_URL_HOST) ?: ''));
        }
        if ($st >= 200 && $st < 300) {
            DB::table('push_subscriptions')->where('id', $s->id)->update(['last_ok_at' => now()]);
        } elseif ($st >= 400 && ! in_array($st, [404, 410], true)) {
            ErrorLog::record('server', "웹푸시 거절 ($st)", parse_url($s->endpoint, PHP_URL_HOST) ?: '', 'webpush-status:'.$st.(parse_url($s->endpoint, PHP_URL_HOST) ?: ''));
        }

        return $st;
    }

    /* ---------------- 아침 요약 · 저녁 알림 ---------------- */

    /** 매분: 정해 둔 시간이 된 사람에게 요약 보내기 (기기를 등록한 사람만) */
    public static function briefs(?Carbon $nowUtc = null): int
    {
        $nowUtc ??= now();
        $local = $nowUtc->copy()->setTimezone(self::TZ);
        $hm = $local->format('H:i');
        $date = $local->toDateString();
        $uids = DB::table('push_subscriptions')->distinct()->pluck('user_id')->all();
        $n = 0;
        $ctx = null;
        foreach (User::whereIn('id', $uids)->where('status', 'active')->get() as $u) {
            $p = self::effective($u);
            if (! $p['weekend'] && self::isOffDay($local)) {
                continue;
            }
            $mark = (array) Store::setting('brief:'.$u->id, []);
            foreach (['morning', 'evening'] as $kind) {
                $at = (string) $p[$kind];
                // 보낸 표시는 '날짜 + 정한 시각'으로 남긴다: 오늘 이미 보냈더라도 시각을 바꾸면 바꾼 시각에 다시 보낸다
                if (empty($p['types'][$kind]) || $at === '' || ($mark[$kind] ?? '') === "$date $at") {
                    continue;
                }
                // 정한 시각부터 30분 안에만 보낸다 (예약 실행이 잠시 멈췄다가 한참 뒤에 늦게 가는 일 방지)
                $atC = $local->copy()->setTimeFromTimeString($at);
                if ($local->lt($atC) || $local->gt($atC->copy()->addMinutes(30))) {
                    continue;
                }
                $ctx ??= self::context($local);
                $msg = ($kind === 'morning' ? self::morningFor($u, $ctx) : self::eveningFor($u, $ctx)) ?? self::emptyBrief($u, $kind, $ctx);
                $mark[$kind] = "$date $at";
                Store::putSetting('brief:'.$u->id, $mark);
                DB::table('notif_queue')->insert(['user_id' => $u->id, 'type' => $kind, 'title' => $msg[0], 'body' => mb_substr($msg[1], 0, 300), 'url' => $msg[2],
                    'tag' => 'vv-'.$kind, 'created_at' => now(), 'send_after' => now()]);
                $n++;
            }
        }

        return $n;
    }

    /** 알릴 내용이 없을 때도 요약이 왔다는 것을 알 수 있게 짧게 보낸다 */
    private static function emptyBrief(User $u, string $kind, array $ctx): array
    {
        if ($kind === 'morning') {
            return ['☀️ 오늘 요약', '오늘 예정된 팔로우업이나 지연된 일이 없습니다. 좋은 하루 보내세요!', '/today'];
        }
        $done = self::submitted($ctx, $u->id, $ctx['today']);

        return ['🌙 저녁 알림', $done ? '오늘 보고서 제출 완료 · 수고하셨습니다!' : '오늘 하루도 수고하셨습니다', $done ? '/report' : '/today'];
    }

    /** 요약 계산에 쓸 자료 (한 번만 읽는다) */
    private static function context(Carbon $local): array
    {
        $H = array_values(array_filter(Store::all('hospitals'), fn ($h) => empty($h['deletedAt'])));
        $reps = array_values(array_filter(User::where('status', 'active')->get()->all(), fn ($u) => Perm::canRep($u, 'create') && $u->role_id !== config('crm.admin_role')));
        $today = $local->toDateString();
        $prev = $local->copy()->subDay();
        for ($i = 0; $i < 10 && self::isOffDay($prev); $i++) {
            $prev->subDay();
        }
        $repsBy = DB::table('reports')->whereIn('date', [$today, $prev->toDateString()])->get(['author_id', 'date', 'data'])
            ->map(fn ($r) => ['a' => $r->author_id, 'd' => $r->date, 's' => (json_decode($r->data, true)['status'] ?? '')])->all();

        return ['H' => $H, 'reps' => $reps, 'today' => $today, 'prev' => $prev->toDateString(), 'reports' => $repsBy, 'off' => self::isOffDay($local)];
    }

    private static function submitted(array $ctx, string $uid, string $date): bool
    {
        foreach ($ctx['reports'] as $r) {
            if ($r['a'] === $uid && $r['d'] === $date && in_array($r['s'], ['submitted', 'confirmed'], true)) {
                return true;
            }
        }

        return false;
    }

    /** 내가 검토하는 영업사원들 */
    private static function team(User $u, array $ctx): array
    {
        return array_values(array_filter($ctx['reps'], fn ($r) => Perm::canReview($u, ['authorId' => $r->id])));
    }

    /** @return array{0:string,1:string,2:string}|null */
    public static function morningFor(User $u, array $ctx): ?array
    {
        $t = $ctx['today'];
        $parts = [];
        if (Perm::can($u, 'activity', 'read')) {
            $mine = array_filter($ctx['H'], fn ($h) => ($h['ownerId'] ?? '') === $u->id);
            $due = array_filter($mine, fn ($h) => ! empty($h['next']['date']) && empty($h['next']['done']) && $h['next']['date'] <= $t);
            $over = array_filter($due, fn ($h) => $h['next']['date'] < $t);
            $comp = array_filter($mine, function ($h) use ($t) {
                if (empty($h['compUntil']) || ($h['bizStatus'] ?? '') === '폐업') {
                    return false;
                }
                $d = (int) round((strtotime($h['compUntil']) - strtotime($t)) / 86400);

                return $d <= 14 && $d >= -14;
            });
            if ($due) {
                $parts[] = '오늘 할 팔로우업 '.number_format(count($due)).'곳'.($over ? ' (지연 '.number_format(count($over)).')' : '');
            }
            if ($comp) {
                $parts[] = '계약 만료 임박 '.number_format(count($comp)).'곳';
            }
        }
        $team = self::team($u, $ctx);
        if ($team) {
            $miss = array_filter($team, fn ($r) => ! self::submitted($ctx, $r->id, $ctx['prev']));
            if ($miss) {
                $parts[] = '전 영업일 보고서 미제출 '.number_format(count($miss)).'명 ('.implode(', ', array_map(fn ($r) => $r->name(), array_slice($miss, 0, 3))).(count($miss) > 3 ? ' 외' : '').')';
            }
            $ids = array_map(fn ($r) => $r->id, $team);
            $over = array_filter($ctx['H'], fn ($h) => in_array($h['ownerId'] ?? '', $ids, true) && ! empty($h['next']['date']) && empty($h['next']['done']) && $h['next']['date'] < $t);
            if ($over) {
                $parts[] = '팀 팔로우업 지연 '.number_format(count($over)).'곳';
            }
        }

        return $parts ? ['☀️ 오늘 요약', implode(' · ', $parts), '/today'] : null;
    }

    /** @return array{0:string,1:string,2:string}|null */
    public static function eveningFor(User $u, array $ctx): ?array
    {
        $t = $ctx['today'];
        $parts = [];
        $url = '/report';
        if (Perm::canRep($u, 'create') && $u->role_id !== config('crm.admin_role') && ! $ctx['off'] && ! self::submitted($ctx, $u->id, $t)) {
            $parts[] = '오늘 보고서를 아직 제출하지 않았어요';
        }
        $team = self::team($u, $ctx);
        if ($team) {
            $ids = array_map(fn ($r) => $r->id, $team);
            $visit = $call = $ok = $far = $nogeo = $manual = 0;
            $lim = self::radius();
            foreach ($ctx['H'] as $h) {
                $seen = [];
                foreach ((array) ($h['activities'] ?? []) as $a) {
                    if (($a['date'] ?? '') !== $t || ! in_array($a['authorId'] ?? '', $ids, true)) {
                        continue;
                    }
                    if (($a['type'] ?? '') === '방문') {
                        $g = $a['geo'] ?? null;
                        if (! is_array($g)) {
                            is_array($a['manual'] ?? null) ? $manual++ : $nogeo++;
                        } elseif (isset($g['dist']) && $g['dist'] > $lim) {
                            $far++;
                        } else {
                            $ok++;
                        }
                        if (! isset($seen[$a['authorId']])) {
                            $seen[$a['authorId']] = true;
                            $visit++;
                        }
                    } elseif (($a['type'] ?? '') === '통화') {
                        $call++;
                    }
                }
            }
            $new = count(array_filter($ctx['H'], fn ($h) => str_starts_with((string) ($h['createdAt'] ?? ''), $t) && in_array($h['createdBy'] ?? '', $ids, true)));
            $sub = count(array_filter($team, fn ($r) => self::submitted($ctx, $r->id, $t)));
            $parts[] = '오늘 팀 방문 '.number_format($visit).'건'.($visit ? ' (현장 확인 '.number_format($ok).($far ? ' · 위치 멂 '.number_format($far) : '').($manual ? ' · 수동 '.number_format($manual) : '').($nogeo ? ' · 위치 없음 '.number_format($nogeo) : '').')' : '')
                .' · 통화 '.number_format($call).'건'.($new ? ' · 신규 병원 '.number_format($new).'곳' : '').' · 보고서 제출 '.number_format($sub).'/'.number_format(count($team)).'명';
            $url = '/map?track=1';
        }

        return $parts ? ['🌙 저녁 알림', implode(' · ', $parts), $url] : null;
    }
}
