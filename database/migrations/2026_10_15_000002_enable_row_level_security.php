<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Supabase 보안 잠금: 모든 테이블에 RLS(행 수준 보안)를 켠다.
 * 허용 규칙(policy)을 하나도 만들지 않으므로 Supabase Data API(anon·authenticated 키)로는 아무것도 읽거나 쓸 수 없다.
 * 이 앱(Laravel)은 테이블 소유자 계정으로 접속하므로 RLS 영향을 받지 않는다.
 * PostgreSQL에서만 실행 (로컬 SQLite 테스트는 건너뜀).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach ($this->tables() as $t) {
            DB::statement("ALTER TABLE \"{$t}\" ENABLE ROW LEVEL SECURITY");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach ($this->tables() as $t) {
            DB::statement("ALTER TABLE \"{$t}\" DISABLE ROW LEVEL SECURITY");
        }
    }

    private function tables(): array
    {
        return array_map(fn ($r) => $r->tablename, DB::select("select tablename from pg_tables where schemaname = current_schema()"));
    }
};
