<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Hospital;
use App\Services\HospitalService as HS;
use App\Support\Audit;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ActivityController extends Controller
{
    private function rules(): array
    {
        $c = config('crm');

        return [
            'type' => ['required', Rule::in($c['activity_types'])],
            'date' => 'required|date|before_or_equal:today',
            'purpose' => ['nullable', Rule::in($c['activity_purposes'])],
            'contact' => ['nullable', Rule::in($c['activity_contacts'])],
            'reaction' => ['nullable', Rule::in($c['activity_reactions'])],
            'note' => 'nullable|string|max:2000',
            // 보고서 항목 (선택)
            'voc_type' => ['nullable', Rule::in($c['voc_types'])],
            'voc_text' => 'nullable|string|max:500',
            'comp_id' => 'nullable|exists:competitors,id',
            'comp_text' => 'nullable|string|max:500',
            'issue_type' => ['nullable', Rule::in($c['issue_types'])],
            'issue_text' => 'nullable|string|max:500',
        ];
    }

    /** 내용이 없는 보고서 항목은 비운다 */
    private function clean(array $d): array
    {
        $t = fn ($k) => trim((string) ($d[$k] ?? '')) ?: null;
        $d['note'] = $t('note');
        $d['voc_text'] = $t('voc_text');
        $d['voc_type'] = $d['voc_text'] ? ($d['voc_type'] ?? config('crm.voc_types')[0]) : null;
        $d['comp_text'] = $t('comp_text');
        $d['comp_id'] = $d['comp_id'] ?? null;
        $d['issue_text'] = $t('issue_text');
        $d['issue_type'] = $d['issue_text'] ? ($d['issue_type'] ?? config('crm.issue_types')[0]) : null;

        return $d;
    }

    private function changes(?Activity $a): array
    {
        if (! $a) {
            return [];
        }
        $s = fn ($k, $l) => [$l, (string) ($a->$k ?? '')];

        return [
            'type' => $s('type', '유형'), 'date' => ['날짜', $a->date?->toDateString()], 'purpose' => $s('purpose', '목적'),
            'contact' => $s('contact', '면담자'), 'reaction' => $s('reaction', '반응'), 'note' => $s('note', '내용'),
            'voc' => ['고객의 소리', $a->voc_text ? "{$a->voc_type} · {$a->voc_text}" : ''],
            'comp' => ['경쟁사 언급', $a->comp_id || $a->comp_text ? trim(\App\Models\Competitor::find($a->comp_id)?->name.' · '.$a->comp_text, ' ·') : ''],
            'issue' => ['지원 요청', $a->issue_text ? "{$a->issue_type} · {$a->issue_text}" : ''],
        ];
    }

    public function store(Request $r, Hospital $hospital)
    {
        Perm::need($this->actor(), 'activity', 'create', $hospital);
        $data = $this->clean($r->validate($this->rules()));
        $a = $hospital->activities()->create($data + ['author_id' => $this->actor()->id]);
        Audit::log('hospital', $hospital->id, $hospital->name, 'create', '영업 활동', Audit::diff([], $this->changes($a->fresh())), $hospital->id);
        $moved = null;
        HS::mutate($hospital, '영업 단계', function ($h) use (&$moved) {
            $moved = HS::autoAdvance($h);
        });
        // 오늘 할 일 목록에서 기록한 경우: 다음 액션 완료 처리
        if ($r->boolean('complete_next') && $hospital->next_date && ! $hospital->next_done) {
            HS::mutate($hospital->fresh(), '다음 액션', fn ($h) => $h->forceFill(['next_done' => true])->save());
        }

        return response()->json(['activity' => $a->fresh()->load('author:id,name')->toPublic(), 'stage_moved' => $moved], 201);
    }

    public function update(Request $r, Activity $activity)
    {
        $h = $activity->hospital;
        Perm::need($this->actor(), 'activity', 'update', $h);
        $before = $this->changes($activity);
        $activity->update($this->clean($r->validate($this->rules())));
        $ch = Audit::diff($before, $this->changes($activity->fresh()));
        if ($ch) {
            Audit::log('hospital', $h->id, $h->name, 'update', '영업 활동', $ch, $h->id, $activity->date->toDateString().' 기록 수정');
        }
        $moved = null;
        HS::mutate($h, '영업 단계', function ($x) use (&$moved) {
            $moved = HS::autoAdvance($x);
        });

        return response()->json(['activity' => $activity->fresh()->load('author:id,name')->toPublic(), 'stage_moved' => $moved]);
    }

    public function destroy(Activity $activity)
    {
        $h = $activity->hospital;
        Perm::need($this->actor(), 'activity', 'delete', $h);
        $before = $this->changes($activity);
        $activity->delete();
        Audit::log('hospital', $h->id, $h->name, 'delete', '영업 활동', Audit::diff($before, []), $h->id);

        return response()->json(['ok' => true]);
    }
}
