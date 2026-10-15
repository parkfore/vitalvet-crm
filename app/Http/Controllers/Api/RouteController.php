<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Store;
use Illuminate\Http\Request;

/** 오늘 동선: 사람마다 서버에 저장해 PC·휴대폰에서 같은 동선을 본다 */
class RouteController extends Controller
{
    public function __invoke(Request $r)
    {
        $date = (string) $r->input('date', '');
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $this->fail('날짜 형식이 올바르지 않습니다');
        }
        $ids = array_values(array_unique(array_filter(array_map('strval', array_slice((array) $r->input('ids', []), 0, 60)), fn ($x) => preg_match('/^VV-\d{4,}$/', $x))));
        $route = ['date' => $date, 'ids' => $ids, 'at' => now()->toIso8601ZuluString('millisecond')];
        Store::putSetting('route:'.$this->actor()->id, $route);

        return response()->json($route);
    }
}
