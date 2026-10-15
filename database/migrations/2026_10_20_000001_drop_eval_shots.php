<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 리드 평가 근거 이미지 기능 삭제: 이미지 테이블을 지우고 병원 기록에 남은 이미지 목록도 비운다.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('hospitals')->select('id', 'data')->get() as $row) {
            $d = json_decode($row->data, true) ?: [];
            if (is_array($d['eval'] ?? null) && array_key_exists('shots', $d['eval'])) {
                unset($d['eval']['shots']);
                DB::table('hospitals')->where('id', $row->id)->update(['data' => json_encode($d, JSON_UNESCAPED_UNICODE)]);
            }
        }
        Schema::dropIfExists('eval_shots');
    }

    public function down(): void
    {
        Schema::create('eval_shots', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('hospital_id', 20)->index();
            $t->string('mime', 40);
            $t->longText('data');
            $t->string('created_by', 40)->nullable();
            $t->timestamps();
        });
    }
};
