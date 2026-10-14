<?php

namespace App\Console\Commands;

use App\Models\Role;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * 테스트가 끝난 뒤 실제 사용 전에 실행: 영업 데이터와 테스트 사용자를 모두 지운다.
 * 남는 것: 관리자 계정, 역할·권한, 영업 단계, 카테고리, 선택 목록, 설정
 *
 *   php artisan crm:clear-test-data
 */
class ClearTestData extends Command
{
    protected $signature = 'crm:clear-test-data {--force : 확인 질문 없이 실행}';

    protected $description = '테스트 데이터 삭제 (병원·활동·이력·업로드 이미지·관리자 외 사용자)';

    public function handle(): int
    {
        $this->warn('병원, 영업 활동, 리드 평가 이미지, 변경 이력, 관리자를 제외한 모든 사용자가 지워집니다. 되돌릴 수 없습니다.');
        if (! $this->option('force') && ! $this->confirm('정말 지울까요?')) {
            $this->info('취소했습니다.');

            return self::SUCCESS;
        }

        $adminRoles = Role::where('locked', true)->pluck('id');
        DB::transaction(function () use ($adminRoles) {
            foreach (['eval_shots', 'activities', 'stage_history', 'category_hospital', 'audit_logs'] as $t) {
                DB::table($t)->delete();
            }
            DB::table('hospitals')->delete();
            DB::table('competitors')->delete();
            DB::table('sessions')->whereNotIn('user_id', DB::table('users')->whereIn('role_id', $adminRoles)->pluck('id'))->delete();
            DB::table('users')->whereNotIn('role_id', $adminRoles)->orWhereNull('role_id')->delete();
        });
        if (DB::getDriverName() === 'pgsql') {
            // 병원 코드(VV-0001)가 다시 1번부터 시작하도록 번호 초기화
            foreach (['hospitals', 'activities', 'audit_logs', 'stage_history', 'eval_shots', 'competitors'] as $t) {
                DB::statement("SELECT setval(pg_get_serial_sequence('{$t}', 'id'), 1, false)");
            }
        }
        Storage::disk('local')->deleteDirectory('eval-shots');

        $this->info('테스트 데이터를 지웠습니다. 남은 사용자: '.DB::table('users')->count().'명 (관리자)');

        return self::SUCCESS;
    }
}
