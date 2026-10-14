<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Store;

/** 화면 첫 로딩·새로고침용 전체 데이터 (로그인한 사람이 볼 수 있는 것만) */
class StateController extends Controller
{
    public function __invoke()
    {
        return response()->json(Store::state($this->actor()));
    }
}
