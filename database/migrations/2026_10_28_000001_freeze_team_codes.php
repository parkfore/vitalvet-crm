<?php

use App\Support\Backup;
use App\Support\Store;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 소속 목록을 설정에 고정 저장.
 * 예전에는 소속 목록을 따로 저장하지 않으면 '기본 소속 + 지금 사용자들의 소속'으로 만들어 보여 줘서,
 * 실사용 전 초기화로 사용자를 지우자 그 사람들의 소속(2개)이 목록에서 빠졌다.
 * → 초기화 직전 백업(prereset)의 사용자 소속까지 모아 목록을 되살리고 설정에 저장한다.
 */
return new class extends Migration
{
    public function up(): void
    {
        $codes = (array) Store::setting('codes', []);
        if (isset($codes['teams']) && is_array($codes['teams'])) {
            return; // 이미 저장된 목록이 있으면 그대로
        }
        $teams = config('crm.codes.teams');
        $fromUsers = fn ($rows) => collect($rows)->map(fn ($r) => trim((string) ((is_array($r['data'] ?? null) ? $r['data'] : (json_decode((string) ($r['data'] ?? ''), true) ?: []))['team'] ?? '')))->filter()->all();
        // 가장 최근 초기화 직전 백업의 사용자 소속
        $pre = collect(Backup::list())->pluck('name')->filter(fn ($n) => str_contains($n, '-prereset'))->sort()->last();
        if ($pre) {
            try {
                $d = json_decode(gzdecode(file_get_contents(Backup::dir().'/'.$pre)), true);
                $teams = [...$teams, ...$fromUsers($d['tables']['users'] ?? [])];
            } catch (\Throwable) {
                // 백업을 읽지 못하면 기본 + 지금 사용자 소속만
            }
        }
        $teams = [...$teams, ...$fromUsers(DB::table('users')->get(['data'])->map(fn ($r) => (array) $r)->all())];
        $codes = Store::codes();
        $codes['teams'] = array_values(array_unique(array_map(fn ($t) => mb_substr($t, 0, 40), $teams)));
        Store::putSetting('codes', $codes);
    }

    public function down(): void
    {
    }
};
