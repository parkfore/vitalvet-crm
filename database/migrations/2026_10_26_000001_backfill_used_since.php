<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** 사용 시작일(usedSince) 채우기: 이미 사용 중인 병원은 사용 단계로 바뀐 날 → 마지막 사용일 → 회원가입일 → 등록일 순으로 */
return new class extends Migration
{
    public function up(): void
    {
        $useStages = [];
        foreach (DB::table('stages')->get() as $s) {
            $d = json_decode($s->data, true) ?: [];
            if (($d['trigger'] ?? '') === 'use') {
                $useStages[] = $d['name'] ?? '';
            }
        }
        foreach (DB::table('hospitals')->get(['id', 'data']) as $row) {
            $h = json_decode($row->data, true) ?: [];
            if ((int) ($h['usageCount'] ?? 0) <= 0 || ! empty($h['usedSince'])) {
                continue;
            }
            $date = '';
            foreach ((array) ($h['stageHistory'] ?? []) as $x) {
                if (in_array($x['to'] ?? '', $useStages, true) && ($x['date'] ?? '') !== '' && ($date === '' || $x['date'] < $date)) {
                    $date = substr($x['date'], 0, 10);
                }
            }
            $date = $date ?: substr((string) ($h['lastUsedDate'] ?? ''), 0, 10) ?: substr((string) ($h['signupDate'] ?? ''), 0, 10) ?: substr((string) ($h['createdAt'] ?? ''), 0, 10);
            if ($date === '') {
                continue;
            }
            $h['usedSince'] = $date;
            DB::table('hospitals')->where('id', $row->id)->update(['data' => json_encode($h, JSON_UNESCAPED_UNICODE)]);
        }
    }

    public function down(): void
    {
    }
};
