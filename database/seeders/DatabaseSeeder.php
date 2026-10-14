<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\CodeItem;
use App\Models\Role;
use App\Models\Setting;
use App\Models\Stage;
use App\Support\Perm;
use Illuminate\Database\Seeder;

/**
 * 운영에 필요한 기본값만 넣는다 (예시 병원·사용자는 DemoSeeder).
 * 여러 번 실행해도 중복되지 않는다.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (config('crm.roles') as $key => [$name, $desc, $scope, $locked, $spec]) {
            Role::updateOrCreate(['key' => $key], [
                'name' => $name, 'description' => $desc, 'scope' => $scope, 'locked' => $locked,
                'permissions' => Perm::fromSpec($spec),
            ]);
        }

        if (! Stage::query()->exists()) {
            foreach (config('crm.stages') as $i => [$name, $kind, $trigger, $color]) {
                Stage::create(['name' => $name, 'kind' => $kind, 'trigger' => $trigger, 'color' => $color, 'sort' => $i]);
            }
        }

        foreach (config('crm.codes') as $grp => $values) {
            foreach ($values as $i => $v) {
                CodeItem::firstOrCreate(['grp' => $grp, 'value' => $v], ['sort' => $i]);
            }
        }

        if (! Category::query()->exists()) {
            Category::create(['name' => '중점 관리', 'description' => '이번 분기 집중 영업 대상', 'color' => '#0B6E63', 'sort' => 0]);
        }

        if (Setting::get('visit_goal') === null) {
            Setting::put('visit_goal', 4);
        }
    }
}
