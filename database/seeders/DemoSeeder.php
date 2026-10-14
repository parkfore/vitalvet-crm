<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\Store;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * 테스트용 예시 데이터 (프로토타입과 같은 병원 60곳·영업 보고·근태·경쟁사·변경 이력)
 *
 *   php artisan db:seed --class=DemoSeeder
 *
 * 예시 계정 (비밀번호 모두 demo1234!)
 *   haerin 관리자 · dohyun 영업팀장 · sumin, junho 영업사원 · yuna 조회 전용 · jiwoo 승인 대기
 *
 * 날짜는 오늘 기준으로 맞춰진다 (요일이 바뀌지 않도록 주 단위로 이동).
 * 실제 사용 전에는 php artisan crm:clear-test-data 로 지운다.
 */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'demo1234!';

    public function run(): void
    {
        $this->call(DatabaseSeeder::class);
        $d = json_decode(file_get_contents(__DIR__.'/demo-data.json'), true);
        $days = (int) Carbon::parse($d['base'])->diffInDays(Carbon::today(), false);
        $shift = intdiv($days, 7) * 7;
        $d = $this->shift($d, $shift);

        DB::transaction(function () use ($d) {
            foreach ($d['users'] as $u) {
                if (User::where('username', $u['username'])->orWhere('id', $u['id'])->exists()) {
                    continue;
                }
                User::create(['id' => $u['id'], 'username' => $u['username'], 'password' => self::PASSWORD, 'status' => $u['status'], 'role_id' => $u['roleId'] ?: null,
                    'data' => array_diff_key($u, array_flip(['id', 'username', 'status', 'roleId']))]);
            }
            foreach ($d['categories'] as $i => $c) {
                Store::put('categories', $c, $i);
            }
            foreach (['competitors', 'hospitals', 'reports', 'attendance', 'todos', 'coaching'] as $col) {
                foreach ($d[$col] ?? [] as $r) {
                    Store::put($col, $r);
                }
            }
            DB::table('audit_logs')->whereIn('id', array_column($d['audit'], 'id'))->delete();
            foreach (array_chunk($d['audit'], 200) as $chunk) {
                DB::table('audit_logs')->insert(array_map(fn ($e) => [
                    'id' => $e['id'], 'ts' => $e['ts'], 'user_id' => $e['userId'] ?: null, 'entity' => $e['entity'],
                    'entity_id' => $e['entityId'] ?? null, 'hospital_id' => $e['hospitalId'] ?? null,
                    'data' => json_encode($e, JSON_UNESCAPED_UNICODE), 'created_at' => now(),
                ], $chunk));
            }
        });
        $this->command?->info('예시 데이터를 넣었습니다. 예시 계정 비밀번호: '.self::PASSWORD.' (haerin·dohyun·sumin·junho·yuna)');
    }

    /** 문자열 안의 날짜(YYYY-MM-DD)와 시각을 $days 일 만큼 옮긴다 */
    private function shift($v, int $days)
    {
        if ($days === 0) {
            return $v;
        }
        if (is_array($v)) {
            $out = [];
            foreach ($v as $k => $x) {
                $out[is_string($k) ? $this->shift($k, $days) : $k] = $this->shift($x, $days);
            }

            return $out;
        }
        if (! is_string($v)) {
            return $v;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/', $v)) {
            return Carbon::parse($v)->addDays($days)->utc()->format('Y-m-d\TH:i:s.v\Z');
        }

        return preg_replace_callback('/\b(\d{4}-\d{2}-\d{2})\b/', fn ($m) => Carbon::parse($m[1])->addDays($days)->toDateString(), $v);
    }
}
