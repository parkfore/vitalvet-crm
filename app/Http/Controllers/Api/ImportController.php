<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Geo;
use App\Support\HospitalImport;
use App\Support\Perm;
use App\Support\PublicApi;
use App\Support\Store;
use App\Support\Sync;
use App\Support\SyncError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 병원 정보 가져오기
 *
 * 파일: 화면에서 엑셀·CSV 를 읽어 열 이름을 보내면(preview) 어떤 열을 쓸지 알려 주고, 100줄씩 rows 로 보낸다.
 * API : 설정에 저장한 공공데이터 API 를 page 단위로 불러와 같은 방식으로 반영한다.
 * 끝나면 finish 로 이번 가져오기 결과를 변경 이력에 한 줄로 남긴다.
 */
class ImportController extends Controller
{
    private const MAX_ROWS = 500;

    /** 가져오기 권한: 병원 등록·수정 + 전체 병원 범위 */
    public static function allowed(User $u): bool
    {
        return Perm::can($u, 'hospital', 'create') && Perm::can($u, 'hospital', 'update') && Perm::scope($u) === 'all';
    }

    private function guard(): ?JsonResponse
    {
        return self::allowed($this->actor()) ? null : $this->fail('병원 정보를 가져올 권한이 없습니다 (병원 등록·수정 권한과 전체 병원 범위가 필요합니다)', 403, 'FORBIDDEN');
    }

    private static function fields(): array
    {
        return array_map(fn ($k, $v) => [$k, $v[0]], array_keys(HospitalImport::FIELDS), HospitalImport::FIELDS);
    }

    private static function sample(array $rows): array
    {
        return array_map(function ($r) {
            $c = HospitalImport::clean($r);
            $c['geo'] = (bool) $c['fileGeo'];
            unset($c['fileGeo']);

            return $c;
        }, array_slice($rows, 0, 5));
    }

    /** 열 이름 → 어떤 항목인지 + 미리보기 */
    public function preview(Request $r)
    {
        if ($g = $this->guard()) {
            return $g;
        }
        $headers = array_values(array_map('strval', array_slice((array) $r->input('headers', []), 0, 300)));
        $map = HospitalImport::detect($headers);
        $override = (array) $r->input('mapping', []);
        foreach ($override as $f => $h) {
            if (isset(HospitalImport::FIELDS[$f])) {
                if ($h === '' || $h === null) {
                    unset($map[$f]);
                } elseif (in_array((string) $h, $headers, true)) {
                    $map[$f] = (string) $h;
                }
            }
        }
        $rows = array_map(fn ($x) => HospitalImport::canon((array) $x, $map), array_slice((array) $r->input('rows', []), 0, 5));

        return response()->json(['fields' => self::fields(), 'mapping' => (object) $map, 'sample' => self::sample($rows), 'geocoder' => Geo::provider()]);
    }

    /** 파일 한 묶음 반영 (항목 => 값) */
    public function rows(Request $r)
    {
        if ($g = $this->guard()) {
            return $g;
        }
        $rows = (array) $r->input('rows', []);
        if (count($rows) > self::MAX_ROWS) {
            return $this->fail('한 번에 '.self::MAX_ROWS.'줄까지 보낼 수 있습니다');
        }
        $rows = array_map(fn ($x) => array_intersect_key(array_map(fn ($v) => is_scalar($v) ? (string) $v : '', (array) $x), HospitalImport::FIELDS), $rows);
        $n = (new HospitalImport($this->actor()))->import($rows, 'file', (bool) $r->boolean('createClosed'));
        $this->accumulate((string) $r->input('runId'), 'file', (string) $r->input('fileName', ''), $n);

        return response()->json($n);
    }

    /** API 한 쪽 불러와서 반영 */
    public function apiPage(Request $r)
    {
        if ($g = $this->guard()) {
            return $g;
        }
        $page = max(1, (int) $r->input('page', 1));
        try {
            $res = PublicApi::fetch($page);
        } catch (SyncError $e) {
            return $this->fail($e->getMessage(), $e->status);
        }
        $map = HospitalImport::detect($res['items'] ? array_keys($res['items'][0]) : []);
        if ($res['items'] && ! isset($map['name'])) {
            return $this->fail('API 응답에서 병원명(사업장명) 항목을 찾지 못했습니다. 연결 테스트로 항목 이름을 확인하세요');
        }
        $rows = array_map(fn ($x) => HospitalImport::canon($x, $map), $res['items']);
        $n = (new HospitalImport($this->actor()))->import($rows, 'api', (bool) $r->boolean('createClosed'));
        $this->accumulate((string) $r->input('runId'), 'api', '', $n);

        return response()->json($n + ['total' => $res['total'], 'page' => $page, 'count' => count($res['items']), 'rowsPerPage' => PublicApi::config()['rows']]);
    }

    /** 연결 테스트: 첫 쪽 몇 건만 받아서 항목 확인 (저장하지 않음) */
    public function apiTest()
    {
        if (! Perm::can($this->actor(), 'settings', 'update') && ! self::allowed($this->actor())) {
            return $this->fail('권한이 없습니다', 403, 'FORBIDDEN');
        }
        try {
            $res = PublicApi::fetch(1, 5);
        } catch (SyncError $e) {
            return $this->fail($e->getMessage(), $e->status);
        }
        $keys = $res['items'] ? array_keys($res['items'][0]) : [];
        $map = HospitalImport::detect($keys);
        $rows = array_map(fn ($x) => HospitalImport::canon($x, $map), $res['items']);

        return response()->json(['total' => $res['total'], 'keys' => $keys, 'fields' => self::fields(), 'mapping' => (object) $map, 'sample' => self::sample($rows), 'geocoder' => Geo::provider()]);
    }

    /** API 설정 저장 (설정 수정 권한) */
    public function apiConfig(Request $r)
    {
        $me = $this->actor();
        if (! Perm::can($me, 'settings', 'update')) {
            return $this->fail('설정을 바꿀 권한이 없습니다', 403, 'FORBIDDEN');
        }
        $c = PublicApi::config();
        $url = trim((string) $r->input('url', ''));
        if ($url !== '' && ! preg_match('#^https?://[^\s]+$#i', $url)) {
            return $this->fail('API 요청 주소는 http:// 또는 https:// 로 시작해야 합니다');
        }
        $new = ['url' => mb_substr($url, 0, 500), 'params' => mb_substr(trim((string) $r->input('params', '')), 0, 500),
            'rows' => max(10, min(1000, (int) $r->input('rows', 100))), 'key' => $c['key'], 'last' => $c['last']];
        if ($r->boolean('clearKey')) {
            $new['key'] = '';
        } elseif (trim((string) $r->input('key', '')) !== '') {
            $new['key'] = mb_substr(trim((string) $r->input('key')), 0, 500);
        }
        Store::putSetting(PublicApi::KEY, $new);
        $ch = [];
        foreach (['url' => '요청 주소', 'params' => '추가 조건', 'rows' => '한 번에 받을 건수'] as $k => $l) {
            if ((string) $c[$k] !== (string) $new[$k]) {
                $ch[] = ['field' => $l, 'before' => (string) $c[$k], 'after' => (string) $new[$k]];
            }
        }
        if ($c['key'] !== $new['key']) {
            $ch[] = ['field' => '인증키', 'before' => $c['key'] ? '저장됨' : '없음', 'after' => $new['key'] ? '새 키 저장' : '없음'];
        }
        if ($ch) {
            Sync::log($me, ['entity' => 'settings', 'entityId' => 'public_api', 'targetName' => '병원 정보 연동 (공공데이터 API)', 'action' => 'update', 'section' => '설정', 'changes' => $ch]);
        }

        return response()->json(PublicApi::publicConfig());
    }

    /** 이번 가져오기 결과 누적 (서버에서 센 값만 믿는다) */
    private function accumulate(string $runId, string $origin, string $fileName, array $n): void
    {
        if (! preg_match('/^[A-Za-z0-9_\-]{4,40}$/', $runId)) {
            return;
        }
        $k = 'import_run:'.$this->actor()->id;
        $run = (array) Store::setting($k, []);
        if (($run['id'] ?? '') !== $runId) {
            $run = ['id' => $runId, 'origin' => $origin, 'fileName' => mb_substr($fileName, 0, 120), 'at' => now()->toIso8601ZuluString(),
                'n' => ['created' => 0, 'updated' => 0, 'exists' => 0, 'older' => 0, 'skippedClosed' => 0, 'invalid' => 0, 'noGeo' => 0]];
        }
        foreach ($run['n'] as $kk => $v) {
            $run['n'][$kk] = $v + (int) ($n[$kk] ?? 0);
        }
        Store::putSetting($k, $run);
    }

    /** 가져오기 끝: 결과 한 줄을 변경 이력에 */
    public function finish(Request $r)
    {
        if ($g = $this->guard()) {
            return $g;
        }
        $me = $this->actor();
        $k = 'import_run:'.$me->id;
        $run = (array) Store::setting($k, []);
        if (($run['id'] ?? '') !== (string) $r->input('runId')) {
            return response()->json(['ok' => true, 'n' => null]);
        }
        $n = $run['n'];
        $what = $run['origin'] === 'api' ? '공공데이터 API 연동' : '파일 업로드'.($run['fileName'] ? " ({$run['fileName']})" : '');
        $sum = "신규 등록 {$n['created']}곳 · 영업 상태 변경 {$n['updated']}곳 · 이미 등록됨 {$n['exists']}곳";
        if ($n['older'] ?? 0) {
            $sum .= " · 더 최근 정보가 있어 반영 안 함 {$n['older']}곳";
        }
        if ($n['skippedClosed']) {
            $sum .= " · 폐업이라 등록 안 함 {$n['skippedClosed']}곳";
        }
        if ($n['invalid']) {
            $sum .= " · 병원명·주소 없음 {$n['invalid']}줄";
        }
        if ($n['noGeo']) {
            $sum .= " · 좌표 못 찾음 {$n['noGeo']}곳";
        }
        Sync::log($me, ['entity' => 'hospital', 'targetName' => '병원 정보 가져오기', 'action' => 'create', 'section' => $what, 'changes' => [], 'summary' => $sum]);
        if ($run['origin'] === 'api') {
            $c = (array) Store::setting(PublicApi::KEY, []);
            $c['last'] = ['at' => now()->toIso8601ZuluString(), 'by' => $me->name(), 'summary' => $sum];
            Store::putSetting(PublicApi::KEY, $c);
        }
        DB::table('app_settings')->where('key', $k)->delete();

        return response()->json(['ok' => true, 'n' => $n, 'summary' => $sum]);
    }

    /** 좌표 없는 병원 주소로 다시 찾기 (한 번에 50곳) */
    public function geocode(Request $r)
    {
        if ($g = $this->guard()) {
            return $g;
        }
        if (! Geo::provider()) {
            return $this->fail('주소로 좌표를 찾으려면 서버 .env 에 KAKAO_REST_KEY 또는 NAVER_MAP_CLIENT_ID·NAVER_MAP_CLIENT_SECRET 이 필요합니다');
        }
        $skip = array_flip(array_map('strval', (array) $r->input('skip', [])));
        $todo = [];
        foreach (DB::table('hospitals')->whereNull('deleted_at')->select('id', 'data')->orderBy('id')->get() as $row) {
            $h = Store::decode($row);
            if (empty($h['lat']) && ! empty($h['address']) && ! isset($skip[$h['id']])) {
                $todo[$h['id']] = $h;
            }
        }
        $batch = array_slice($todo, 0, 50, true);
        $geo = Geo::many(array_map(fn ($h) => (string) $h['address'], $batch));
        $done = 0;
        $failed = [];
        foreach ($batch as $id => $h) {
            $g = $geo[$id] ?? null;
            if (! $g) {
                $failed[] = $id;

                continue;
            }
            $h['lat'] = $g['lat'];
            $h['lng'] = $g['lng'];
            foreach (['zip', 'sido', 'sigungu'] as $kk) {
                if (empty($h[$kk]) && $g[$kk] !== '') {
                    $h[$kk] = $kk === 'sido' ? HospitalImport::shortSido($g[$kk]) : $g[$kk];
                }
            }
            Store::put('hospitals', $h);
            $done++;
        }

        return response()->json(['done' => $done, 'failed' => $failed, 'remaining' => count($todo) - count($batch)]);
    }
}
