<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** 웹푸시: 알림 받을 기기 목록 + 보낼 알림 대기열 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->string('user_id', 40)->index();
            $t->char('endpoint_hash', 64)->unique();
            $t->text('endpoint');
            $t->string('p256dh', 120);
            $t->string('auth', 60);
            $t->string('ua', 255)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('last_ok_at')->nullable();
        });
        Schema::create('notif_queue', function (Blueprint $t) {
            $t->id();
            $t->string('user_id', 40)->index();
            $t->string('type', 30);
            $t->string('title', 120);
            $t->string('body', 300)->nullable();
            $t->string('url', 200)->nullable();
            $t->string('tag', 60)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('send_after')->useCurrent()->index();
            $t->timestamp('sent_at')->nullable()->index();
            $t->string('claim', 16)->nullable();
            $t->string('result', 10)->nullable();
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY');
            DB::statement('ALTER TABLE "notif_queue" ENABLE ROW LEVEL SECURITY');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('notif_queue');
        Schema::dropIfExists('push_subscriptions');
    }
};
