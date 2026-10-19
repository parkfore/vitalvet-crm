<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** 오류 기록 (관리자만 봄): 서버 오류 + 화면(브라우저) 오류. 같은 오류는 한 줄로 모으고 횟수만 늘린다 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('error_logs', function (Blueprint $t) {
            $t->id();
            $t->string('fingerprint', 64)->unique();
            $t->string('source', 10);
            $t->string('message', 500);
            $t->text('detail')->nullable();
            $t->string('url', 300)->nullable();
            $t->string('user_id', 40)->nullable();
            $t->string('user_name', 60)->nullable();
            $t->unsignedInteger('count')->default(1);
            $t->timestamp('first_at')->useCurrent();
            $t->timestamp('last_at')->useCurrent()->index();
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE "error_logs" ENABLE ROW LEVEL SECURITY');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('error_logs');
    }
};
