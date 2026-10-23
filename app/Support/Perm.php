<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * 권한 확인 (화면의 can()·canRep()·canAtt() 와 같은 규칙을 서버에서 다시 확인)
 */
class Perm
{
    private static array $roles = [];

    public static function forget(): void
    {
        self::$teams = null;
        self::$roles = [];
    }

    /** 역할 정보 {name, desc, scope, locked, perms} */
    public static function role(?User $u): ?array
    {
        if (! $u || ! $u->role_id) {
            return null;
        }
        if (! array_key_exists($u->role_id, self::$roles)) {
            $row = DB::table('roles')->where('id', $u->role_id)->first();
            $r = $row ? json_decode($row->data, true) : null;
            if ($r && $u->role_id === config('crm.admin_role')) {
                $r['perms'] = self::fullPerms();
                $r['scope'] = 'all';
            }
            self::$roles[$u->role_id] = $r;
        }

        return self::$roles[$u->role_id];
    }

    public static function fullPerms(): array
    {
        $p = [];
        foreach (config('crm.features') as $f => $ops) {
            $p[$f] = array_fill_keys($ops, true);
        }

        return $p;
    }

    public static function scope(User $u): string
    {
        return self::role($u)['scope'] ?? 'own';
    }

    /**
     * 사람 자료 범위 (보고서·팀 성과·근태·변경 이력·코칭·방문 기록·알림)
     * all: 모든 직원 · team: 같은 소속(팀)만 · self: 본인 것만. 관리자는 항상 all
     * (병원 '수정 범위'(scope)와는 따로 정한다)
     */
    public static function people(User $u): string
    {
        if ($u->role_id === config('crm.admin_role')) {
            return 'all';
        }
        $r = self::role($u) ?? [];
        $p = $r['people'] ?? (($r['scope'] ?? 'own') === 'own' ? 'self' : 'team');

        return in_array($p, ['all', 'team', 'self'], true) ? $p : 'self';
    }

    /** 수동 체크인 (현재 위치 없이 방문 시각을 직접 입력): 역할의 '수동 체크인 허용'. 관리자는 항상 가능 */
    public static function manualCheckin(User $u): bool
    {
        if ($u->role_id === config('crm.admin_role')) {
            return true;
        }

        return (bool) (self::role($u)['manualCheckin'] ?? false);
    }

    private static ?array $teams = null;

    public static function teamOf(?string $uid): string
    {
        self::$teams ??= DB::table('users')->get(['id', 'data'])->mapWithKeys(fn ($r) => [$r->id => trim((string) ((json_decode($r->data, true) ?: [])['team'] ?? ''))])->all();

        return self::$teams[$uid ?? ''] ?? '';
    }

    /** 이 사람(other)의 자료를 볼 수 있는 범위 안인지 (본인·같은 팀·전체 범위) */
    public static function sameTeam(User $u, ?string $other): bool
    {
        if (! $other || $other === $u->id || self::people($u) === 'all') {
            return true;
        }
        if (self::people($u) === 'self') {
            return false;
        }
        $t = self::teamOf($u->id);

        return $t !== '' && $t === self::teamOf($other);
    }

    public static function has(User $u, string $f, string $op): bool
    {
        return (bool) (self::role($u)['perms'][$f][$op] ?? false);
    }

    /** can(f, op, h): 병원 h 가 주어지면 삭제 상태·담당 범위까지 확인 */
    public static function can(User $u, string $f, string $op, ?array $h = null): bool
    {
        if (! $u->isActive() || ! self::has($u, $f, $op)) {
            return false;
        }
        if ($h && $op !== 'view' && $op !== 'read') {
            if (! empty($h['deletedAt']) && ! ($f === 'hospital' && $op === 'delete')) {
                return false;
            }
            if (self::scope($u) === 'own' && in_array($f, config('crm.scoped'), true) && ($h['ownerId'] ?? '') !== $u->id) {
                return false;
            }
        }

        return true;
    }

    public static function canRead(User $u, string $f): bool
    {
        return self::can($u, $f, 'view') && self::can($u, $f, 'read');
    }

    public static function canRep(User $u, string $op, ?array $rep = null): bool
    {
        if (! self::has($u, 'report', $op)) {
            return false;
        }

        return ! ($rep && ! self::sameTeam($u, $rep['authorId'] ?? ''));
    }

    public static function canReview(User $u, ?array $rep): bool
    {
        return $rep && ($rep['authorId'] ?? '') !== $u->id && self::people($u) !== 'self' && self::canRep($u, 'update', $rep);
    }

    public static function canAtt(User $u, string $op, ?array $a = null): bool
    {
        if (! self::has($u, 'attendance', $op)) {
            return false;
        }

        return ! ($a && ! self::sameTeam($u, $a['userId'] ?? ''));
    }

    public static function attManager(User $u): bool
    {
        return self::canAtt($u, 'update') && self::people($u) !== 'self';
    }
}
