<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** 접속·이용 기록 (관리자만 봄): 로그인 성공·실패, 로그아웃, 메뉴 이용, 백업 내려받기 등 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('access_logs', function (Blueprint $t) {
            $t->id();
            $t->timestamp('created_at')->useCurrent()->index();
            $t->string('user_id', 40)->nullable()->index();
            $t->string('username', 40)->nullable();
            $t->string('name', 60)->nullable();
            $t->string('event', 30)->index();
            $t->string('detail', 300)->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('ua', 255)->nullable();
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE "access_logs" ENABLE ROW LEVEL SECURITY');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('access_logs');
    }
};
