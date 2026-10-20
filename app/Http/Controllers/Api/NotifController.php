<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Notify;
use App\Support\Perm;
use App\Support\Store;
use App\Support\Sync;
use App\Support\WebPush;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** 알림: 기기 등록·해제·테스트, 내 알림 설정, 관리자 기본값·사람별 현황 */
class NotifController extends Controller
{
    private const FIELD = ['off' => '전체 알림', 'morning' => '아침 요약 시간', 'evening' => '저녁 알림 시간', 'quietOn' => '조용한 시간', 'quietFrom' => '조용한 시간 시작', 'quietTo' => '조용한 시간 끝', 'weekend' => '주말·공휴일 수신'];

    private function isAdmin(): bool
    {
        return $this->actor()->role_id === config('crm.admin_role');
    }

    public function subscribe(Request $r)
    {
        $me = $this->actor();
        $ep = (string) $r->input('endpoint', '');
        $p = (string) $r->input('keys.p256dh', '');
        $a = (string) $r->input('keys.auth', '');
        if (! preg_match('#^https://[^\s]{10,1000}$#', $ep) || strlen($p) < 80 || strlen($p) > 120 || strlen($a) < 16 || strlen($a) > 60) {
            return $this->fail('알림 기기 정보가 올바르지 않습니다');
        }
        DB::table('push_subscriptions')->updateOrInsert(['endpoint_hash' => hash('sha256', $ep)], [
            'user_id' => $me->id, 'endpoint' => $ep, 'p256dh' => $p, 'auth' => $a, 'ua' => mb_substr((string) $r->userAgent(), 0, 255), 'created_at' => now(),
        ]);
        // 한 사람 기기는 10대까지 (오래된 것부터 정리)
        $ids = DB::table('push_subscriptions')->where('user_id', $me->id)->orderByDesc('created_at')->pluck('id')->slice(10)->all();
        if ($ids) {
            DB::table('push_subscriptions')->whereIn('id', $ids)->delete();
        }

        return response()->json(['devices' => DB::table('push_subscriptions')->where('user_id', $me->id)->count()]);
    }

    public function unsubscribe(Request $r)
    {
        $me = $this->actor();
        DB::table('push_subscriptions')->where('user_id', $me->id)->where('endpoint_hash', hash('sha256', (string) $r->input('endpoint', '')))->delete();

        return response()->json(['devices' => DB::table('push_subscriptions')->where('user_id', $me->id)->count()]);
    }

    /** 테스트 알림: 내 기기 모두에 바로 보낸다 (조용한 시간과 상관없이) */
    public function test()
    {
        $me = $this->actor();
        $subs = DB::table('push_subscriptions')->where('user_id', $me->id)->get();
        if (! $subs->count()) {
            return $this->fail('알림을 받을 기기가 없습니다. 먼저 "이 기기에서 알림 받기"를 눌러 주세요');
        }
        $ok = 0;
        foreach ($subs as $s) {
            $st = Notify::sendOne($s, ['title' => '🔔 VitalVET 테스트 알림', 'body' => $me->name().'님, 이 기기에서 알림을 받을 수 있습니다.', 'url' => '/today', 'tag' => 'vv-test']);
            if ($st >= 200 && $st < 300) {
                $ok++;
            } elseif (in_array($st, [404, 410], true)) {
                DB::table('push_subscriptions')->where('id', $s->id)->delete();
            }
        }

        return response()->json(['ok' => $ok, 'total' => $subs->count()]);
    }

    /** 내 알림 설정 저장 (고정된 알림은 끌 수 없다) */
    public function saveMine(Request $r)
    {
        $me = $this->actor();
        $old = Notify::mine($me->id);
        $new = Notify::clean((array) $r->input('prefs', []), true);
        $lock = Notify::locked($me->role_id);
        $types = (array) $new['types'];
        foreach ($lock as $k) {
            unset($types[$k]);
        }
        $new['types'] = (object) $types;
        $new['at'] = now()->toIso8601ZuluString();
        Store::putSetting('notif:'.$me->id, $new);
        $this->logChanges($me, $me, $old, $new);

        return response()->json(['notif' => Notify::forState($me)]);
    }

    private function logChanges(User $actor, User $target, array $old, array $new): void
    {
        $ch = [];
        $fmt = fn ($v) => $v === null ? '기본값' : (is_bool($v) ? ($v ? '켬' : '끔') : ($v === '' ? '보내지 않음' : (string) $v));
        foreach (self::FIELD as $k => $l) {
            $b = $old[$k] ?? null;
            $a = $new[$k] ?? null;
            if ($k === 'off') {
                if (empty($b) !== empty($a)) {
                    $ch[] = ['field' => $l, 'before' => empty($b) ? '받음' : '모두 끔', 'after' => empty($a) ? '받음' : '모두 끔'];
                }

                continue;
            }
            if ($b !== $a) {
                $ch[] = ['field' => $l, 'before' => $fmt($b), 'after' => $fmt($a)];
            }
        }
        $ot = (array) ($old['types'] ?? []);
        $nt = (array) $new['types'];
        foreach (Notify::TYPES as $k => [$l]) {
            if (($ot[$k] ?? null) !== ($nt[$k] ?? null)) {
                $ch[] = ['field' => $l, 'before' => $fmt($ot[$k] ?? null), 'after' => $fmt($nt[$k] ?? null)];
            }
        }
        if ($ch) {
            Sync::log($actor, ['entity' => 'user', 'entityId' => $target->id, 'targetName' => $target->name(), 'action' => 'update', 'section' => '알림 설정', 'changes' => $ch]);
        }
    }

    /** 관리자: 역할별 기본값 + 사람별 현황 */
    public function admin()
    {
        if (! $this->isAdmin()) {
            return $this->fail('관리자만 볼 수 있습니다', 403, 'FORBIDDEN');
        }
        $dev = DB::table('push_subscriptions')->select('user_id', DB::raw('count(*) as n'), DB::raw('max(last_ok_at) as ok'))->groupBy('user_id')->get()->keyBy('user_id');
        $users = User::whereIn('status', ['active'])->get()->map(fn ($u) => [
            'id' => $u->id, 'name' => $u->name(), 'roleId' => $u->role_id, 'devices' => (int) ($dev[$u->id]->n ?? 0),
            'lastOk' => isset($dev[$u->id]->ok) ? \Illuminate\Support\Carbon::parse($dev[$u->id]->ok)->toIso8601ZuluString() : null,
            'mine' => (object) Notify::mine($u->id), 'effective' => Notify::effective($u),
        ])->values();
        $roles = [];
        foreach (Store::all('roles') as $r) {
            $roles[$r['id']] = ['base' => Notify::roleBase($r['id']), 'locked' => Notify::locked($r['id'])];
        }
        $recent = DB::table('notif_queue')->where('created_at', '>=', now()->subDays(7))->select('result', DB::raw('count(*) as n'))->groupBy('result')->pluck('n', 'result');

        return response()->json(['roles' => $roles, 'users' => $users, 'week' => $recent]);
    }

    /** 관리자: 역할별 기본값·고정 저장 */
    public function saveDefaults(Request $r)
    {
        if (! $this->isAdmin()) {
            return $this->fail('관리자만 바꿀 수 있습니다', 403, 'FORBIDDEN');
        }
        $me = $this->actor();
        $roleIds = array_column(Store::all('roles'), 'name', 'id');
        $old = Notify::defaults();
        $roles = [];
        $locked = [];
        foreach ((array) $r->input('roles', []) as $rid => $v) {
            if (isset($roleIds[$rid])) {
                $roles[$rid] = Notify::clean((array) $v, false);
            }
        }
        foreach ((array) $r->input('locked', []) as $rid => $v) {
            if (isset($roleIds[$rid])) {
                $locked[$rid] = array_values(array_intersect(array_keys(Notify::TYPES), (array) $v));
            }
        }
        Store::putSetting('notif_defaults', ['roles' => (object) $roles, 'locked' => (object) $locked]);
        $ch = [];
        foreach ($roleIds as $rid => $name) {
            $b = Notify::roleBase($rid);
            $bo = json_encode([(array) ($old['roles'][$rid] ?? []), (array) ($old['locked'][$rid] ?? [])]);
            $bn = json_encode([(array) json_decode(json_encode($roles[$rid] ?? []), true), $locked[$rid] ?? []]);
            if ($bo !== $bn) {
                $off = array_keys(array_filter($b['types'], fn ($x) => ! $x));
                $ch[] = ['field' => $name, 'before' => '', 'after' => '아침 '.($b['morning'] ?: '없음').' · 저녁 '.($b['evening'] ?: '없음').' · 조용한 시간 '.($b['quietOn'] ? "{$b['quietFrom']}~{$b['quietTo']}" : '없음')
                    .' · 주말 '.($b['weekend'] ? '받음' : '안 받음').($off ? ' · 끔: '.implode(', ', array_map(fn ($k) => Notify::TYPES[$k][0], $off)) : '')
                    .(! empty($locked[$rid]) ? ' · 고정: '.implode(', ', array_map(fn ($k) => Notify::TYPES[$k][0], $locked[$rid])) : '')];
            }
        }
        if ($ch) {
            Sync::log($me, ['entity' => 'settings', 'entityId' => 'notif', 'targetName' => '알림 기본값', 'action' => 'update', 'section' => '알림 설정', 'changes' => $ch]);
        }

        return $this->admin();
    }
}
