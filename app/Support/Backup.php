<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * CRM 데이터 백업 (Supabase DB → 서버 storage/app/backups/*.json.gz)
 *
 * - 매일 자동 (스케줄러 또는, 스케줄러가 없으면 하루 첫 접속 때)
 * - 7일치 보관: 7일이 지난 백업 파일은 자동 삭제 (자동 백업이 멈춰 새 백업이 없을 때만, 안전을 위해 가장 최근 3개는 남긴다)
 * - 관리자가 설정 › 백업에서 목록 확인·내려받기·지금 백업
 * - 되돌리기: 서버에서 php artisan crm:restore 파일이름 --force
 */
class Backup
{
    /** 백업할 테이블 (세션·캐시·접속 기록 제외) */
    public const TABLES = ['users', 'roles', 'hospitals', 'categories', 'stages', 'competitors', 'reports', 'attendance', 'todos', 'coaching', 'audit_logs', 'app_settings'];

    public const KEEP_DAYS = 7;

    public const KEEP_MIN = 3;

    public static function dir(): string
    {
        $d = storage_path('app/backups');
        if (! is_dir($d)) {
            File::ensureDirectoryExists($d, 0770);
            @chmod($d, 02770); // 웹 계정·예약 실행 계정(같은 그룹)이 함께 쓴다
        }

        return $d;
    }

    public static function valid(string $name): bool
    {
        return (bool) preg_match('/^vitalvet-\d{8}-\d{6}(-[a-z]+)?\.json\.gz$/', $name) && is_file(self::dir().'/'.$name);
    }

    /** @return array{name:string,size:int,counts:array} */
    public static function create(string $kind = 'auto', ?string $by = null): array
    {
        $name = 'vitalvet-'.now()->format('Ymd-His').($kind === 'auto' ? '' : '-'.preg_replace('/[^a-z]/', '', $kind)).'.json.gz';
        $path = self::dir().'/'.$name;
        $tmp = $path.'.part';
        $gz = gzopen($tmp, 'wb6');
        $counts = [];
        $w = fn (string $s) => gzwrite($gz, $s);
        $w('{"app":"vitalvet-crm","version":1,"createdAt":'.json_encode(now()->toIso8601ZuluString()).',"by":'.json_encode($by).',"tables":{');
        foreach (self::TABLES as $ti => $t) {
            $w(($ti ? ',' : '').json_encode($t).':[');
            $n = 0;
            foreach (DB::table($t)->orderBy(DB::raw('1'))->cursor() as $row) {
                $w(($n ? ',' : '').json_encode((array) $row, JSON_UNESCAPED_UNICODE));
                $n++;
            }
            $w(']');
            $counts[$t] = $n;
        }
        $w('},"counts":'.json_encode($counts).'}');
        gzclose($gz);
        rename($tmp, $path);
        @chmod($path, 0660);
        Store::putSetting('backup_last', ['name' => $name, 'at' => now()->toIso8601ZuluString(), 'kind' => $kind, 'by' => $by, 'counts' => $counts, 'size' => filesize($path)]);
        self::prune();

        return ['name' => $name, 'size' => filesize($path), 'counts' => $counts];
    }

    /** 최근 순 목록 */
    public static function list(): array
    {
        $out = [];
        foreach (glob(self::dir().'/vitalvet-*.json.gz') ?: [] as $f) {
            $b = basename($f);
            preg_match('/^vitalvet-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/', $b, $m);
            $out[] = ['name' => $b, 'size' => filesize($f), 'at' => $m ? "{$m[1]}-{$m[2]}-{$m[3]} {$m[4]}:{$m[5]}:{$m[6]}" : '', 'kind' => preg_match('/-([a-z]+)\.json\.gz$/', $b, $k) ? $k[1] : 'auto'];
        }
        usort($out, fn ($a, $b) => strcmp($b['name'], $a['name']));

        return $out;
    }

    /** 7일이 지난 백업 지우기 (자동·직접·되돌리기 전 백업 모두). 지운 개수 */
    public static function prune(): int
    {
        $n = 0;
        $list = self::list();
        foreach (array_slice($list, self::KEEP_MIN) as $b) {
            if ($b['at'] && strtotime($b['at']) < now()->subDays(self::KEEP_DAYS)->getTimestamp()) {
                if (@unlink(self::dir().'/'.$b['name'])) {
                    $n++;
                }
            }
        }

        return $n;
    }

    /** 마지막 자동 백업이 20시간보다 오래됐으면 지금 만든다 (스케줄러가 없을 때를 대비) */
    public static function autoIfDue(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }
        try {
            $lastAuto = collect(self::list())->firstWhere('kind', 'auto');
            if ($lastAuto && strtotime($lastAuto['at']) > now()->subHours(20)->getTimestamp()) {
                return;
            }
            // 여러 요청이 동시에 만들지 않도록
            $lock = cache()->lock('crm-auto-backup', 600);
            if ($lock->get()) {
                try {
                    self::create('auto');
                    AccessLog::prune();
                } finally {
                    $lock->release();
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** 백업 파일로 되돌리기 (모든 CRM 테이블을 비우고 채운다) */
    public static function restore(string $name): array
    {
        if (! self::valid($name)) {
            throw new \RuntimeException('백업 파일을 찾을 수 없습니다: '.$name);
        }
        $json = gzdecode(file_get_contents(self::dir().'/'.$name));
        $d = json_decode($json, true);
        if (! is_array($d) || ($d['app'] ?? '') !== 'vitalvet-crm' || ! is_array($d['tables'] ?? null)) {
            throw new \RuntimeException('VitalVET 백업 파일이 아닙니다');
        }
        $counts = [];
        DB::transaction(function () use ($d, &$counts) {
            foreach (array_reverse(self::TABLES) as $t) {
                if (array_key_exists($t, $d['tables'])) {
                    DB::table($t)->delete();
                }
            }
            foreach (self::TABLES as $t) {
                if (! array_key_exists($t, $d['tables'])) {
                    continue;
                }
                foreach (array_chunk($d['tables'][$t], 200) as $chunk) {
                    DB::table($t)->insert($chunk);
                }
                $counts[$t] = count($d['tables'][$t]);
            }
        });

        return $counts;
    }
}
