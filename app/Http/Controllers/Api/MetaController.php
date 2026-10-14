<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\CodeItem;
use App\Models\Competitor;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\User;

/** 화면 공통 기준: 단계, 카테고리, 선택 목록, 사용자 이름, 각종 목록 */
class MetaController extends Controller
{
    public function __invoke()
    {
        $codes = CodeItem::query()->orderBy('sort')->get()->groupBy('grp')->map(fn ($g) => $g->pluck('value')->values());
        $c = config('crm');

        return response()->json([
            'stages' => Stage::ordered()->map->only(['id', 'name', 'kind', 'trigger', 'color', 'sort'])->values(),
            'categories' => Category::query()->orderBy('sort')->orderBy('id')->get(['id', 'name', 'description', 'color', 'sort']),
            'codes' => $codes,
            'users' => User::query()->with('role')->where('status', 'active')->orderBy('name')->get()->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'team' => $u->team, 'role_name' => $u->role?->name])->values(),
            'competitors' => Competitor::query()->orderBy('name')->get(['id', 'name']),
            'features' => collect($c['features'])->map(fn ($f, $k) => ['key' => $k, 'name' => $f[0], 'ops' => $f[1], 'desc' => $f[2]])->values(),
            'triggers' => $c['triggers'],
            'pre_types' => $c['pre_types'],
            'lead_sources' => $c['lead_sources'],
            'eval_items' => $c['eval_items'],
            'eval_max' => $c['eval_max'],
            'eval_grades' => $c['eval_grades'],
            'eval_max_shots' => $c['eval_max_shots'],
            'activity_types' => $c['activity_types'],
            'activity_purposes' => $c['activity_purposes'],
            'activity_contacts' => $c['activity_contacts'],
            'activity_reactions' => $c['activity_reactions'],
            'voc_types' => $c['voc_types'],
            'issue_types' => $c['issue_types'],
            'category_colors' => $c['category_colors'],
            'visit_goal' => (int) Setting::get('visit_goal', 4),
            'today' => now()->toDateString(),
        ]);
    }
}
