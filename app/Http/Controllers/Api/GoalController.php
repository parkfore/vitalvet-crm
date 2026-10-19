<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Perm;
use App\Support\Store;
use App\Support\Sync;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** 월 목표 (방문·회원가입·사용 전환): 기본값 + 사람별 */
class GoalController extends Controller
{
    private const KEYS = ['visits', 'signups', 'uses'];

    public function __invoke(Request $r)
    {
        $me = $this->actor();
        if (! Perm::can($me, 'team', 'update')) {
            return $this->fail('목표를 정할 권한이 없습니다 (팀 성과 수정 권한)', 403, 'FORBIDDEN');
        }
        $clean = function ($g, bool $partial) {
            $o = [];
            foreach (self::KEYS as $k) {
                $v = $g[$k] ?? null;
                if ($v === null || $v === '') {
                    if (! $partial) {
                        $o[$k] = 0;
                    }

                    continue;
                }
                $o[$k] = max(0, min(100000, (int) $v));
            }

            return $o;
        };
        $users = [];
        $ids = DB::table('users')->pluck('id')->flip();
        foreach ((array) $r->input('users', []) as $uid => $g) {
            if (isset($ids[$uid]) && ($c = $clean((array) $g, true))) {
                $users[(string) $uid] = $c;
            }
        }
        $new = ['default' => $clean((array) $r->input('default', []), false), 'users' => (object) $users];
        Store::putSetting('goals', $new);
        Sync::log($me, ['entity' => 'settings', 'entityId' => 'goals', 'targetName' => '월 목표', 'action' => 'update', 'section' => '팀 성과',
            'changes' => [['field' => '기본 목표', 'before' => '', 'after' => "방문 {$new['default']['visits']} · 가입 {$new['default']['signups']} · 사용 {$new['default']['uses']}"]],
            'summary' => count($users) ? '사람별 목표 '.count($users).'명' : '']);

        return response()->json($new);
    }
}
