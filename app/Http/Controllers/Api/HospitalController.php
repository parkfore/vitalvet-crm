<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Hospital;
use App\Models\Stage;
use App\Models\StageHistory;
use App\Services\HospitalService as HS;
use App\Support\Audit;
use App\Support\Geo;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class HospitalController extends Controller
{
    /** 목록: 필터는 화면에서 바로 하도록 전체를 내려준다 (수천 곳까지 충분히 빠름) */
    public function index(Request $r)
    {
        Perm::need($this->actor(), 'hospital', 'read');
        $deleted = $r->boolean('deleted');
        if ($deleted) {
            Perm::need($this->actor(), 'hospital', 'delete');
        }
        $q = Hospital::query()->with('categories:id')->orderBy('id');
        $deleted ? $q->whereNotNull('deleted_at') : $q->whereNull('deleted_at');
        $canEval = Perm::can($this->actor(), 'eval', 'read');
        $canAct = Perm::can($this->actor(), 'activity', 'read');

        return response()->json($q->get()->map(function ($h) use ($canEval, $canAct) {
            $x = $h->toListItem();
            if (! $canEval) {
                $x['eval_sum'] = null;
                $x['eval_grade'] = null;
            }
            if (! $canAct) {
                $x['next_date'] = $x['next_todo'] = null;
                $x['follow'] = null;
            }

            return $x;
        })->values());
    }

    public function show(Hospital $hospital)
    {
        $me = $this->actor();
        Perm::need($me, 'hospital', 'read');
        $hospital->load(['categories:id', 'shots']);
        $d = $hospital->toDetail();
        $d['can_eval_stage'] = HS::canEvalStage($hospital);
        if (! Perm::can($me, 'eval', 'read')) {
            unset($d['eval']);
            $d['eval_sum'] = $d['eval_grade'] = null;
        }
        if (! Perm::can($me, 'conv', 'read')) {
            foreach (['signup_date', 'usage_count', 'last_used_date', 'conv_note'] as $k) {
                unset($d[$k]);
            }
        }
        if (Perm::can($me, 'activity', 'read')) {
            $d['activities'] = $hospital->activities()->with('author:id,name')->orderByDesc('date')->orderByDesc('id')->get()->map->toPublic();
            $d['stage_history'] = $hospital->stageHistory()->orderByDesc('date')->orderByDesc('id')->get(['id', 'date', 'from_stage', 'to_stage', 'auto', 'changed_by']);
        } else {
            unset($d['next_date'], $d['next_todo'], $d['next_done'], $d['follow']);
        }
        // 화면에서 버튼을 정할 때 쓰는 이 병원 기준 권한
        $d['can'] = [];
        foreach (['hospital', 'eval', 'activity', 'conv'] as $f) {
            foreach (['create', 'update', 'delete'] as $op) {
                $d['can'][$f][$op] = Perm::can($me, $f, $op, $hospital);
            }
        }

        return response()->json($d);
    }

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'zip' => 'nullable|string|max:10',
            'address' => 'required|string|max:200',
            'jibun' => 'nullable|string|max:200',
            'address_detail' => 'nullable|string|max:100',
            'sido' => 'nullable|string|max:20',
            'sigungu' => 'nullable|string|max:30',
            'grade' => 'nullable|string|max:20',
            'specialty' => 'nullable|string|max:40',
            'phone' => 'nullable|string|max:20',
            'director' => 'nullable|string|max:40',
            'director_phone' => 'nullable|string|max:20',
            'vet_count' => 'nullable|integer|min:0|max:999',
            'owner_id' => 'nullable|exists:users,id',
            'competitor_id' => 'nullable|exists:competitors,id',
            'competitor_until' => 'nullable|date',
            'pre_type' => ['nullable', Rule::in(array_keys(config('crm.pre_types')))],
            'sources' => 'nullable|array',
            'sources.*' => [Rule::in(config('crm.lead_sources'))],
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:categories,id',
            'memo' => 'nullable|string|max:2000',
        ];
    }

    private function fillBasic(Hospital $h, array $data, bool $addressChanged): void
    {
        $h->fill(collect($data)->only(['name', 'zip', 'address', 'jibun', 'address_detail', 'sido', 'sigungu', 'grade', 'specialty', 'director', 'vet_count', 'owner_id', 'competitor_id', 'competitor_until', 'pre_type', 'memo'])->all());
        $h->phone = $this->phone($data['phone'] ?? null);
        $h->director_phone = $this->phone($data['director_phone'] ?? null);
        $h->sources = array_values(array_unique($data['sources'] ?? []));
        if ($addressChanged) {
            $geo = Geo::lookup($h->address);
            $h->lat = $geo['lat'] ?? null;
            $h->lng = $geo['lng'] ?? null;
        }
    }

    public function store(Request $r)
    {
        $me = $this->actor();
        Perm::need($me, 'hospital', 'create');
        $data = $r->validate($this->rules());
        if (Perm::scope($me) === 'own') {
            $data['owner_id'] = $me->id;
        }
        $stage = Stage::initial();
        if (! $stage) {
            return $this->fail('영업 단계가 없습니다. 설정에서 단계를 먼저 만드세요');
        }
        $h = DB::transaction(function () use ($data, $me, $stage) {
            $h = new Hospital(['stage_id' => $stage->id, 'created_by' => $me->id, 'pre_type' => $data['pre_type'] ?? 'call']);
            $this->fillBasic($h, $data + ['owner_id' => $data['owner_id'] ?? $me->id], true);
            $h->pre_type ??= 'call';
            $h->save();
            HS::nextCode($h);
            $h->categories()->sync($data['category_ids'] ?? []);
            $snap = HS::snapshot($h->fresh(), '기본 정보');
            Audit::log('hospital', $h->id, $h->name, 'create', '병원 등록', Audit::diff([], $snap + ['stage' => ['현재 단계', $stage->name]]), $h->id);

            return $h;
        });

        return response()->json($h->fresh()->load('categories:id')->toListItem(), 201);
    }

    public function update(Request $r, Hospital $hospital)
    {
        Perm::need($this->actor(), 'hospital', 'update', $hospital);
        $data = $r->validate($this->rules());
        if (Perm::scope($this->actor()) === 'own') {
            $data['owner_id'] = $hospital->owner_id;
        }
        HS::mutate($hospital, '기본 정보', function (Hospital $h) use ($data) {
            $this->fillBasic($h, $data, $h->address !== $data['address']);
            $h->save();
            $h->categories()->sync($data['category_ids'] ?? []);
        });

        return $this->show($hospital->fresh());
    }

    public function destroy(Hospital $hospital)
    {
        Perm::need($this->actor(), 'hospital', 'delete', $hospital);
        $hospital->forceFill(['deleted_at' => now(), 'deleted_by' => $this->actor()->id])->save();
        Audit::log('hospital', $hospital->id, $hospital->name, 'delete', '병원 상태', [['field' => '상태', 'before' => '정상', 'after' => '삭제됨']], $hospital->id);

        return response()->json(['ok' => true]);
    }

    public function restore(int $id)
    {
        $h = Hospital::findOrFail($id);
        Perm::need($this->actor(), 'hospital', 'delete', $h);
        $h->forceFill(['deleted_at' => null, 'deleted_by' => null])->save();
        Audit::log('hospital', $h->id, $h->name, 'restore', '병원 상태', [['field' => '상태', 'before' => '삭제됨', 'after' => '정상']], $h->id);

        return response()->json(['ok' => true]);
    }

    public function stage(Request $r, Hospital $hospital)
    {
        Perm::need($this->actor(), 'hospital', 'update', $hospital);
        $data = $r->validate(['stage_id' => 'required|exists:stages,id']);
        HS::mutate($hospital, '영업 단계', fn ($h) => HS::setStage($h, Stage::find($data['stage_id'])));

        return $this->show($hospital->fresh());
    }

    // ---------- 리드 평가 ----------
    public function saveEval(Request $r, Hospital $hospital)
    {
        $me = $this->actor();
        $has = $hospital->evalCount() > 0 || $hospital->shots()->exists();
        Perm::need($me, 'eval', $has ? 'update' : 'create', $hospital);
        if (! HS::canEvalStage($hospital)) {
            return $this->fail('리드 평가는 1차 방문 이후에 할 수 있습니다');
        }
        $lv = 'nullable|integer|min:0|max:'.config('crm.eval_max');
        $data = $r->validate(['adoption' => $lv, 'favor' => $lv, 'surgeries' => $lv, 'surgery_count' => 'nullable|integer|min:0|max:100000']);
        HS::mutate($hospital, '리드 평가', function (Hospital $h) use ($data) {
            $h->forceFill([
                'eval_adoption' => $data['adoption'] ?? null, 'eval_favor' => $data['favor'] ?? null,
                'eval_surgeries' => $data['surgeries'] ?? null, 'eval_surgery_count' => $data['surgery_count'] ?? null,
                'eval_date' => now()->toDateString(),
            ])->save();
        }, $has ? 'update' : 'create');

        return $this->show($hospital->fresh());
    }

    public function deleteEval(Hospital $hospital)
    {
        Perm::need($this->actor(), 'eval', 'delete', $hospital);
        HS::mutate($hospital, '리드 평가', function (Hospital $h) {
            foreach ($h->shots as $s) {
                \Illuminate\Support\Facades\Storage::disk('local')->delete($s->path);
                $s->delete();
            }
            $h->forceFill(['eval_adoption' => null, 'eval_favor' => null, 'eval_surgeries' => null, 'eval_surgery_count' => null, 'eval_date' => null])->save();
        }, 'delete');

        return $this->show($hospital->fresh());
    }

    // ---------- 다음 액션 ----------
    public function saveNext(Request $r, Hospital $hospital)
    {
        $has = $hospital->next_date || $hospital->next_todo;
        Perm::need($this->actor(), 'activity', $has ? 'update' : 'create', $hospital);
        $data = $r->validate(['next_date' => 'nullable|date', 'next_todo' => 'nullable|string|max:200', 'next_done' => 'boolean']);
        HS::mutate($hospital, '다음 액션', fn ($h) => $h->forceFill([
            'next_date' => $data['next_date'] ?? null, 'next_todo' => $data['next_todo'] ?? null, 'next_done' => (bool) ($data['next_done'] ?? false),
        ])->save());

        return $this->show($hospital->fresh());
    }

    public function clearNext(Hospital $hospital)
    {
        Perm::need($this->actor(), 'activity', 'delete', $hospital);
        HS::mutate($hospital, '다음 액션', fn ($h) => $h->forceFill(['next_date' => null, 'next_todo' => null, 'next_done' => false])->save(), 'delete');

        return $this->show($hospital->fresh());
    }

    // ---------- 전환·사용 ----------
    public function saveConv(Request $r, Hospital $hospital)
    {
        $has = $hospital->signup_date || $hospital->usage_count || $hospital->last_used_date || $hospital->conv_note;
        Perm::need($this->actor(), 'conv', $has ? 'update' : 'create', $hospital);
        $data = $r->validate(['signup_date' => 'nullable|date', 'usage_count' => 'nullable|integer|min:0', 'last_used_date' => 'nullable|date', 'conv_note' => 'nullable|string|max:2000']);
        $moved = null;
        HS::mutate($hospital, '전환·사용', function (Hospital $h) use ($data, &$moved) {
            $h->forceFill(['signup_date' => $data['signup_date'] ?? null, 'usage_count' => (int) ($data['usage_count'] ?? 0), 'last_used_date' => $data['last_used_date'] ?? null, 'conv_note' => $data['conv_note'] ?? null])->save();
            $moved = HS::autoAdvance($h);
        });

        return response()->json(['hospital' => $this->show($hospital->fresh())->getData(), 'stage_moved' => $moved]);
    }

    // ---------- 병원 변경 이력 ----------
    public function timeline(Hospital $hospital)
    {
        Perm::need($this->actor(), 'history', 'read');

        return response()->json(AuditLog::query()->where('hospital_id', $hospital->id)->orderByDesc('at')->orderByDesc('id')->limit(500)->get()->map->toPublic());
    }
}
