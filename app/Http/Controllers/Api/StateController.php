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
        $by = session('imp_by');
        if (! $by) {
            AccessLog::once('open', $me, '', 1440); // 하루 한 번만 (다른 사용자로 보는 중에는 남기지 않음)
        }
        // 하루 한 번 자동 백업 (서버 cron 이 없어도 되도록, 응답을 보낸 뒤에)
        app()->terminating(fn () => Backup::autoIfDue());

        $st = Store::state($me);
        // 대표 관리자가 다른 사용자로 보는 중 (보기 전용) · 대표 관리자인지
        $admin = $by ? \App\Models\User::find($by) : null;
        $st['viewAs'] = $admin ? ['by' => $admin->id, 'name' => $admin->name()] : null;
        $st['canViewAs'] = ! $by && $me->username === AuthController::MAIN_ADMIN && $me->role_id === config('crm.admin_role');

        return response()->json($st);
    }
}
