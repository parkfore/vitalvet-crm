<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hospital;
use App\Models\Stage;
use App\Models\StageHistory;
use App\Support\Audit;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StageController extends Controller
{
    private function v(Request $r, ?Stage $s = null): array
    {
        return $r->validate([
            'name' => ['required', 'string', 'max:30', Rule::unique('stages')->ignore($s?->id)],
            'kind' => 'required|in:main,exit',
            'trigger' => ['nullable', Rule::in(array_keys(config('crm.triggers')))],
            'color' => 'required|string|max:20',
        ], ['name.unique' => '같은 이름의 단계가 있습니다.']);
    }

    private function snap(Stage $s): array
    {
        return ['name' => ['이름', $s->name], 'kind' => ['구분', $s->kind === 'main' ? '진행' : '이탈'],
            'trigger' => ['자동 전환', config('crm.triggers')[$s->trigger] ?? ''], 'color' => ['색상', $s->color]];
    }

    public function store(Request $r)
    {
        Perm::need($this->actor(), 'settings', 'update');
        $d = $this->v($r);
        if ($d['kind'] === 'exit') {
            $d['trigger'] = null;
        }
        $s = DB::transaction(function () use ($d) {
            if (! empty($d['trigger'])) {
                Stage::where('trigger', $d['trigger'])->update(['trigger' => null]);
            }

            return Stage::create($d + ['sort' => (int) Stage::max('sort') + 1]);
        });
        Audit::log('stage', $s->id, $s->name, 'create', '영업 단계', Audit::diff([], $this->snap($s)));

        return response()->json($s, 201);
    }

    public function update(Request $r, Stage $stage)
    {
        Perm::need($this->actor(), 'settings', 'update');
        $d = $this->v($r, $stage);
        if ($d['kind'] === 'exit') {
            $d['trigger'] = null;
        }
        if ($stage->kind === 'main' && $d['kind'] === 'exit' && Stage::where('kind', 'main')->count() <= 1) {
            return $this->fail('진행 단계는 최소 1개 있어야 합니다');
        }
        $before = $this->snap($stage);
        $old = $stage->name;
        DB::transaction(function () use ($d, $stage) {
            if (! empty($d['trigger'])) {
                Stage::where('trigger', $d['trigger'])->where('id', '!=', $stage->id)->update(['trigger' => null]);
            }
            $stage->update($d);
        });
        if ($ch = Audit::diff($before, $this->snap($stage))) {
            Audit::log('stage', $stage->id, $stage->name, 'update', '영업 단계', $ch, null, $old !== $stage->name ? "이름 변경: {$old} → {$stage->name}" : null);
        }

        return response()->json($stage);
    }

    public function order(Request $r)
    {
        Perm::need($this->actor(), 'settings', 'update');
        $d = $r->validate(['ids' => 'required|array', 'ids.*' => 'integer|exists:stages,id']);
        foreach ($d['ids'] as $i => $id) {
            Stage::whereKey($id)->update(['sort' => $i]);
        }
        Audit::log('stage', 'order', '영업 단계 순서', 'update', '영업 단계', [['field' => '순서', 'before' => '', 'after' => Stage::ordered()->pluck('name')->implode(' → ')]]);

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $r, Stage $stage)
    {
        Perm::need($this->actor(), 'settings', 'update');
        if ($stage->kind === 'main' && Stage::where('kind', 'main')->count() <= 1) {
            return $this->fail('진행 단계는 최소 1개 있어야 합니다');
        }
        $n = Hospital::where('stage_id', $stage->id)->count();
        $moveTo = null;
        if ($n) {
            $d = $r->validate(['move_to' => 'required|exists:stages,id']);
            $moveTo = Stage::find($d['move_to']);
            if ($moveTo->id === $stage->id) {
                return $this->fail('옮길 단계를 다른 단계로 고르세요');
            }
        }
        DB::transaction(function () use ($stage, $moveTo, $n) {
            if ($n) {
                Hospital::where('stage_id', $stage->id)->get()->each(function ($h) use ($stage, $moveTo) {
                    $h->update(['stage_id' => $moveTo->id]);
                    StageHistory::create(['hospital_id' => $h->id, 'date' => now()->toDateString(), 'from_stage' => $stage->name, 'to_stage' => $moveTo->name, 'changed_by' => auth()->id(), 'auto' => false]);
                });
            }
            $stage->delete();
        });
        Audit::log('stage', $stage->id, $stage->name, 'delete', '영업 단계', Audit::diff($this->snap($stage), []), null, $n ? "병원 {$n}곳을 ‘{$moveTo->name}’(으)로 옮김" : null);

        return response()->json(['ok' => true]);
    }
}
