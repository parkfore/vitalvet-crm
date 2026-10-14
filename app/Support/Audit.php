<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

/** 변경 이력 기록. 모든 저장·삭제·복원은 같은 요청 안에서 여기로 기록한다. */
class Audit
{
    /**
     * @param  array<int, array{field:string, before:?string, after:?string}>  $changes
     */
    public static function log(string $entity, int|string $entityId, ?string $targetName, string $action, ?string $section, array $changes = [], ?int $hospitalId = null, ?string $summary = null): void
    {
        $u = Auth::user();
        AuditLog::create([
            'at' => now(),
            'actor_id' => $u?->id,
            'actor_name' => $u?->name,
            'entity' => $entity,
            'entity_id' => (string) $entityId,
            'hospital_id' => $hospitalId,
            'target_name' => $targetName,
            'action' => $action,
            'section' => $section,
            'summary' => $summary,
            'changes' => array_values($changes),
        ]);
    }

    /**
     * 두 스냅샷의 차이 [{field, before, after}]
     *
     * @param  array<string, array{0:string,1:?string}>  $before  key => [라벨, 값]
     * @param  array<string, array{0:string,1:?string}>  $after
     */
    public static function diff(array $before, array $after): array
    {
        $out = [];
        foreach ($after + $before as $k => $_) {
            $b = $before[$k][1] ?? '';
            $a = $after[$k][1] ?? '';
            if ((string) $b !== (string) $a) {
                $out[] = ['field' => $after[$k][0] ?? $before[$k][0], 'before' => (string) $b, 'after' => (string) $a];
            }
        }

        return $out;
    }
}
