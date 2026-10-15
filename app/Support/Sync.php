<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * 화면에서 바뀐 내용 저장
 *
 * 화면은 저장할 때마다 바뀐 레코드의 '바꾸기 전(b)'과 '바꾼 뒤(a)'를 보낸다.
 * 서버는
 *   1) 바뀐 항목마다 권한을 확인하고 (화면과 같은 규칙: 기능 × 표시·읽기·입력·수정·삭제 × 담당 범위)
 *   2) 바뀐 항목만 현재 DB 값에 덮어쓴다 (다른 사람이 동시에 바꾼 다른 항목은 지켜진다)
 *   3) 변경 이력은 작성자·시각을 서버 기준으로 찍어 추가만 한다
 * 권한이 없는 변경이 하나라도 있으면 전체를 저장하지 않는다.
 */
class Sync
{
    private User $me;

    private array $role;

    // 같은 묶음 안에서 함께 일어난 일괄 변경 (예: 카테고리 삭제 → 병원들에서 빠짐)
    private array $stageRename = [];   // 옛 이름 => 새 이름

    private array $stageDeleted = [];  // 삭제된 단계 이름 => true

    private array $catDeleted = [];

    private array $codeChanged = ['grade' => [], 'specialty' => []]; // 옛 값 => 새 값('' 이면 삭제)

    private array $userDeleted = [];

    private array $compDeleted = [];

    private array $compRenamed = [];

    private array $touched = [];       // 컬렉션 => [id => true] (변경 이력 연결 확인용)

    private const BASIC = ['name', 'zip', 'address', 'jibun', 'addressDetail', 'sido', 'sigungu', 'lat', 'lng', 'grade', 'specialty', 'phone',
        'director', 'directorPhone', 'vetCount', 'ownerId', 'compId', 'compUntil', 'pre', 'sources', 'categoryIds', 'bizStatus', 'closedAt'];

    public function __construct(User $me)
    {
        $this->me = $me;
        $this->role = Perm::role($me) ?? [];
    }

    /** @return array{seq:int} */
    public function apply(array $in): array
    {
        $changes = $in['changes'] ?? [];
        $app = $in['app'] ?? [];
        $order = $in['order'] ?? [];
        $audit = $in['audit'] ?? [];
        if (! is_array($changes) || ! is_array($app) || ! is_array($order) || ! is_array($audit)) {
            throw new SyncError('저장 요청 형식이 올바르지 않습니다', 422);
        }

        DB::transaction(function () use ($changes, $app, $order, $audit) {
            // 순서: 기준 정보(단계·카테고리·경쟁사·사용자·역할·설정) → 병원 → 나머지 → 변경 이력
            $phase = ['stages' => 0, 'categories' => 0, 'competitors' => 0, 'users' => 0, 'roles' => 0,
                'hospitals' => 2, 'reports' => 3, 'attendance' => 3, 'todos' => 3, 'coaching' => 3];
            usort($changes, fn ($x, $y) => ($phase[$x['c'] ?? ''] ?? 9) <=> ($phase[$y['c'] ?? ''] ?? 9));

            foreach ($changes as $ch) {
                if (($phase[$ch['c'] ?? ''] ?? 9) === 0) {
                    $this->one($ch);
                }
            }
            foreach ($app as $key => $ba) {
                $this->appSetting((string) $key, $ba['b'] ?? null, $ba['a'] ?? null);
            }
            foreach ($order as $col => $ids) {
                $this->order((string) $col, (array) $ids);
            }
            $this->cascades();
            foreach ($changes as $ch) {
                if (($phase[$ch['c'] ?? ''] ?? 9) > 0) {
                    $this->one($ch);
                }
            }
            if ($audit) {
                if (! $this->touched) {
                    throw new SyncError('바뀐 내용이 없는 변경 이력은 남길 수 없습니다', 422);
                }
                foreach ($audit as $e) {
                    $this->audit((array) $e);
                }
            }
        });
        return ['seq' => Store::seq()];
    }

    /* ---------------- 공통 ---------------- */

    private function deny(string $msg): never
    {
        throw new SyncError($msg, 403, 'FORBIDDEN');
    }

    private function need(bool $ok, string $msg): void
    {
        if (! $ok) {
            $this->deny($msg);
        }
    }

    private const OPN = ['view' => '표시', 'read' => '읽기', 'create' => '입력', 'update' => '수정', 'delete' => '삭제'];

    private const FN = ['hospital' => '병원 기본 정보', 'eval' => '리드 평가', 'activity' => '영업 활동', 'conv' => '전환·사용', 'attendance' => '근태 일정',
        'report' => '영업 보고', 'category' => '카테고리', 'team' => '팀 성과', 'competitor' => '경쟁사', 'users' => '사용자·권한', 'settings' => '설정'];

    private function needCan(string $f, string $op, ?array $h = null): void
    {
        if (Perm::can($this->me, $f, $op, $h)) {
            return;
        }
        if ($h && ! empty($h['deletedAt']) && $f !== 'hospital') {
            $this->deny('삭제된 병원은 복원 전까지 수정할 수 없습니다');
        }
        if ($h && Perm::has($this->me, $f, $op) && Perm::scope($this->me) === 'own') {
            $this->deny('담당 병원만 수정할 수 있습니다');
        }
        $this->deny((self::FN[$f] ?? $f).' '.(self::OPN[$op] ?? $op).' 권한이 없습니다');
    }

    private static function norm($v)
    {
        if (is_array($v)) {
            ksort($v);

            return array_map([self::class, 'norm'], $v);
        }
        if (is_float($v) && floor($v) == $v && abs($v) < 1e15) {
            return (int) $v;
        }

        return $v;
    }

    public static function eq($x, $y): bool
    {
        return json_encode(self::norm($x), JSON_UNESCAPED_UNICODE) === json_encode(self::norm($y), JSON_UNESCAPED_UNICODE);
    }

    private static function emptyish($v): bool
    {
        return $v === null || $v === '' || $v === [] || $v === 0 || $v === '0' || $v === false;
    }

    /** b 와 a 에서 값이 다른 최상위 항목 */
    private static function delta(array $b, array $a): array
    {
        $keys = array_unique([...array_keys($b), ...array_keys($a)]);

        return array_values(array_filter($keys, fn ($k) => ! self::eq($b[$k] ?? null, $a[$k] ?? null)));
    }

    /** 바뀐 항목만 현재 값에 덮어쓴다 */
    private static function merge(array $cur, array $a, array $keys): array
    {
        foreach ($keys as $k) {
            if (array_key_exists($k, $a)) {
                $cur[$k] = $a[$k];
            } else {
                unset($cur[$k]);
            }
        }

        return $cur;
    }

    private function touch(string $col, string $id): void
    {
        $this->touched[$col][$id] = true;
    }

    private function one(array $ch): void
    {
        $col = (string) ($ch['c'] ?? '');
        $id = (string) ($ch['id'] ?? '');
        $b = isset($ch['b']) && is_array($ch['b']) ? $ch['b'] : null;
        $a = isset($ch['a']) && is_array($ch['a']) ? $ch['a'] : null;
        if ($id === '' || strlen($id) > 40 || ! preg_match('/^[A-Za-z0-9_\-]+$/', $id)) {
            throw new SyncError('잘못된 레코드 번호입니다', 422);
        }
        if ($a !== null) {
            $a['id'] = $id;
        }
        if ($b !== null) {
            $b['id'] = $id;
        }
        if ($col === 'users') {
            $this->user($id, $b, $a);
            $this->touch($col, $id);

            return;
        }
        if (! isset(Store::TABLES[$col])) {
            throw new SyncError('알 수 없는 데이터입니다: '.$col, 422);
        }
        $cur = Store::find($col, $id);

        // 같은 요청을 두 번 보낸 경우 (네트워크 재시도)는 그냥 통과
        if ($cur === null && $b !== null && $a === null) {
            $this->touch($col, $id);

            return;
        }
        if ($cur !== null && $b === null) {
            if ($a !== null && self::eq(self::strip($col, $cur), self::strip($col, $a))) {
                $this->touch($col, $id);

                return;
            }
            throw new SyncError('같은 번호의 자료가 이미 있습니다. 다른 사용자가 동시에 등록했을 수 있으니 새로고침 후 다시 해 주세요', 409, 'CONFLICT');
        }
        if ($cur === null && $b !== null) {
            throw new SyncError('다른 사용자가 이미 삭제한 자료입니다. 새로고침 후 다시 확인하세요', 409, 'CONFLICT');
        }

        $method = [
            'hospitals' => 'hospital', 'categories' => 'category', 'stages' => 'stage', 'roles' => 'roleRec', 'competitors' => 'competitor',
            'reports' => 'report', 'attendance' => 'attendance', 'todos' => 'todo', 'coaching' => 'coaching',
        ][$col];
        $this->{$method}($id, $cur, $b, $a);
        $this->touch($col, $id);
    }

    /** 비교용: 화면에만 있는 값 제거 */
    private static function strip(string $col, array $r): array
    {
        if ($col === 'hospitals' && is_array($r['eval'] ?? null)) {
            unset($r['eval']['shots']); // 예전 근거 이미지 항목 (삭제된 기능)
        }

        return $r;
    }

    /* ---------------- 병원 ---------------- */

    private function hospital(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        if ($a === null) {
            $this->deny('병원은 완전히 지울 수 없습니다. 삭제(삭제 목록으로 이동)를 사용하세요');
        }
        $creating = $cur === null;
        if ($creating) {
            if (! preg_match('/^VV-\d{4,}$/', $id)) {
                throw new SyncError('병원 번호 형식이 올바르지 않습니다', 422);
            }
            $this->needCan('hospital', 'create');
            if (Perm::scope($this->me) === 'own' && ($a['ownerId'] ?? '') !== $this->me->id) {
                $this->deny('담당 병원만 관리하는 역할은 본인 담당으로만 등록할 수 있습니다');
            }
            if (trim((string) ($a['name'] ?? '')) === '') {
                throw new SyncError('병원명을 입력하세요', 422);
            }
            $cur = $b = ['id' => $id, 'stageHistory' => [], 'eval' => [], 'activities' => [], 'next' => [], 'categoryIds' => [], 'sources' => [],
                'signupDate' => '', 'usageCount' => 0, 'lastUsedDate' => '', 'memo' => ''];
            $a['createdBy'] = $this->me->id;
        }
        $subject = $creating ? $a : $cur;
        $keys = self::delta($b, $a);
        $has = fn (array $ks) => (bool) array_intersect($keys, $ks);
        $autoAdvance = $has(['activities', ...Store::CONV_KEYS]);
        $set = [];

        foreach ($keys as $k) {
            if ($k === 'id') {
                continue;
            }
            if (in_array($k, ['createdAt', 'createdBy'], true)) {
                if ($creating) {
                    $set[] = $k;
                }

                continue;
            }
            if (in_array($k, self::BASIC, true)) {
                if ($creating) {
                    $set[] = $k;

                    continue;
                }
                if ($this->basicCascade($k, $b, $a)) {
                    $set[] = $k;

                    continue;
                }
                $this->needCan('hospital', 'update', $subject);
                if ($k === 'ownerId' && Perm::scope($this->me) === 'own') {
                    $this->deny('담당 병원만 관리하는 역할은 담당 영업사원을 바꿀 수 없습니다');
                }
                $set[] = $k;

                continue;
            }
            switch ($k) {
                case 'stage':
                case 'stageHistory':
                    $cascade = isset($this->stageRename[$b['stage'] ?? '']) || isset($this->stageDeleted[$b['stage'] ?? '']) || $this->stageRename;
                    if (! ($creating || Perm::can($this->me, 'hospital', 'update', $subject) || $autoAdvance
                        || ($cascade && Perm::can($this->me, 'settings', 'update')))) {
                        $this->needCan('hospital', 'update', $subject);
                    }
                    $set[] = $k;
                    break;
                case 'deletedAt':
                case 'deletedBy':
                    $this->needCan('hospital', 'delete', $subject);
                    $set[] = $k;
                    break;
                case 'eval':
                    $eb = (array) ($b['eval'] ?? []);
                    $ea = (array) ($a['eval'] ?? []);
                    $this->needCan('eval', ! $eb ? 'create' : (! $ea ? 'delete' : 'update'), $subject);
                    $set[] = $k;
                    break;
                case 'activities':
                    $this->checkActs((array) ($b['activities'] ?? []), (array) ($a['activities'] ?? []), $subject);
                    $set[] = $k;
                    break;
                case 'next':
                    $nb = array_filter((array) ($b['next'] ?? []), fn ($v, $kk) => $kk !== 'done' && ! self::emptyish($v), ARRAY_FILTER_USE_BOTH);
                    $na = array_filter((array) ($a['next'] ?? []), fn ($v, $kk) => $kk !== 'done' && ! self::emptyish($v), ARRAY_FILTER_USE_BOTH);
                    $this->needCan('activity', ! $nb ? 'create' : (! $na ? 'delete' : 'update'), $subject);
                    $set[] = $k;
                    break;
                default:
                    if (in_array($k, Store::CONV_KEYS, true)) {
                        $hb = collect(Store::CONV_KEYS)->contains(fn ($x) => ! self::emptyish($b[$x] ?? null));
                        $ha = collect(Store::CONV_KEYS)->contains(fn ($x) => ! self::emptyish($a[$x] ?? null));
                        $this->needCan('conv', ! $hb ? 'create' : (! $ha ? 'delete' : 'update'), $subject);
                    } else {
                        $this->needCan('hospital', $creating ? 'create' : 'update', $subject);
                    }
                    $set[] = $k;
            }
        }
        if (! $set && ! $creating) {
            return;
        }

        $new = $cur;
        foreach (array_unique($set) as $k) {
            switch ($k) {
                case 'activities':
                    $new['activities'] = $this->mergeActs((array) ($cur['activities'] ?? []), (array) ($b['activities'] ?? []), (array) ($a['activities'] ?? []));
                    break;
                case 'stageHistory':
                    $ren = fn ($x) => ['from' => $this->stageRename[$x['from'] ?? ''] ?? ($x['from'] ?? ''), 'to' => $this->stageRename[$x['to'] ?? ''] ?? ($x['to'] ?? '')] + $x;
                    $old = array_map(fn ($x) => json_encode(self::norm($ren($x)), JSON_UNESCAPED_UNICODE), (array) ($b['stageHistory'] ?? []));
                    $hist = (array) ($cur['stageHistory'] ?? []);
                    foreach ((array) ($a['stageHistory'] ?? []) as $x) {
                        if (! in_array(json_encode(self::norm($x), JSON_UNESCAPED_UNICODE), $old, true)) {
                            $hist[] = $x;
                        }
                    }
                    $new['stageHistory'] = array_values($hist);
                    break;
                case 'categoryIds':
                    $cb = (array) ($b['categoryIds'] ?? []);
                    $ca = (array) ($a['categoryIds'] ?? []);
                    $keep = array_diff((array) ($cur['categoryIds'] ?? []), array_diff($cb, $ca));
                    $new['categoryIds'] = array_values(array_unique([...$keep, ...array_diff($ca, $cb)]));
                    break;
                case 'eval':
                    $new['eval'] = array_diff_key((array) ($a['eval'] ?? []), ['shots' => 1]);
                    break;
                default:
                    $new = self::merge($new, $a, [$k]);
            }
        }
        if (in_array('phone', $set, true)) {
            Phone::check($new['phone'] ?? '', 'tel', '병원 대표 전화');
        }
        if (in_array('directorPhone', $set, true)) {
            Phone::check($new['directorPhone'] ?? '', 'mobile', '원장님 연락처');
        }
        if (! in_array((string) ($new['bizStatus'] ?? ''), ['', '영업', '휴업', '폐업'], true)) {
            throw new SyncError('영업 상태는 영업·휴업·폐업 중 하나여야 합니다', 422);
        }
        if (($new['closedAt'] ?? '') !== '' && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $new['closedAt'])) {
            throw new SyncError('폐업일 형식이 올바르지 않습니다', 422);
        }
        if (mb_strlen((string) ($new['name'] ?? '')) > 120) {
            throw new SyncError('병원명이 너무 깁니다', 422);
        }
        Store::put('hospitals', $new);
    }

    /** 다른 기준 정보 변경에 따른 일괄 반영인지 */
    private function basicCascade(string $k, array $b, array $a): bool
    {
        $can = fn ($f, $op) => Perm::can($this->me, $f, $op);
        switch ($k) {
            case 'grade':
            case 'specialty':
                $old = (string) ($b[$k] ?? '');

                return $old !== '' && array_key_exists($old, $this->codeChanged[$k]) && ($a[$k] ?? '') === $this->codeChanged[$k][$old] && $can('settings', 'update');
            case 'ownerId':
                return isset($this->userDeleted[$b['ownerId'] ?? '']) && ($a['ownerId'] ?? '') === '' && $can('users', 'delete');
            case 'compId':
            case 'compUntil':
                return isset($this->compDeleted[$b['compId'] ?? '']) && ($a['compId'] ?? '') === '' && $can('competitor', 'delete');
            case 'categoryIds':
                $cb = (array) ($b['categoryIds'] ?? []);
                $ca = (array) ($a['categoryIds'] ?? []);
                $removed = array_diff($cb, $ca);

                return ! array_diff($ca, $cb) && $removed && ! array_diff($removed, array_keys($this->catDeleted)) && $can('category', 'delete');
        }

        return false;
    }

    private static function byId(array $list): array
    {
        $o = [];
        foreach ($list as $x) {
            if (is_array($x) && isset($x['id'])) {
                $o[(string) $x['id']] = $x;
            }
        }

        return $o;
    }

    private function checkActs(array $b, array $a, array $h): void
    {
        $B = self::byId($b);
        $A = self::byId($a);
        foreach ($A as $id => $x) {
            if (! isset($B[$id])) {
                $this->needCan('activity', 'create', $h);
                if (($x['date'] ?? '') > now()->toDateString()) {
                    throw new SyncError('미래 날짜에는 활동을 기록할 수 없습니다', 422);
                }
            } elseif (! self::eq($B[$id], $x)) {
                $this->needCan('activity', 'update', $h);
            }
        }
        foreach ($B as $id => $x) {
            if (! isset($A[$id])) {
                $this->needCan('activity', 'delete', $h);
            }
        }
    }

    private function mergeActs(array $cur, array $b, array $a): array
    {
        $B = self::byId($b);
        $A = self::byId($a);
        $out = [];
        foreach ($cur as $x) {
            $id = (string) ($x['id'] ?? '');
            if (isset($B[$id]) && ! isset($A[$id])) {
                continue; // 삭제
            }
            if (isset($A[$id]) && isset($B[$id]) && ! self::eq($A[$id], $B[$id])) {
                $x = ['authorId' => $x['authorId'] ?? ''] + $A[$id]; // 수정 (작성자는 그대로)
            }
            $out[] = $x;
        }
        $have = self::byId($out);
        foreach ($A as $id => $x) {
            if (! isset($B[$id]) && ! isset($have[$id])) {
                $x['authorId'] = $this->me->id; // 새 기록은 로그인한 사람 이름으로
                $out[] = $x;
            }
        }

        return $out;
    }

    /* ---------------- 기준 정보 ---------------- */

    private function category(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        if ($a === null) {
            $this->needCan('category', 'delete');
            $this->catDeleted[$id] = true;
            Store::remove('categories', $id);

            return;
        }
        $this->needCan('category', $cur ? 'update' : 'create');
        $name = trim((string) ($a['name'] ?? ''));
        if ($name === '' || $name === '미분류' || mb_strlen($name) > 40) {
            throw new SyncError('카테고리 이름을 확인하세요', 422);
        }
        $rec = $cur ? self::merge($cur, $a, self::delta($b, $a)) : $a;
        Store::put('categories', $rec, $cur ? null : (int) DB::table('categories')->max('sort') + 1);
    }

    private function stage(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        $this->needCan('settings', 'update');
        if ($a === null) {
            $this->stageDeleted[$cur['name']] = true;
            Store::remove('stages', $id);

            return;
        }
        if (trim((string) ($a['name'] ?? '')) === '') {
            throw new SyncError('단계 이름을 입력하세요', 422);
        }
        if ($cur && ($cur['name'] ?? '') !== $a['name']) {
            $this->stageRename[$cur['name']] = $a['name'];
        }
        $rec = $cur ? self::merge($cur, $a, self::delta($b, $a)) : $a;
        Store::put('stages', $rec);
    }

    private function competitor(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        if ($a === null) {
            $this->needCan('competitor', 'delete');
            $this->compDeleted[$id] = true;
            Store::remove('competitors', $id);

            return;
        }
        $this->needCan('competitor', $cur ? 'update' : 'create');
        if (trim((string) ($a['name'] ?? '')) === '') {
            throw new SyncError('제품·서비스명을 입력하세요', 422);
        }
        if (! $cur) {
            $a['createdBy'] = $this->me->id;
        }
        $rec = $cur ? self::merge($cur, $a, self::delta($b, $a)) : $a;
        if (($rec['phone'] ?? '') !== (string) ($cur['phone'] ?? '')) {
            Phone::check($rec['phone'] ?? '', 'tel', '대표 전화');
        }
        if ($cur && ($cur['name'] ?? '') !== ($rec['name'] ?? '')) {
            $this->compRenamed[$id] = $rec['name'];
        }
        Store::put('competitors', $rec);
    }

    private function roleRec(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        if ($id === config('crm.admin_role') || ($cur['locked'] ?? false)) {
            $this->deny('관리자 역할은 바꿀 수 없습니다');
        }
        if ($a === null) {
            $this->needCan('users', 'delete');
            if (DB::table('users')->where('role_id', $id)->exists()) {
                $this->deny('사용 중인 역할은 삭제할 수 없습니다');
            }
            Store::remove('roles', $id);

            return;
        }
        $this->needCan('users', $cur ? 'update' : 'create');
        $rec = $cur ? self::merge($cur, $a, self::delta($b, $a)) : $a;
        unset($rec['locked']);
        $rec['scope'] = ($rec['scope'] ?? 'own') === 'all' ? 'all' : 'own';
        if (trim((string) ($rec['name'] ?? '')) === '') {
            throw new SyncError('역할 이름을 입력하세요', 422);
        }
        // 권한 표: 정해진 기능·동작만, 참/거짓으로
        $perms = [];
        foreach (config('crm.features') as $f => $ops) {
            foreach ($ops as $op) {
                $perms[$f][$op] = (bool) ($rec['perms'][$f][$op] ?? false);
            }
        }
        $rec['perms'] = $perms;
        Store::put('roles', $rec, $cur ? null : (int) DB::table('roles')->max('sort') + 1);
        Perm::forget();
    }

    private function order(string $col, array $ids): void
    {
        if (! in_array($col, Store::ORDERED, true)) {
            throw new SyncError('순서를 바꿀 수 없는 데이터입니다', 422);
        }
        $this->needCan(['stages' => 'settings', 'categories' => 'category', 'roles' => 'users'][$col], 'update');
        foreach (array_values($ids) as $i => $id) {
            DB::table($col)->where('id', (string) $id)->update(['sort' => $i]);
        }
        $this->touch($col, '_order');
    }

    private function appSetting(string $key, $b, $a): void
    {
        if (! in_array($key, ['settings', 'codes', 'holidays'], true) || ! is_array($a)) {
            throw new SyncError('알 수 없는 설정입니다', 422);
        }
        $cur = Store::setting($key, config('crm.'.$key));
        if ($key === 'holidays') {
            $this->need(Perm::attManager($this->me), '회사 휴일을 바꿀 권한이 없습니다');
            foreach ($a as $d => $n) {
                if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $d)) {
                    throw new SyncError('휴일 날짜 형식이 올바르지 않습니다', 422);
                }
            }
            $new = $cur;
            foreach (array_diff_key((array) $b, $a) as $d => $_) {
                unset($new[$d]);
            }
            foreach ($a as $d => $n) {
                if (! array_key_exists($d, (array) $b) || $b[$d] !== $n) {
                    $new[$d] = mb_substr((string) $n, 0, 40);
                }
            }
            ksort($new);
            Store::putSetting($key, $new);
        } elseif ($key === 'settings') {
            $this->needCan('settings', 'update');
            $new = self::merge(Store::settings(), $a, self::delta((array) $b, $a));
            Store::putSetting($key, [
                'visitGoal' => max(1, min(20, (int) ($new['visitGoal'] ?? 4))),
                'mapProvider' => ($new['mapProvider'] ?? '') === 'naver' ? 'naver' : 'kakao',
                'requiredFields' => array_values(array_unique(['name', 'address', ...array_intersect(config('crm.required_options'), (array) ($new['requiredFields'] ?? []))])),
            ]);
        } else {
            $this->needCan('settings', 'update');
            $new = Store::codes();
            // 소속: 이름을 바꾸거나 지우면 그 소속인 사용자도 함께 바꾼다
            $tb = array_values((array) ($b['teams'] ?? []));
            $ta = array_values((array) ($a['teams'] ?? $tb));
            if ($tb !== $ta) {
                $map = [];
                foreach ($tb as $i => $old) {
                    if (! in_array($old, $ta, true)) {
                        $map[$old] = count($ta) === count($tb) && isset($ta[$i]) && ! in_array($ta[$i], $tb, true) ? $ta[$i] : '';
                    }
                }
                $new['teams'] = array_values(array_unique(array_filter(array_map(fn ($v) => mb_substr(trim((string) $v), 0, 40), $ta))));
                foreach (DB::table('users')->get() as $u) {
                    $d = json_decode($u->data, true) ?: [];
                    if (array_key_exists($d['team'] ?? "\0", $map)) {
                        $d['team'] = $map[$d['team']];
                        DB::table('users')->where('id', $u->id)->update(['data' => json_encode($d, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
                    }
                }
            }
            foreach (['grades' => 'grade', 'specialties' => 'specialty'] as $list => $field) {
                $lb = array_values((array) ($b[$list] ?? []));
                $la = array_values((array) ($a[$list] ?? []));
                if ($lb === $la) {
                    continue;
                }
                foreach ($lb as $i => $old) {
                    if (! in_array($old, $la, true)) {
                        $this->codeChanged[$field][$old] = count($la) === count($lb) && isset($la[$i]) && ! in_array($la[$i], $lb, true) ? $la[$i] : '';
                    }
                }
                $new[$list] = array_values(array_unique(array_map(fn ($v) => mb_substr(trim((string) $v), 0, 40), $la)));
            }
            Store::putSetting($key, $new);
        }
        $this->touch('app', $key);
    }

    /** 기준 정보 변경을 모든 병원·보고서에 반영 (화면에 안 보이는 병원까지) */
    private function cascades(): void
    {
        $codes = array_filter($this->codeChanged);
        if (! ($this->stageRename || $this->catDeleted || $codes || $this->userDeleted || $this->compDeleted)) {
            if ($this->compRenamed) {
                $this->reportCascade();
            }

            return;
        }
        foreach (DB::table('hospitals')->lockForUpdate()->get() as $row) {
            $h = Store::decode($row);
            $orig = $h;
            if ($this->stageRename) {
                $h['stage'] = $this->stageRename[$h['stage'] ?? ''] ?? ($h['stage'] ?? '');
                foreach ($h['stageHistory'] ?? [] as $i => $x) {
                    $h['stageHistory'][$i]['from'] = $this->stageRename[$x['from'] ?? ''] ?? ($x['from'] ?? '');
                    $h['stageHistory'][$i]['to'] = $this->stageRename[$x['to'] ?? ''] ?? ($x['to'] ?? '');
                }
            }
            if ($this->catDeleted) {
                $h['categoryIds'] = array_values(array_filter($h['categoryIds'] ?? [], fn ($c) => ! isset($this->catDeleted[$c])));
            }
            foreach ($codes as $field => $map) {
                if (array_key_exists($h[$field] ?? '', $map)) {
                    $h[$field] = $map[$h[$field]];
                }
            }
            if (isset($this->userDeleted[$h['ownerId'] ?? ''])) {
                $h['ownerId'] = '';
            }
            if (isset($this->compDeleted[$h['compId'] ?? ''])) {
                $h['compId'] = '';
                $h['compUntil'] = '';
            }
            if (! self::eq($orig, $h)) {
                Store::put('hospitals', $h);
            }
        }
        $this->reportCascade();
    }

    private function reportCascade(): void
    {
        if (! $this->compDeleted && ! $this->compRenamed) {
            return;
        }
        foreach (DB::table('reports')->lockForUpdate()->get() as $row) {
            $r = Store::decode($row);
            $orig = $r;
            foreach ($r['comp'] ?? [] as $i => $x) {
                $cid = $x['competitorId'] ?? '';
                if (isset($this->compDeleted[$cid])) {
                    unset($r['comp'][$i]['competitorId']);
                } elseif (isset($this->compRenamed[$cid])) {
                    $r['comp'][$i]['name'] = $this->compRenamed[$cid];
                }
            }
            if (! self::eq($orig, $r)) {
                Store::put('reports', $r);
            }
        }
    }

    /* ---------------- 사용자 ---------------- */

    private function activeAdmins(?string $except = null): int
    {
        return DB::table('users')->where('role_id', config('crm.admin_role'))->where('status', 'active')
            ->when($except, fn ($q) => $q->where('id', '!=', $except))->count();
    }

    private function user(string $id, ?array $b, ?array $a): void
    {
        $u = User::query()->lockForUpdate()->find($id);
        if ($a === null) {
            if (! $u) {
                return;
            }
            $this->needCan('users', 'delete');
            if ($id === $this->me->id) {
                $this->deny('본인 계정은 삭제할 수 없습니다');
            }
            if ($u->role_id === config('crm.admin_role') && $this->activeAdmins($id) < 1) {
                $this->deny('마지막 관리자는 삭제할 수 없습니다');
            }
            $this->userDeleted[$id] = true;
            $u->delete();

            return;
        }
        $username = strtolower(trim((string) ($a['username'] ?? '')));
        $status = (string) ($a['status'] ?? 'pending');
        $roleId = (string) ($a['roleId'] ?? '');
        if (! in_array($status, ['active', 'inactive', 'pending'], true)) {
            throw new SyncError('상태 값이 올바르지 않습니다', 422);
        }
        if ($roleId !== '' && ! DB::table('roles')->where('id', $roleId)->exists()) {
            throw new SyncError('없는 역할입니다', 422);
        }
        if ($status === 'active' && $roleId === '') {
            throw new SyncError('활성 사용자는 역할이 있어야 합니다', 422);
        }
        if (! preg_match(User::USERNAME_REGEX, $username)) {
            throw new SyncError('아이디는 영문 소문자로 시작하고 영문 소문자·숫자·. _ - 로 4~30자여야 합니다', 422);
        }
        if (User::where('username', $username)->where('id', '!=', $id)->exists()) {
            throw new SyncError('이미 사용 중인 아이디입니다', 422);
        }
        $data = array_diff_key($a, array_flip(['id', 'username', 'status', 'roleId', 'password', 'email']));
        $data['name'] = trim((string) ($data['name'] ?? ''));
        if ($data['name'] === '' || mb_strlen($data['name']) > 40) {
            throw new SyncError('이름을 확인하세요', 422);
        }
        if (($data['phone'] ?? '') !== (string) ($b['phone'] ?? '')) {
            Phone::check($data['phone'] ?? '', 'mobile', '연락처');
        }
        if (! $u) {
            if ($b !== null) {
                throw new SyncError('다른 사용자가 이미 삭제한 계정입니다', 409, 'CONFLICT');
            }
            $this->needCan('users', 'create');
            User::create(['id' => $id, 'username' => $username, 'password' => Str::random(40), 'status' => $status, 'role_id' => $roleId ?: null, 'data' => $data]);

            return;
        }
        $keys = self::delta((array) $b, $a);
        if (! $keys) {
            return;
        }
        $this->needCan('users', 'update');
        $cur = $u->present();
        $new = self::merge($cur, $a, $keys);
        if ($id === $this->me->id && ($new['roleId'] !== $cur['roleId'] || $new['status'] !== $cur['status'])) {
            $this->deny('본인의 역할과 상태는 바꿀 수 없습니다');
        }
        $wasAdmin = $u->role_id === config('crm.admin_role') && $u->status === 'active';
        $isAdmin = $new['roleId'] === config('crm.admin_role') && $new['status'] === 'active';
        if ($wasAdmin && ! $isAdmin && $this->activeAdmins($id) < 1) {
            $this->deny('마지막 관리자의 역할·상태는 바꿀 수 없습니다');
        }
        if (! empty($new['roleId']) && ! DB::table('roles')->where('id', $new['roleId'])->exists()) {
            throw new SyncError('없는 역할입니다', 422);
        }
        $u->forceFill([
            'username' => strtolower(trim((string) $new['username'])),
            'status' => $new['status'],
            'role_id' => $new['roleId'] ?: null,
            'data' => array_diff_key($new, array_flip(['id', 'username', 'status', 'roleId', 'password', 'email'])),
        ])->save();
        Perm::forget();
    }

    /* ---------------- 영업 보고 ---------------- */

    private const REVIEW_KEYS = ['status', 'reviewerId', 'reviewedAt', 'reviewComment'];

    private function report(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        if ($a === null) {
            $this->need(Perm::canRep($this->me, 'delete', $cur), '보고서 삭제 권한이 없습니다');
            $this->need(($cur['status'] ?? '') !== 'confirmed', '확인된 보고서는 삭제할 수 없습니다');
            Store::remove('reports', $id);

            return;
        }
        if (! $cur) {
            $this->need(Perm::canRep($this->me, 'create'), '보고서 작성 권한이 없습니다');
            $this->need(($a['authorId'] ?? '') === $this->me->id, '본인 보고서만 작성할 수 있습니다');
            $this->need(in_array($a['status'] ?? '', ['draft', 'submitted'], true), '보고서 상태가 올바르지 않습니다');
            if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($a['date'] ?? '')) || $a['date'] > now()->toDateString()) {
                throw new SyncError('보고서 날짜가 올바르지 않습니다', 422);
            }
            if (DB::table('reports')->where('author_id', $this->me->id)->where('date', $a['date'])->exists()) {
                throw new SyncError('이 날짜의 보고서가 이미 있습니다. 새로고침 후 다시 해 주세요', 409, 'CONFLICT');
            }
            Store::put('reports', $a);

            return;
        }
        $keys = self::delta($b, $a);
        if (! $keys) {
            return;
        }
        $isAuthor = ($cur['authorId'] ?? '') === $this->me->id;
        $onlyComp = ! array_diff($keys, ['comp']) && ($this->compDeleted || $this->compRenamed);
        if ($onlyComp) {
            return; // 경쟁사 변경 반영은 서버가 이미 처리
        }
        if ($isAuthor) {
            $this->need(Perm::canRep($this->me, 'update', $cur), '보고서 수정 권한이 없습니다');
            $this->need(($cur['status'] ?? '') !== 'confirmed', '확인된 보고서는 수정할 수 없습니다');
            $this->need(! in_array('authorId', $keys, true) && ! in_array('date', $keys, true), '작성자와 날짜는 바꿀 수 없습니다');
            if (in_array('status', $keys, true)) {
                $this->need(in_array($a['status'], ['draft', 'submitted'], true), '작성자는 보고서를 제출만 할 수 있습니다');
            }
            $this->need(! array_intersect($keys, ['reviewedAt', 'reviewComment']), '검토 내용은 검토자만 바꿀 수 있습니다');
        } else {
            $this->need(Perm::canReview($this->me, $cur), '검토 권한이 없습니다');
            $this->need(! array_diff($keys, self::REVIEW_KEYS), '다른 사람의 보고서 내용은 바꿀 수 없습니다');
            $this->need(in_array($a['status'] ?? '', ['confirmed', 'returned'], true), '검토 결과가 올바르지 않습니다');
            $a['reviewerId'] = $this->me->id;
            $keys = array_unique([...$keys, 'reviewerId']);
        }
        Store::put('reports', self::merge($cur, $a, $keys));
    }

    /* ---------------- 근태 ---------------- */

    private function attendance(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        $mgr = Perm::attManager($this->me);
        if ($a === null) {
            $this->deny('근태 일정은 지울 수 없습니다. 취소를 사용하세요');
        }
        if (! $cur) {
            $this->need(Perm::canAtt($this->me, 'create'), '근태 일정 등록 권한이 없습니다');
            $this->need(($a['userId'] ?? '') === $this->me->id || $mgr, '다른 직원의 일정은 등록할 수 없습니다');
            $this->need(DB::table('users')->where('id', $a['userId'] ?? '')->exists(), '없는 사용자입니다');
            if (! $mgr) {
                $this->need(($a['status'] ?? '') === 'requested', '승인 권한이 없습니다');
            }
            if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($a['from'] ?? '')) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($a['to'] ?? '')) || $a['to'] < $a['from']) {
                throw new SyncError('기간을 올바르게 선택하세요', 422);
            }
            $a['requestedBy'] = $this->me->id;
            if (($a['status'] ?? '') === 'approved') {
                $a['approverId'] = $this->me->id;
            }
            Store::put('attendance', $a);

            return;
        }
        $keys = self::delta($b, $a);
        if (! $keys) {
            return;
        }
        if ($mgr && Perm::canAtt($this->me, 'update', $cur)) {
            if (in_array($a['status'] ?? '', ['approved', 'rejected'], true) && in_array('status', $keys, true)) {
                $a['approverId'] = $this->me->id;
                $keys = array_unique([...$keys, 'approverId']);
            }
            if (($a['status'] ?? '') === 'canceled') {
                $this->need(Perm::canAtt($this->me, 'delete', $cur), '취소 권한이 없습니다');
            }
        } else {
            // 본인: 승인 대기 중인 신청을 취소하는 것만
            $this->need(($cur['userId'] ?? '') === $this->me->id && ($cur['status'] ?? '') === 'requested' && ($a['status'] ?? '') === 'canceled'
                && ! array_diff($keys, ['status']) && Perm::canAtt($this->me, 'delete', $cur), '근태 일정을 바꿀 권한이 없습니다');
        }
        Store::put('attendance', self::merge($cur, $a, $keys));
    }

    /* ---------------- 오늘 할 일 메모 · 코칭 메모 ---------------- */

    private function todo(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        $owner = $cur['userId'] ?? ($a['userId'] ?? '');
        $this->need($owner === $this->me->id && (! $a || ($a['userId'] ?? '') === $this->me->id), '본인 메모만 바꿀 수 있습니다');
        if ($a === null) {
            Store::remove('todos', $id);

            return;
        }
        if (mb_strlen((string) ($a['text'] ?? '')) > 500) {
            throw new SyncError('메모가 너무 깁니다', 422);
        }
        Store::put('todos', $cur ? self::merge($cur, $a, self::delta($b, $a)) : $a);
    }

    private function coaching(string $id, ?array $cur, ?array $b, ?array $a): void
    {
        if ($a === null) {
            $this->needCan('team', 'delete');
            Store::remove('coaching', $id);

            return;
        }
        $this->needCan('team', $cur ? 'update' : 'create');
        if (! $cur) {
            $a['authorId'] = $this->me->id;
            $a['authorName'] = $this->me->name();
        }
        Store::put('coaching', $cur ? self::merge($cur, $a, self::delta($b, $a)) : $a);
    }

    /* ---------------- 변경 이력 ---------------- */

    private const ENTITIES = ['hospital', 'category', 'user', 'role', 'settings', 'report', 'attendance', 'competitor'];

    private function audit(array $e): void
    {
        $id = (string) ($e['id'] ?? '');
        if ($id === '' || strlen($id) > 40 || DB::table('audit_logs')->where('id', $id)->exists()) {
            return;
        }
        if (! in_array($e['entity'] ?? '', self::ENTITIES, true) || ! in_array($e['action'] ?? '', ['create', 'update', 'delete', 'restore'], true)) {
            throw new SyncError('변경 이력 형식이 올바르지 않습니다', 422);
        }
        if (($e['entity'] ?? '') === 'hospital' && ! isset($this->touched['hospitals'][$e['hospitalId'] ?? ''])) {
            throw new SyncError('바뀌지 않은 병원의 변경 이력은 남길 수 없습니다', 422);
        }
        $role = $this->role['name'] ?? '';
        $e = [
            'id' => $id,
            'ts' => now()->toIso8601ZuluString('millisecond'),
            'userId' => $this->me->id,
            'userName' => $this->me->name(),
            'roleName' => $role,
        ] + array_intersect_key($e, array_flip(['entity', 'entityId', 'hospitalId', 'targetName', 'action', 'section', 'changes', 'summary']));
        $e['changes'] = array_values(array_map(fn ($c) => [
            'field' => mb_substr((string) ($c['field'] ?? ''), 0, 120),
            'before' => mb_substr((string) ($c['before'] ?? ''), 0, 2000),
            'after' => mb_substr((string) ($c['after'] ?? ''), 0, 2000),
        ], array_slice((array) ($e['changes'] ?? []), 0, 300)));
        DB::table('audit_logs')->insert([
            'id' => $id, 'ts' => $e['ts'], 'user_id' => $this->me->id, 'entity' => $e['entity'],
            'entity_id' => isset($e['entityId']) ? mb_substr((string) $e['entityId'], 0, 40) : null,
            'hospital_id' => isset($e['hospitalId']) ? mb_substr((string) $e['hospitalId'], 0, 20) : null,
            'data' => json_encode($e, JSON_UNESCAPED_UNICODE), 'created_at' => now(),
        ]);
    }

    /** 서버가 직접 남기는 이력 (가입 신청 등) */
    public static function log(?User $u, array $e): void
    {
        $role = $u ? (Perm::role($u)['name'] ?? ($u->status === 'pending' ? '가입 신청' : '')) : '';
        $id = 'au_'.Str::lower(Str::random(10));
        $e = ['id' => $id, 'ts' => now()->toIso8601ZuluString('millisecond'), 'userId' => $u?->id ?? '', 'userName' => $u?->name() ?? '시스템', 'roleName' => $role] + $e;
        DB::table('audit_logs')->insert(['id' => $id, 'ts' => $e['ts'], 'user_id' => $u?->id, 'entity' => $e['entity'], 'entity_id' => $e['entityId'] ?? null,
            'hospital_id' => $e['hospitalId'] ?? null, 'data' => json_encode($e, JSON_UNESCAPED_UNICODE), 'created_at' => now()]);
    }
}
