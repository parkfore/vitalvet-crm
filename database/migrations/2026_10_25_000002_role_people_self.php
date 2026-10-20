<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * '직원 자료 범위'를 병원 '수정 범위'와 분리하면서 '본인 것만(self)'을 추가.
 * - 담당 병원만 수정하던 역할(영업사원 등)은 예전처럼 본인 보고서·근태만 → self
 * - 영업팀장(r_lead)은 같은 팀 → team
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('roles')->get() as $r) {
            $d = json_decode($r->data, true) ?: [];
            if ($r->id === config('crm.admin_role')) {
                $d['people'] = 'all';
            } elseif ($r->id === 'r_lead') {
                $d['people'] = 'team';
            } elseif (($d['scope'] ?? 'own') === 'own' && ($d['people'] ?? 'team') === 'team') {
                $d['people'] = 'self';
            }
            DB::table('roles')->where('id', $r->id)->update(['data' => json_encode($d, JSON_UNESCAPED_UNICODE)]);
        }
    }

    public function down(): void
    {
    }
};
