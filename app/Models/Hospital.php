<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Hospital extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'sources' => 'array',
            'next_done' => 'boolean',
            'lat' => 'float',
            'lng' => 'float',
            'next_date' => 'date:Y-m-d',
            'eval_date' => 'date:Y-m-d',
            'signup_date' => 'date:Y-m-d',
            'last_used_date' => 'date:Y-m-d',
            'competitor_until' => 'date:Y-m-d',
            'deleted_at' => 'datetime',
        ];
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    public function shots(): HasMany
    {
        return $this->hasMany(EvalShot::class);
    }

    public function stageHistory(): HasMany
    {
        return $this->hasMany(StageHistory::class);
    }

    public function scopeAlive($q)
    {
        return $q->whereNull('deleted_at');
    }

    /** 리드 평가 합계 (3항목 모두 입력됐을 때만, 3~9) */
    public function evalSum(): ?int
    {
        if ($this->eval_adoption === null || $this->eval_favor === null || $this->eval_surgeries === null) {
            return null;
        }

        return (int) $this->eval_adoption + (int) $this->eval_favor + (int) $this->eval_surgeries;
    }

    /** 리드 종합 등급: 7~9 상 / 5~6 중 / 3~4 하 / 미평가 */
    public static function gradeFromSum(?int $sum): string
    {
        return match (true) {
            $sum === null => '미평가',
            $sum >= 7 => '상',
            $sum >= 5 => '중',
            default => '하',
        };
    }

    public function evalGrade(): string
    {
        return static::gradeFromSum($this->evalSum());
    }

    public function evalCount(): int
    {
        return ($this->eval_adoption !== null ? 1 : 0) + ($this->eval_favor !== null ? 1 : 0) + ($this->eval_surgeries !== null ? 1 : 0);
    }

    /** 팔로우업 상태: 지연 · 오늘 · 예정 · 완료 · 없음 */
    public function followStatus(?string $today = null): string
    {
        $today ??= now()->toDateString();
        if (! $this->next_date) {
            return '없음';
        }
        if ($this->next_done) {
            return '완료';
        }
        $d = $this->next_date->toDateString();

        return $d < $today ? '지연' : ($d === $today ? '오늘' : '예정');
    }

    /** 목록용 */
    public function toListItem(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'address' => $this->address,
            'sido' => $this->sido,
            'sigungu' => $this->sigungu,
            'grade' => $this->grade,
            'specialty' => $this->specialty,
            'director' => $this->director,
            'phone' => $this->phone,
            'owner_id' => $this->owner_id,
            'stage_id' => $this->stage_id,
            'pre_type' => $this->pre_type,
            'sources' => $this->sources ?? [],
            'category_ids' => $this->categories->pluck('id')->all(),
            'eval_sum' => $this->evalSum(),
            'eval_grade' => $this->evalGrade(),
            'next_date' => $this->next_date?->toDateString(),
            'next_todo' => $this->next_todo,
            'follow' => $this->followStatus(),
            'lat' => $this->lat,
            'lng' => $this->lng,
            'deleted_at' => $this->deleted_at?->toDateString(),
            'created_at' => $this->created_at?->toDateString(),
        ];
    }

    /** 상세용 */
    public function toDetail(): array
    {
        return $this->toListItem() + [
            'zip' => $this->zip,
            'jibun' => $this->jibun,
            'address_detail' => $this->address_detail,
            'director_phone' => $this->director_phone,
            'vet_count' => $this->vet_count,
            'competitor_id' => $this->competitor_id,
            'competitor_until' => $this->competitor_until?->toDateString(),
            'eval' => [
                'adoption' => $this->eval_adoption,
                'favor' => $this->eval_favor,
                'surgeries' => $this->eval_surgeries,
                'surgery_count' => $this->eval_surgery_count,
                'date' => $this->eval_date?->toDateString(),
                'shots' => $this->shots->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'url' => "/api/shots/{$s->id}"])->values()->all(),
            ],
            'next_done' => $this->next_done,
            'signup_date' => $this->signup_date?->toDateString(),
            'usage_count' => $this->usage_count,
            'last_used_date' => $this->last_used_date?->toDateString(),
            'conv_note' => $this->conv_note,
            'memo' => $this->memo,
            'created_by' => $this->created_by,
            'deleted_by' => $this->deleted_by,
        ];
    }
}
