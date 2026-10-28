<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Backup;
use App\Support\Store;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * QA 가 끝난 뒤 실제 사용 시작 전 초기화 (사용자 요청: 2026-10-21)
 *
 * 남기는 것
 *  - 관리자 계정 admin / 비밀번호 admin1234 (관리자 역할 · 활성). 다른 사용자는 모두 삭제 (다른 관리자 포함)
 *  - 카테고리
 *  - 선택 목록: 소속, 병원 등급, 전문과 (app_settings 'codes')
 *  - 프로그램이 돌아가는 데 필요한 기준 정보: 역할·권한, 영업 단계, 일반 설정(방문 목표·지도·필수 항목·체크인 거리),
 *    회사 휴일, 알림 기본값, 웹푸시 키, 공공데이터 연동 설정
 *
 * 지우는 것
 *  - 병원(활동·평가·전환 포함), 영업 보고, 근태, 할 일 메모, 코칭 메모, 경쟁사
 *  - 변경 이력, 접속·이용 기록, 오류 기록, 알림 기기·알림 내역, 로그인 세션
 *  - 사람별 설정(알림 설정·요약 보낸 표시·오늘 동선·내 영업 맵·병원 가져오기 진행 기록), 월 목표
 *  - 공공데이터 연동의 마지막 가져오기 기록 (연동 설정은 남김), 프로그램 캐시·작업 대기열
 *  - 각 기기에 남은 활동 기록 임시 저장·알림 읽음 표시 (다음 접속 때 화면이 지움: reset_at)
 *  - 병원 번호는 VV-0001 부터 다시
 *  - 테스트 기간 백업 파일 (초기화 직전에 만든 마지막 백업 1개만 남긴다)
 *
 * 실행: GitHub › Actions › "Reset data (초기화)" › 확인 칸에 '초기화' 입력 (서버에서 백업 → 초기화)
 *   php artisan crm:reset-launch --dry-run           (지울 개수만 보기)
 *   php artisan crm:reset-launch --confirm=초기화     (실행)
 */
class ResetForLaunch extends Command
{
    protected $signature = 'crm:reset-launch {--confirm= : 실행하려면 초기화 라고 입력} {--dry-run : 지울 개수만 보여 주기}';

    protected $description = '실사용 전 초기화: admin 계정·카테고리·소속·병원 등급·전문과(+역할·단계·설정)만 남기고 모두 삭제';

    private const WIPE = ['hospitals', 'reports', 'attendance', 'todos', 'coaching', 'competitors', 'audit_logs',
        'access_logs', 'error_logs', 'notif_queue', 'push_subscriptions', 'sessions', 'eval_shots',
        // 프로그램 내부 임시 자료 (캐시·작업 대기열·비밀번호 재설정 요청)
        'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'password_reset_tokens'];

    /** 사람별·테스트 기간 설정 (접두어 포함) */
    private const SETTING_PREFIX = ['notif:', 'brief:', 'route:', 'mapviews:', 'import_run:'];

    private const SETTING_KEYS = ['goals', 'hospital_seq', 'data_ver', 'backup_last', 'notify_ping', 'schedule_ping', 'public_api_last'];

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        if (! $dry && $this->option('confirm') !== '초기화') {
            $this->error("실행하려면 --confirm=초기화 를 붙이세요 (먼저 --dry-run 으로 확인)");

            return self::FAILURE;
        }
        $tables = array_values(array_filter(self::WIPE, fn ($t) => Schema::hasTable($t)));
        $settingRows = DB::table('app_settings')->get(['key'])->pluck('key')->filter(fn ($k) => in_array($k, self::SETTING_KEYS, true)
            || collect(self::SETTING_PREFIX)->contains(fn ($p) => str_starts_with($k, $p)))->values()->all();
        $admin = User::where('username', 'admin')->first();
        $others = User::when($admin, fn ($q) => $q->where('id', '!=', $admin->id))->get();

        $this->line('== 지울 것 ==');
        foreach ($tables as $t) {
            $this->line(sprintf('%-20s %s건', $t, number_format(DB::table($t)->count())));
        }
        $this->line('사용자 '.$others->count().'명: '.$others->map(fn ($u) => $u->username)->implode(', '));
        $this->line('설정 '.count($settingRows).'개: '.implode(', ', $settingRows));
        $this->line('백업 파일 '.count(Backup::list()).'개 (초기화 직전 백업 1개만 남김)');
        $this->line('== 남길 것 ==');
        $codes = Store::codes();
        $this->line('관리자: admin / admin1234 '.($admin ? '(있는 계정 · 비밀번호 다시 지정)' : '(새로 만듦)'));
        $this->line('카테고리 '.DB::table('categories')->count().'개 · 소속 '.count($codes['teams'] ?? []).' · 병원 등급 '.count($codes['grades'] ?? []).' · 전문과 '.count($codes['specialties'] ?? []));
        $this->line('역할 '.DB::table('roles')->count().'개 · 영업 단계 '.DB::table('stages')->count().'개 · 일반 설정·휴일·알림 기본값');
        if ($dry) {
            $this->info('미리 보기만 했습니다 (아무것도 지우지 않음)');

            return self::SUCCESS;
        }

        // 1) 초기화 직전 백업 (되돌릴 수 있게)
        $b = Backup::create('prereset');
        $this->info("초기화 전 백업: {$b['name']}");

        // 2) 데이터 지우기 (소속 목록은 사용자 소속에서 만들어질 수 있으므로 사용자를 지우기 전에 설정에 고정 저장)
        Store::putSetting('codes', Store::codes());
        DB::transaction(function () use ($tables, $settingRows, $admin, $others) {
            foreach ($tables as $t) {
                DB::table($t)->delete();
            }
            DB::table('app_settings')->whereIn('key', $settingRows)->delete();
            DB::table('users')->whereIn('id', $others->pluck('id'))->delete();
            $adminRole = config('crm.admin_role');
            if ($admin) {
                $admin->password = 'admin1234';
                $admin->role_id = $adminRole;
                $admin->status = 'active';
                $admin->save();
            } else {
                User::create(['id' => User::newId(), 'username' => 'admin', 'password' => 'admin1234', 'status' => 'active', 'role_id' => $adminRole,
                    'data' => ['name' => '관리자', 'team' => '운영팀', 'slot' => 1, 'joinedAt' => now()->toDateString()]]);
            }
        });

        // 3) 테스트 기간 백업 파일 정리 (방금 만든 초기화 전 백업만 남김)
        foreach (Backup::list() as $x) {
            if ($x['name'] !== $b['name']) {
                @unlink(Backup::dir().'/'.$x['name']);
            }
        }
        // 공공데이터 연동: 설정(키·주기)은 남기고 테스트 기간 마지막 가져오기 기록만 지움
        $pa = Store::setting('public_api', null);
        if (is_array($pa)) {
            $pa['last'] = null;
            Store::putSetting('public_api', $pa);
        }
        // 기기에 남은 테스트 기간 임시 저장(활동 기록 쓰던 내용 등)은 다음 접속 때 화면이 이 시각 기준으로 지운다
        Store::putSetting('reset_at', now()->toIso8601ZuluString());
        Store::putSetting('data_ver', 'reset-'.now()->format('YmdHis'));
        $this->info('초기화 완료 · 남은 사용자 '.User::count().'명 (admin) · 카테고리 '.DB::table('categories')->count().'개 · 병원 0곳');

        return self::SUCCESS;
    }
}
