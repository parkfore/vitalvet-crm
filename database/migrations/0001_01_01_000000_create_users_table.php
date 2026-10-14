<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 사용자: 로그인 정보는 칸으로, 화면용 정보(이름·소속·연락처·연차 등)는 data(JSON)에 둔다
        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 40)->primary();           // 예: u_admin, u_k3x9a2b
            $table->string('username', 30)->unique();       // 로그인 아이디 (영문 소문자)
            $table->string('password');
            $table->string('status', 10)->default('pending'); // active | inactive | pending
            $table->string('role_id', 40)->nullable()->index();
            $table->json('data');
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('user_id', 40)->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
