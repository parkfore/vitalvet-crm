<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Hospital;
use App\Models\Stage;
use App\Support\Perm;

class DashboardController extends Controller
{
    public function __invoke()
    {
        $me = $this->actor();
        Perm::need($me, 'dash', 'read');
        $own = Perm::scope($me) === 'own';
        $H = Hospital::query()->whereNull('deleted_at')->when($own, fn ($q) => $q->where('owner_id', $me->id))->get();
        $today = now()->toDateString();
        $stages = Stage::ordered();
        $initial = Stage::initial();
        $canEval = Perm::can($me, 'eval', 'read');
        $canAct = Perm::can($me, 'activity', 'read');
        $canConv = Perm::can($me, 'conv', 'read');

        $weeks = collect(range(7, 0))->map(fn ($i) => now()->startOfWeek()->subWeeks($i)->toDateString());
        $acts = $canAct ? Activity::query()->whereIn('hospital_id', $H->pluck('id'))->where('date', '>=', $weeks->first())->get(['type', 'date']) : collect();

        return response()->json([
            'scope' => $own ? 'own' : 'all',
            'total' => $H->count(),
            'by_stage' => $stages->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'color' => $s->color, 'count' => $H->where('stage_id', $s->id)->count()])->values(),
            'pre' => collect(config('crm.pre_types'))->map(fn ($v, $k) => ['key' => $k, 'name' => $v[0], 'color' => $v[1], 'count' => $H->where('stage_id', $initial?->id)->where('pre_type', $k)->count()])->values(),
            'sources' => collect(config('crm.lead_sources'))->map(fn ($s) => ['name' => $s, 'count' => $H->filter(fn ($h) => in_array($s, $h->sources ?? [], true))->count()])->values(),
            'grades' => $canEval ? collect(['상', '중', '하', '미평가'])->map(fn ($g) => ['name' => $g, 'count' => $H->filter(fn ($h) => $h->evalGrade() === $g)->count()])->values() : null,
            'follow' => $canAct ? [
                'overdue' => $H->filter(fn ($h) => $h->followStatus($today) === '지연')->count(),
                'today' => $H->filter(fn ($h) => $h->followStatus($today) === '오늘')->count(),
                'list' => $H->filter(fn ($h) => in_array($h->followStatus($today), ['지연', '오늘', '예정'], true) && $h->next_date->toDateString() <= now()->addDays(3)->toDateString())
                    ->sortBy(fn ($h) => [$h->owner_id === $me->id ? 0 : 1, $h->next_date->toDateString()])->take(12)
                    ->map(fn ($h) => ['id' => $h->id, 'name' => $h->name, 'stage_id' => $h->stage_id, 'next_date' => $h->next_date->toDateString(), 'next_todo' => $h->next_todo, 'follow' => $h->followStatus($today), 'owner_id' => $h->owner_id])->values(),
            ] : null,
            'conv' => $canConv ? ['signup' => $H->whereNotNull('signup_date')->count(), 'using' => $H->where('usage_count', '>', 0)->count(), 'usage_total' => (int) $H->sum('usage_count')] : null,
            'weekly' => $canAct ? $weeks->map(fn ($w) => [
                'week' => $w,
                'visit' => $acts->filter(fn ($a) => $a->type === '방문' && $a->date->startOfWeek()->toDateString() === $w)->count(),
                'call' => $acts->filter(fn ($a) => $a->type === '전화' && $a->date->startOfWeek()->toDateString() === $w)->count(),
                'etc' => $acts->filter(fn ($a) => ! in_array($a->type, ['방문', '전화'], true) && $a->date->startOfWeek()->toDateString() === $w)->count(),
            ])->values() : null,
        ]);
    }
}
