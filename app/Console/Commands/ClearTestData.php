<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 테스트가 끝난 뒤 실제 사용 전에 실행: 영업 데이터와 테스트 사용자를 모두 지운다.
 * 남는 것: 관리자 계정, 역할·권한, 영업 단계, 선택 목록, 설정, 회사 휴일
 *
 *   php artisan crm:clear-test-data
 */
class ClearTestData extends Command
{
    protected $signature = 'crm:clear-test-data {--force : 확인 질문 없이 실행}';

    protected $description = '테스트 데이터 삭제 (병원·활동·보고서·근태·경쟁사·카테고리·이력·이미지·관리자 외 사용자)';

    public function handle(): int
    {
        $this->warn('병원, 영업 활동, 리드 평가 이미지, 영업 보고, 근태, 경쟁사, 카테고리, 변경 이력, 관리자를 제외한 모든 사용자가 지워집니다. 되돌릴 수 없습니다.');
        if (! $this->option('force') && ! $this->confirm('정말 지울까요?')) {
            $this->info('취소했습니다.');

            return self::SUCCESS;
        }
        $admin = config('crm.admin_role');
        DB::transaction(function () use ($admin) {
            foreach (['eval_shots', 'hospitals', 'reports', 'attendance', 'todos', 'coaching', 'competitors', 'categories', 'audit_logs'] as $t) {
                DB::table($t)->delete();
            }
            $keep = DB::table('users')->where('role_id', $admin)->pluck('id');
            DB::table('sessions')->whereNotIn('user_id', $keep)->delete();
            DB::table('users')->whereNotIn('id', $keep)->delete();
        });
        $this->info('테스트 데이터를 지웠습니다. 남은 사용자: '.DB::table('users')->count().'명 (관리자)');

        return self::SUCCESS;
    }
}
