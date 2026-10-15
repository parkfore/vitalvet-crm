<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AccessLog;
use Illuminate\Http\Request;

/** 메뉴 이용 기록 (같은 메뉴는 10분에 한 번만) */
class VisitController extends Controller
{
    private const VIEWS = ['today' => '오늘 할 일', 'dash' => '대시보드', 'list' => '병원 관리', 'map' => '지도', 'report' => '영업 보고', 'team' => '팀 성과',
        'attend' => '근태 일정', 'cat' => '카테고리', 'comp' => '경쟁사', 'history' => '변경 이력', 'users' => '사용자·권한', 'settings' => '설정'];

    public function __invoke(Request $r)
    {
        $v = (string) $r->input('view', '');
        if (isset(self::VIEWS[$v])) {
            AccessLog::once('view', $this->actor(), self::VIEWS[$v], 10);
        }

        return response()->json(['ok' => true]);
    }
}
