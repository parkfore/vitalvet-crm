<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 역할에 '수동 체크인 허용' 추가 (현재 위치로 체크인하지 못한 방문에 방문 시각을 직접 넣기)
 * 처음 값: 관리자·영업팀장·영업사원은 허용, 그 밖의 역할은 꺼 둠 (관리자가 사용자·권한 › 역할에서 바꿀 수 있음)
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('roles')->get() as $r) {
            $d = json_decode($r->data, true) ?: [];
            if (array_key_exists('manualCheckin', $d)) {
                continue;
            }
            $d['manualCheckin'] = in_array($r->id, [config('crm.admin_role'), 'r_lead', 'r_sales'], true);
            DB::table('roles')->where('id', $r->id)->update(['data' => json_encode($d, JSON_UNESCAPED_UNICODE)]);
        }
    }

    public function down(): void
    {
    }
};
