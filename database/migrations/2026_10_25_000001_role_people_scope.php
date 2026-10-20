<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** 역할에 '사람 자료 범위' 추가: 관리자는 전체, 나머지 역할은 같은 팀(소속)만 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('roles')->get() as $r) {
            $d = json_decode($r->data, true) ?: [];
            if (isset($d['people'])) {
                continue;
            }
            $d['people'] = $r->id === config('crm.admin_role') ? 'all' : 'team';
            DB::table('roles')->where('id', $r->id)->update(['data' => json_encode($d, JSON_UNESCAPED_UNICODE)]);
        }
    }

    public function down(): void
    {
        foreach (DB::table('roles')->get() as $r) {
            $d = json_decode($r->data, true) ?: [];
            unset($d['people']);
            DB::table('roles')->where('id', $r->id)->update(['data' => json_encode($d, JSON_UNESCAPED_UNICODE)]);
        }
    }
};
