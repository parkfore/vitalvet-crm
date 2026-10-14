<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Supabase 보호: 모든 테이블에 RLS(행 수준 보안)를 켜고 정책은 만들지 않는다.
 * → Supabase 공개 API(anon 키)로는 아무것도 읽거나 쓸 수 없고, 서버(Laravel)만 DB 소유자로 접근한다.
 */
return new class extends Migration
{
    private array $tables = ['users', 'password_reset_tokens', 'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'migrations',
        'roles', 'hospitals', 'eval_shots', 'categories', 'stages', 'competitors', 'reports', 'attendance', 'todos', 'coaching', 'audit_logs', 'app_settings'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach ($this->tables as $t) {
            DB::statement("ALTER TABLE IF EXISTS \"$t\" ENABLE ROW LEVEL SECURITY");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach ($this->tables as $t) {
            DB::statement("ALTER TABLE IF EXISTS \"$t\" DISABLE ROW LEVEL SECURITY");
        }
    }
};
