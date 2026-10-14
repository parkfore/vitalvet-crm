<?php

namespace App\Services;

use App\Models\Hospital;
use App\Models\Stage;
use App\Models\StageHistory;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Support\Facades\Auth;

class HospitalService
{
    /** 변경 이력용 스냅샷: key => [라벨, 화면에 보일 값] */
    public static function snapshot(Hospital $h, ?string $section = null): array
    {
        $h->loadMissing(['stage', 'owner', 'categories', 'shots']);
        $pt = fn ($v) => $v === null ? '' : "{$v}점";
        $pre = config('crm.pre_types');
        $date = fn ($d) => $d ? $d->toDateString() : '';
        $all = [
            '기본 정보' => [
                'name' => ['병원명', $h->name],
                'address' => ['주소', $h->address ? trim("({$h->zip}) {$h->address}") : ''],
                'address_detail' => ['상세주소', $h->address_detail],
                'grade' => ['병원 등급', $h->grade],
                'specialty' => ['전문과', $h->specialty],
                'phone' => ['대표 전화', $h->phone],
                'director' => ['원장님 이름', $h->director],
                'director_phone' => ['원장님 연락처', $h->director_phone],
                'vet_count' => ['봉직수의사 수', $h->vet_count === null ? '' : (string) $h->vet_count],
                'owner' => ['담당 영업사원', $h->owner?->name],
                'competitor' => ['사용 중인 경쟁 제품', $h->competitor_id ? \App\Models\Competitor::find($h->competitor_id)?->name : ''],
                'competitor_until' => ['경쟁 제품 계약 만료일', $date($h->competitor_until)],
                'pre_type' => ['미접촉 예정 구분', $pre[$h->pre_type][0] ?? ''],
                'sources' => ['접촉 경로', implode(', ', $h->sources ?? [])],
                'memo' => ['메모', $h->memo],
                'categories' => ['카테고리', $h->categories->pluck('name')->sort()->implode(', ') ?: '미분류'],
            ],
            '영업 단계' => [
                'stage' => ['현재 단계', $h->stage?->name],
            ],
            '리드 평가' => [
                'eval_adoption' => ['디지털 수용도', $pt($h->eval_adoption)],
                'eval_shots' => ['디지털 수용도 근거 이미지', $h->shots->count() ? $h->shots->count().'장' : ''],
                'eval_favor' => ['서비스 호감도', $pt($h->eval_favor)],
                'eval_surgeries' => ['월 마취 건수', $pt($h->eval_surgeries)],
                'eval_surgery_count' => ['실제 월 마취 건수', $h->eval_surgery_count === null ? '' : (string) $h->eval_surgery_count],
                'eval_grade' => ['리드 종합 등급', $h->evalSum() === null ? '미평가' : $h->evalGrade().' ('.$h->evalSum().'/15점)'],
            ],
            '다음 액션' => [
                'next_date' => ['다음 액션일', $date($h->next_date)],
                'next_todo' => ['팔로우업 할 사항', $h->next_todo],
                'next_done' => ['팔로우업 처리', $h->next_date ? ($h->next_done ? '완료' : '미완료') : ''],
            ],
            '전환·사용' => [
                'signup_date' => ['회원가입일', $date($h->signup_date)],
                'usage_count' => ['VitalVET 누적 사용 건수', $h->usage_count ? (string) $h->usage_count : ''],
                'last_used_date' => ['최근 사용일', $date($h->last_used_date)],
                'conv_note' => ['비고', $h->conv_note],
            ],
        ];

        return $section ? $all[$section] : array_merge(...array_values($all));
    }

    /**
     * 변경을 적용하고 변경 이력을 남긴다.
     *
     * @param  callable(Hospital):void  $fn
     */
    public static function mutate(Hospital $h, string $section, callable $fn, string $action = 'update', ?string $summary = null): array
    {
        $before = self::snapshot($h);
        $fn($h);
        $h->refresh();
        $h->unsetRelations();
        $after = self::snapshot($h);
        $changes = Audit::diff($before, $after);
        if ($changes || $summary) {
            Audit::log('hospital', $h->id, $h->name, $action, $section, $changes, $h->id, $summary);
        }

        return $changes;
    }

    public static function setStage(Hospital $h, Stage $to, bool $auto = false): void
    {
        if ((int) $h->stage_id === (int) $to->id) {
            return;
        }
        $from = $h->stage?->name ?? Stage::find($h->stage_id)?->name;
        $h->stage_id = $to->id;
        $h->save();
        StageHistory::create([
            'hospital_id' => $h->id, 'date' => now()->toDateString(), 'from_stage' => $from, 'to_stage' => $to->name,
            'changed_by' => Auth::id(), 'auto' => $auto,
        ]);
        $h->unsetRelation('stage');
    }

    /**
     * 자동 단계 전환: 앞으로만 진행, 이탈 단계면 그대로.
     * 첫 접촉 → contact, 첫 방문 → visit1, 두 번째 방문 → visit2, 회원가입일 → signup, 사용 건수 → use
     */
    public static function autoAdvance(Hospital $h): ?string
    {
        $main = Stage::query()->where('kind', 'main')->orderBy('sort')->orderBy('id')->get()->values();
        $cur = $main->search(fn ($s) => (int) $s->id === (int) $h->stage_id);
        if ($cur === false) {
            return null;
        }
        $visits = $h->activities()->where('type', '방문')->count();
        $hasAct = $h->activities()->exists();
        $cands = array_filter([
            $hasAct ? 'contact' : null,
            $visits >= 1 ? 'visit1' : null,
            $visits >= 2 ? 'visit2' : null,
            $h->signup_date ? 'signup' : null,
            (int) $h->usage_count > 0 ? 'use' : null,
        ]);
        $best = null;
        $bestIdx = $cur;
        foreach ($main as $i => $s) {
            if ($s->trigger && in_array($s->trigger, $cands, true) && $i > $bestIdx) {
                $best = $s;
                $bestIdx = $i;
            }
        }
        if (! $best) {
            return null;
        }
        self::setStage($h, $best, true);

        return $best->name;
    }

    /** 리드 평가는 1차 방문(visit1 조건 단계) 이후에만. 이탈 단계는 방문 기록이 있으면 허용 */
    public static function canEvalStage(Hospital $h): bool
    {
        $stage = $h->stage ?? Stage::find($h->stage_id);
        if (! $stage) {
            return false;
        }
        if ($stage->kind === 'exit') {
            return $h->activities()->where('type', '방문')->exists();
        }
        $main = Stage::query()->where('kind', 'main')->orderBy('sort')->orderBy('id')->pluck('id')->values();
        $visit1 = Stage::query()->where('trigger', 'visit1')->where('kind', 'main')->value('id');
        $evalIdx = $visit1 ? $main->search($visit1) : 2;

        return $main->search($stage->id) >= $evalIdx;
    }

    public static function nextCode(Hospital $h): void
    {
        $h->code = 'VV-'.str_pad((string) $h->id, 4, '0', STR_PAD_LEFT);
        $h->saveQuietly();
    }

    public static function ownerName(?int $id): ?string
    {
        return $id ? User::find($id)?->name : null;
    }
}
