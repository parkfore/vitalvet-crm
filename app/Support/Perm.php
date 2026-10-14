<?php

namespace App\Support;

use App\Models\Hospital;
use App\Models\User;

/**
 * 권한 = 역할 × 기능 × 동작, 그리고 역할의 범위(all / own).
 * 모든 API는 이 클래스로 서버에서 다시 검사한다. 화면에서 버튼을 숨기는 것은 편의일 뿐이다.
 */
class Perm
{
    public static function features(): array
    {
        return config('crm.features');
    }

    /** 관리자용 전체 권한 */
    public static function full(): array
    {
        $out = [];
        foreach (self::features() as $key => [, $ops]) {
            foreach (config('crm.ops') as $op) {
                $out[$key][$op] = in_array($op, $ops, true);
            }
        }

        return $out;
    }

    /**
     * 의존 규칙 적용:
     * - 입력·수정·삭제를 켜면 표시·읽기도 켬
     * - 읽기가 꺼지면 입력·수정·삭제도 끔
     * - 표시가 꺼지면 전부 끔
     * - 기능에 없는 동작은 항상 끔
     */
    public static function normalize(array $perms): array
    {
        $out = [];
        foreach (self::features() as $key => [, $ops]) {
            $p = [];
            foreach (config('crm.ops') as $op) {
                $p[$op] = in_array($op, $ops, true) && ! empty($perms[$key][$op]);
            }
            if ($p['create'] || $p['update'] || $p['delete']) {
                $p['view'] = $p['read'] = true;
            }
            if ($p['read']) {
                $p['view'] = true;
            }
            if (! $p['view']) {
                $p = array_fill_keys(config('crm.ops'), false);
            }
            $out[$key] = $p;
        }

        return $out;
    }

    /** 'VRCUD' 같은 짧은 표기를 권한 배열로 */
    public static function fromSpec(array|string $spec): array
    {
        if ($spec === '*') {
            return self::full();
        }
        $map = ['V' => 'view', 'R' => 'read', 'C' => 'create', 'U' => 'update', 'D' => 'delete'];
        $out = [];
        foreach (self::features() as $key => $_) {
            $letters = $spec[$key] ?? $spec['*'] ?? '';
            foreach ($map as $l => $op) {
                $out[$key][$op] = str_contains($letters, $l);
            }
        }

        return self::normalize($out);
    }

    public static function of(?User $u): array
    {
        if (! $u || ! $u->isActive() || ! $u->role) {
            return self::normalize([]);
        }

        return $u->role->effective();
    }

    public static function scope(?User $u): string
    {
        return $u?->role?->scope === 'own' ? 'own' : 'all';
    }

    public static function can(?User $u, string $feature, string $op, ?Hospital $h = null): bool
    {
        if (! $u || ! $u->isActive() || ! $u->role) {
            return false;
        }
        if ($u->role->locked) {
            return in_array($op, self::features()[$feature][1] ?? [], true);
        }
        if (empty(self::of($u)[$feature][$op])) {
            return false;
        }
        // 읽기는 범위와 관계없이 전체, 입력·수정·삭제만 담당 병원으로 제한
        if ($h && in_array($op, ['create', 'update', 'delete'], true)
            && self::scope($u) === 'own' && in_array($feature, config('crm.scoped'), true)) {
            return (int) $h->owner_id === (int) $u->id;
        }

        return true;
    }

    /** 권한이 없으면 403 */
    public static function need(?User $u, string $feature, string $op, ?Hospital $h = null): void
    {
        if (! self::can($u, $feature, $op, $h)) {
            $name = self::features()[$feature][0] ?? $feature;
            $opName = ['view' => '보기', 'read' => '읽기', 'create' => '입력', 'update' => '수정', 'delete' => '삭제'][$op] ?? $op;
            abort(response()->json([
                'code' => 'FORBIDDEN',
                'message' => $h && self::scope($u) === 'own' && in_array($feature, config('crm.scoped'), true) && ! empty(self::of($u)[$feature][$op])
                    ? '담당 병원만 '.$opName.'할 수 있습니다'
                    : "{$name} {$opName} 권한이 없습니다",
            ], 403));
        }
    }
}
