<?php

namespace Database\Seeders;

use App\Support\Store;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 운영에 필요한 기본값만 넣는다 (역할·영업 단계·선택 목록·설정·회사 휴일).
 * 예시 병원·사용자는 DemoSeeder. 여러 번 실행해도 이미 있는 값은 건드리지 않는다.
 */
class DatabaseSeeder extends Seeder
{
    public static function permsOf($spec): array
    {
        $p = [];
        foreach (config('crm.features') as $f => $ops) {
            $s = $spec === '*' ? 'vrcud' : ($spec[$f] ?? ($spec['*'] ?? ''));
            foreach ($ops as $op) {
                $p[$f][$op] = str_contains($s, $op[0]);
            }
        }

        return $p;
    }

    public function run(): void
    {
        foreach (config('crm.roles') as $i => [$id, $name, $desc, $scope, $locked, $spec]) {
            if (! DB::table('roles')->where('id', $id)->exists()) {
                Store::put('roles', ['id' => $id, 'name' => $name, 'desc' => $desc, 'scope' => $scope, 'people' => $id === config('crm.admin_role') ? 'all' : ($scope === 'own' ? 'self' : 'team'), 'manualCheckin' => in_array($id, [config('crm.admin_role'), 'r_lead', 'r_sales'], true), 'perms' => self::permsOf($spec)] + ($locked ? ['locked' => true] : []), $i);
            }
        }
        if (! DB::table('stages')->exists()) {
            foreach (config('crm.stages') as $i => [$name, $kind, $trigger]) {
                Store::put('stages', ['id' => 'st'.$i, 'name' => $name, 'kind' => $kind, 'trigger' => $trigger, 'color' => "var(--s{$i})"], $i);
            }
        }
        foreach (['settings', 'codes', 'holidays'] as $k) {
            if (Store::setting($k) === null) {
                Store::putSetting($k, config('crm.'.$k));
            }
        }
    }
}
