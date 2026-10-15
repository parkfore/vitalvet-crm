<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AccessLog;
use App\Support\Backup;
use App\Support\Store;

/** 화면 첫 로딩·새로고침용 전체 데이터 (로그인한 사람이 볼 수 있는 것만) */
class StateController extends Controller
{
    public function __invoke()
    {
        $me = $this->actor();
        AccessLog::once('open', $me, '', 1440); // 하루 한 번만
        // 하루 한 번 자동 백업 (서버 cron 이 없어도 되도록, 응답을 보낸 뒤에)
        app()->terminating(fn () => Backup::autoIfDue());

        return response()->json(Store::state($me));
    }
}
