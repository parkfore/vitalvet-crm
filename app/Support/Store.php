<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * 저장소: 테이블 행 ↔ 화면 레코드(JSON) 변환, 로그인한 사람 기준 전체 상태 만들기
 */
class Store
{
    /** 화면 컬렉션 이름 => 테이블 */
    public const TABLES = [
        'hospitals' => 'hospitals', 'categories' => 'categories', 'stages' => 'stages', 'roles' => 'roles',
        'competitors' => 'competitors', 'reports' => 'reports', 'attendance' => 'attendance',
        'todos' => 'todos', 'coaching' => 'coaching',
    ];

    /** 순서가 의미 있는 컬렉션 (sort 칸) */
    public const ORDERED = ['categories', 'stages', 'roles'];

    // 병원 레코드에서 기능별로 나뉘는 항목
    public const CONV_KEYS = ['signupDate', 'usageCount', 'lastUsedDate', 'memo'];

    public static function decode($row): array
    {
        return ['id' => $row->id] + (json_decode($row->data, true) ?: []);
    }

    /** 테이블 전체를 화면 레코드 배열로 */
    public static function all(string $col, ?callable $where = null): array
    {
        $q = DB::table(self::TABLES[$col]);
        if ($where) {
            $where($q);
        }
        if (in_array($col, self::ORDERED, true)) {
            $q->orderBy('sort');
        }
        $q->orderBy('id');

        return $q->get()->map(fn ($r) => self::decode($r))->all();
    }

    public static function find(string $col, string $id): ?array
    {
        $row = DB::table(self::TABLES[$col])->where('id', $id)->lockForUpdate()->first();

        return $row ? self::decode($row) : null;
    }

    /** 레코드 저장 (검색·권한용 칸은 레코드에서 뽑아 채운다) */
    public static function put(string $col, array $rec, ?int $sort = null): void
    {
        $id = (string) $rec['id'];
        $data = $rec;
        unset($data['id']);
        $cols = ['data' => json_encode($data, JSON_UNESCAPED_UNICODE), 'updated_at' => now()];
        switch ($col) {
            case 'hospitals':
                $cols += ['name' => mb_substr((string) ($rec['name'] ?? ''), 0, 120), 'owner_id' => ($rec['ownerId'] ?? '') ?: null,
                    'stage' => mb_substr((string) ($rec['stage'] ?? ''), 0, 60), 'deleted_at' => ($rec['deletedAt'] ?? '') ?: null];
                break;
            case 'reports':
                $cols += ['author_id' => (string) $rec['authorId'], 'date' => (string) $rec['date'], 'status' => (string) ($rec['status'] ?? 'draft')];
                break;
            case 'attendance':
                $cols += ['user_id' => (string) $rec['userId'], 'status' => (string) ($rec['status'] ?? 'requested'),
                    'from_date' => (string) ($rec['from'] ?? ''), 'to_date' => (string) ($rec['to'] ?? '')];
                break;
            case 'todos':
            case 'coaching':
                $cols += ['user_id' => (string) ($rec['userId'] ?? '')];
                break;
        }
        if ($sort !== null) {
            $cols['sort'] = $sort;
        }
        $t = DB::table(self::TABLES[$col]);
        if ($t->clone()->where('id', $id)->exists()) {
            $t->where('id', $id)->update($cols);
        } else {
            $t->insert($cols + ['id' => $id, 'created_at' => now()] + (in_array($col, self::ORDERED, true) && $sort === null ? ['sort' => 9999] : []));
        }
    }

    public static function remove(string $col, string $id): void
    {
        DB::table(self::TABLES[$col])->where('id', $id)->delete();
    }

    public static function setting(string $key, $default = null)
    {
        $v = DB::table('app_settings')->where('key', $key)->value('value');

        return $v === null ? $default : json_decode($v, true);
    }

    public static function putSetting(string $key, $value): void
    {
        DB::table('app_settings')->updateOrInsert(['key' => $key], ['value' => json_encode($value, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
    }

    /** 일반 설정 (방문 목표, 사용할 지도) */
    public static function settings(): array
    {
        $s = (array) self::setting('settings', []);
        unset($s['kakaoKey']);

        $opts = config('crm.required_options');
        $req = isset($s['requiredFields']) && is_array($s['requiredFields']) ? array_values(array_intersect($opts, $s['requiredFields'])) : config('crm.required_default');

        return [
            'visitGoal' => (int) ($s['visitGoal'] ?? 4),
            // 방문 체크인: 병원 주소(좌표)에서 이 거리(m) 안에서만 현재 위치로 체크인할 수 있다
            'checkinRadius' => (int) ($s['checkinRadius'] ?? 300),
            'requiredFields' => array_values(array_unique(['name', 'address', ...$req])),
            'mapProvider' => in_array($s['mapProvider'] ?? '', ['kakao', 'naver'], true) ? $s['mapProvider'] : (config('services.maps.provider') === 'naver' ? 'naver' : 'kakao'),
        ];
    }

    /** 선택 목록 (병원 등급·전문과·소속). 소속 목록이 아직 없으면 기본 목록 + 지금 사용자들의 소속 */
    public static function codes(): array
    {
        $c = (array) self::setting('codes', config('crm.codes'));
        foreach (['grades', 'specialties'] as $k) {
            $c[$k] = array_values((array) ($c[$k] ?? config('crm.codes.'.$k)));
        }
        if (! isset($c['teams']) || ! is_array($c['teams'])) {
            $used = DB::table('users')->pluck('data')->map(fn ($d) => trim((string) ((json_decode($d, true) ?: [])['team'] ?? '')))->filter()->all();
            $c['teams'] = array_values(array_unique([...config('crm.codes.teams'), ...$used]));
        }

        return $c;
    }

    /**
     * 새 병원 번호 받기: 등록 직전에 서버가 번호를 하나 떼어 준다 (여러 사람이 동시에 등록해도 겹치지 않음)
     * 가져오기(HospitalImport)와 같은 잠금·같은 카운터를 쓴다
     */
    public static function reserveHospitalId(): string
    {
        return DB::transaction(function () {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('SELECT pg_advisory_xact_lock(724001)');
            }
            $n = max((int) self::setting('hospital_seq', 0), self::seq()) + 1;
            while (DB::table('hospitals')->where('id', 'VV-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT))->exists()) {
                $n++;
            }
            self::putSetting('hospital_seq', $n);

            return 'VV-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
        });
    }

    /** 병원 번호 최댓값 (VV-0001 → 1) */
    public static function seq(): int
    {
        $max = 0;
        foreach (DB::table('hospitals')->pluck('id') as $id) {
            if (preg_match('/^VV-(\d+)$/', $id, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return $max;
    }

    /** 권한에 따라 병원 레코드 일부를 비운다 (읽기 권한이 없는 기능의 내용) */
    public static function maskHospital(array $h, array $f): array
    {
        if (! $f['eval']) {
            $h['eval'] = [];
        }
        unset($h['eval']['shots']);
        if (! $f['activity']) {
            $h['activities'] = [];
            $h['next'] = [];
        }
        if (! $f['conv']) {
            $h['signupDate'] = '';
            $h['usageCount'] = 0;
            $h['lastUsedDate'] = '';
            $h['memo'] = '';
        }
        // 빈 객체가 배열([])로 나가지 않도록
        foreach (['eval', 'next'] as $k) {
            if (empty($h[$k])) {
                $h[$k] = new \stdClass;
            }
        }

        return $h;
    }

    public static function flags(User $u): array
    {
        return ['eval' => Perm::canRead($u, 'eval'), 'activity' => Perm::canRead($u, 'activity'), 'conv' => Perm::canRead($u, 'conv')];
    }

    // 변경 이력 항목 이름 → 기능 (읽기 권한이 없는 기능의 변경 내용은 가린다)
    private const FIELD_FEATURE = [
        '디지털 수용도' => 'eval', '디지털 수용도 근거 이미지' => 'eval', '서비스 호감도' => 'eval', '월 마취 건수' => 'eval', '리드 종합 등급' => 'eval',
        '다음 액션일' => 'activity', '팔로우업 할 사항' => 'activity', '팔로우업 처리' => 'activity', '활동 기록' => 'activity',
        '회원가입일' => 'conv', 'VitalVET 누적 사용 건수' => 'conv', '최근 사용일' => 'conv', '비고' => 'conv',
    ];

    public static function maskAudit(array $e, array $f): ?array
    {
        if (($e['entity'] ?? '') !== 'hospital') {
            return $e;
        }
        $hidden = 0;
        $e['changes'] = array_values(array_filter($e['changes'] ?? [], function ($c) use ($f, &$hidden) {
            $feat = self::FIELD_FEATURE[$c['field'] ?? ''] ?? null;
            if ($feat && ! $f[$feat]) {
                $hidden++;

                return false;
            }

            return true;
        }));
        if ($hidden && ! $e['changes']) {
            return null; // 볼 수 없는 내용만 있는 이력은 통째로 숨김
        }

        return $e;
    }

    /** 로그인한 사람이 볼 수 있는 전체 상태 (화면의 S 와 같은 모양) */
    public static function state(User $me): array
    {
        $f = self::flags($me);
        $readAny = fn (array $fs) => collect($fs)->contains(fn ($x) => Perm::canRead($me, $x));
        $own = Perm::scope($me) === 'own';

        $hospitals = $readAny(['hospital', 'dash', 'map', 'myday', 'team', 'report', 'history', 'category', 'competitor'])
            ? array_map(fn ($h) => self::maskHospital($h, $f), self::all('hospitals')) : [];

        // 보고서·근태·변경 이력·코칭: 역할의 '사람 자료 범위'(전체 / 같은 팀)에 맞춰 보낸다
        $teamOk = fn (?string $uid) => Perm::sameTeam($me, $uid);
        $reports = Perm::canRep($me, 'read') || Perm::canRep($me, 'create')
            ? array_values(array_filter(self::all('reports'), fn ($r) => $teamOk($r['authorId'] ?? ''))) : [];
        $repIds = array_flip(array_column($reports, 'id'));

        $attendance = array_values(array_filter(self::all('attendance', fn ($q) => Perm::has($me, 'attendance', 'read') ? null : $q->where('user_id', $me->id)), fn ($a) => $teamOk($a['userId'] ?? '')));

        // 변경 이력: 전체 이력 권한이 있으면 전부, 없으면 내 작업과 볼 수 있는 보고서 이력만
        $hist = Perm::canRead($me, 'history');
        $audit = [];
        foreach (DB::table('audit_logs')->orderBy('ts')->orderBy('created_at')->get() as $row) {
            if (! $hist && $row->user_id !== $me->id && ! ($row->entity === 'report' && isset($repIds[$row->entity_id]))) {
                continue;
            }
            // 팀 범위: 같은 팀 사람이 한 일만 (시스템 기록·내 보고서 이력은 포함)
            if ($hist && $row->user_id && ! $teamOk($row->user_id) && ! ($row->entity === 'report' && isset($repIds[$row->entity_id]))) {
                continue;
            }
            $e = self::maskAudit(json_decode($row->data, true), $f);
            if ($e) {
                $audit[] = $e;
            }
        }

        $users = DB::table('users')->orderBy('created_at')->orderBy('id')->get()->map(function ($r) {
            return ['id' => $r->id, 'username' => $r->username, 'status' => $r->status, 'roleId' => (string) $r->role_id] + (json_decode($r->data, true) ?: []);
        })->all();

        $roles = array_map(function ($r) {
            if ($r['id'] === config('crm.admin_role')) {
                $r['perms'] = Perm::fullPerms();
                $r['locked'] = true;
            }

            return $r;
        }, self::all('roles'));

        $competitors = self::all('competitors');
        if (! Perm::canRead($me, 'competitor')) {
            $competitors = array_map(fn ($c) => ['id' => $c['id'], 'name' => $c['name'] ?? ''], $competitors);
        }

        return [
            'version' => 6,
            'seq' => self::seq(),
            'session' => $me->id,
            'categories' => self::all('categories'),
            'codes' => self::codes(),
            'settings' => self::settings(),
            // 지도 키는 .env 에서 (화면에서 바꾸지 않는다). 어떤 지도를 쓸지는 settings.mapProvider
            'maps' => [
                'provider' => config('services.maps.provider') === 'naver' ? 'naver' : 'kakao',
                'kakaoKey' => (string) config('services.maps.kakao.js_key'),
                'naverKey' => (string) config('services.maps.naver.client_id'),
            ],
            // 주소 → 좌표 서버 검색 (병원 가져오기): kakao | naver | ''
            'geocoder' => Geo::provider(),
            'publicApi' => Perm::canRead($me, 'settings') || \App\Http\Controllers\Api\ImportController::allowed($me) ? PublicApi::publicConfig() : null,
            'mapViews' => array_values((array) self::setting('mapviews:'.$me->id, [])),
            // 관리자: 최근 24시간 오류 종류 수 (알림)
            'errorCount' => $me->role_id === config('crm.admin_role') ? ErrorLog::recentCount() : 0,
            // 데이터 버전 (바뀐 것만 다시 받기) · 알림 설정
            'dataVer' => (string) self::setting('data_ver', ''),
            'notif' => Notify::forState($me),
            // 월 목표 (방문·회원가입·사용 전환)
            'goals' => (object) (self::setting('goals') ?? ['default' => ['visits' => 80, 'signups' => 3, 'uses' => 2], 'users' => new \stdClass]),
            // 오늘 동선 (PC·휴대폰 공용)
            'myRoute' => self::setting('route:'.$me->id),
            'stages' => self::all('stages'),
            'holidays' => (object) self::setting('holidays', config('crm.holidays')),
            'attendance' => $attendance,
            'roles' => $roles,
            'users' => $users,
            'hospitals' => $hospitals,
            'audit' => $audit,
            'reports' => $reports,
            'competitors' => $competitors,
            'todos' => self::all('todos', fn ($q) => $q->where('user_id', $me->id)),
            // 코칭 메모: 팀 성과를 볼 수 있으면 전부, 아니면 나에게 남긴 메모만
            'coaching' => Perm::canRead($me, 'team') ? array_values(array_filter(self::all('coaching'), fn ($c) => $teamOk($c['userId'] ?? ''))) : self::all('coaching', fn ($q) => $q->where('user_id', $me->id)),
        ];
    }
}
