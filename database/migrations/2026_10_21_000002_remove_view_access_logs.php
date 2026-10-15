<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** 메뉴 이용(탭 이동) 기록은 남기지 않기로 해서 쌓인 것도 지운다 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('access_logs')->where('event', 'view')->delete();
    }

    public function down(): void {}
};
