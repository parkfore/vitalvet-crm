<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 예정 구분(연락·방문·자료전송 예정)을 기본 정보(pre)에서 영업 활동 › 다음 액션(next.kind)으로 옮긴다.
 * 미접촉(예정) 단계 병원의 값만 옮기고, 기본 정보의 값은 비운다.
 */
return new class extends Migration
{
    public function up(): void
    {
        $first = DB::table('stages')->orderBy('sort')->get()->map(fn ($r) => json_decode($r->data, true) + ['id' => $r->id])->firstWhere('kind', 'main')['name'] ?? '미접촉(예정)';
        foreach (DB::table('hospitals')->select('id', 'data')->get() as $row) {
            $h = json_decode($row->data, true) ?: [];
            $pre = (string) ($h['pre'] ?? '');
            if ($pre === '') {
                continue;
            }
            $next = is_array($h['next'] ?? null) ? $h['next'] : [];
            if (($h['stage'] ?? '') === $first && in_array($pre, ['call', 'visit', 'send'], true) && empty($next['kind']) && empty($next['done'])) {
                $next['kind'] = $pre;
                $h['next'] = $next;
            }
            $h['pre'] = '';
            DB::table('hospitals')->where('id', $row->id)->update(['data' => json_encode($h, JSON_UNESCAPED_UNICODE)]);
        }
    }

    public function down(): void {}
};
