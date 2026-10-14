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

        return ! ($rep && self::scope($u) === 'own' && ($rep['authorId'] ?? '') !== $u->id);
    }

    public static function canReview(User $u, ?array $rep): bool
    {
        return $rep && ($rep['authorId'] ?? '') !== $u->id && self::scope($u) === 'all' && self::canRep($u, 'update', $rep);
    }

    public static function canAtt(User $u, string $op, ?array $a = null): bool
    {
        if (! self::has($u, 'attendance', $op)) {
            return false;
        }

        return ! ($a && self::scope($u) === 'own' && ($a['userId'] ?? '') !== $u->id);
    }

    public static function attManager(User $u): bool
    {
        return self::canAtt($u, 'update') && self::scope($u) === 'all';
    }
}
