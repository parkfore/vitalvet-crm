<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Store;
use Illuminate\Http\Request;

/** 내 영업 맵: 지도 필터 조합을 이름 붙여 저장 (사람마다 따로) */
class MapViewController extends Controller
{
    public function __invoke(Request $r)
    {
        $views = [];
        foreach (array_slice((array) $r->input('views', []), 0, 30) as $v) {
            $v = (array) $v;
            $name = mb_substr(trim((string) ($v['name'] ?? '')), 0, 40);
            if ($name === '' || ! preg_match('/^[A-Za-z0-9_\-]{1,40}$/', (string) ($v['id'] ?? ''))) {
                continue;
            }
            $f = (array) ($v['f'] ?? []);
            $list = fn ($k) => array_values(array_slice(array_map(fn ($x) => mb_substr((string) $x, 0, 60), array_filter((array) ($f[$k] ?? []), 'is_scalar')), 0, 50));
            $str = fn ($k) => mb_substr(is_scalar($f[$k] ?? null) ? (string) $f[$k] : '', 0, 60);
            $views[] = ['id' => (string) $v['id'], 'name' => $name, 'f' => [
                'cats' => $list('cats'), 'stages' => $list('stages'), 'biz' => $list('biz'), 'sido' => $str('sido'), 'sigungu' => $str('sigungu'),
                'owner' => $str('owner'), 'info' => $str('info'), 'grade' => $str('grade'),
            ]];
        }
        Store::putSetting('mapviews:'.$this->actor()->id, $views);

        return response()->json(['views' => $views]);
    }
}
