<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** 나에게 남긴 코칭 메모 '확인함' 표시 (메모를 남긴 사람이 팀 성과에서 볼 수 있다) */
class CoachingReadController extends Controller
{
    public function __invoke(Request $r)
    {
        $me = $this->actor();
        $ids = array_slice(array_map('strval', (array) $r->input('ids', [])), 0, 200);
        $at = now()->toIso8601ZuluString('millisecond');
        $n = 0;
        foreach (DB::table('coaching')->whereIn('id', $ids)->where('user_id', $me->id)->get() as $row) {
            $c = Store::decode($row);
            if (empty($c['readAt'])) {
                $c['readAt'] = $at;
                Store::put('coaching', $c);
                $n++;
            }
        }

        return response()->json(['read' => $n, 'at' => $at]);
    }
}
