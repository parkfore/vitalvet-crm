<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * 병원 정보 가져오기 (엑셀·CSV 파일, 공공데이터 API 공용)
 *
 * - detect(): 파일 머리글(열 이름)을 보고 어떤 열이 병원명·주소·영업 상태인지 알아낸다
 * - clean(): 한 줄을 병원 레코드 모양으로 다듬는다 (주소 나누기, 영업 상태 통일, 전화번호 모양)
 * - import(): 이미 있는 병원은 새로 만들지 않고 영업 상태(폐업 등)만 바꾸고, 없으면 주소로 좌표를 찾아 새로 등록한다
 */
class HospitalImport
{
    /** 가져올 항목 => [이름, 열 이름 후보] (열 이름은 영문 소문자·숫자·한글만 남겨 비교) */
    public const FIELDS = [
        'name' => ['병원명', ['사업장명', '병원명', '동물병원명', '병원', '상호', '상호명', '업소명', '업체명', '기관명', '시설명', 'bplcnm', 'name', 'hospitalname']],
        'road' => ['도로명 주소', ['도로명전체주소', '도로명주소', '소재지도로명주소', '도로명', '주소도로명', 'rdnwhladdr', 'roadnmaddr', 'roadaddr', 'roadaddress']],
        'jibun' => ['지번 주소', ['소재지전체주소', '지번주소', '소재지지번주소', '소재지주소', '주소지번', 'sitewhladdr', 'lotnoaddr', 'jibunaddr', 'jibun']],
        'address' => ['주소', ['주소', '소재지', '병원주소', 'address', 'addr']],
        'addressDetail' => ['상세주소', ['상세주소', 'addressdetail']],
        'zip' => ['우편번호', ['도로명우편번호', '소재지우편번호', '우편번호', 'rdnpostno', 'sitepostno', 'roadnmzip', 'lotnozip', 'zip', 'zipcode', 'postcode']],
        'phone' => ['대표 전화', ['소재지전화', '소재지전화번호', '전화번호', '대표전화', '병원전화', '병원대표전화', '연락처', 'sitetel', 'telno', 'tel', 'phone']],
        'status' => ['영업 상태', ['영업상태명', '영업상태', '운영상태', '상태', 'trdstatenm', 'salssttsnm', 'status']],
        'statusCode' => ['영업 상태 코드', ['영업상태구분코드', '영업상태코드', 'trdstategbn', 'salssttscd']],
        'detailStatus' => ['상세 영업 상태', ['상세영업상태명', '상세영업상태', 'dtlstatenm', 'dtlsalssttsnm']],
        'closedAt' => ['폐업일', ['폐업일자', '폐업일', 'dcbymd', 'clsbizymd']],
        'extId' => ['인허가 관리번호', ['관리번호', '인허가관리번호', '인허가번호', 'mgtno', 'mngno', 'licenseno', 'extid']],
        'authCode' => ['개방자치단체코드', ['개방자치단체코드', '자치단체코드', 'opnsfteamcode', 'opnatmygrpcd']],
        'director' => ['원장님 이름', ['원장님이름', '원장이름', '원장님', '원장', '원장명', '대표자', '대표자명', 'director']],
        'directorPhone' => ['원장님 연락처', ['원장님연락처', '원장연락처', '원장휴대폰', '휴대폰', 'directorphone']],
        'vetCount' => ['봉직수의사 수', ['봉직수의사수', '수의사수', '수의사인원', 'vetcount']],
        'grade' => ['병원 등급', ['병원등급', '등급', 'grade']],
        'specialty' => ['전문과', ['전문과', '진료과목', '전문분야', 'specialty']],
        'x' => ['좌표 X (중부원점 TM)', ['좌표정보x', '좌표정보xepsg5174', '좌표x', 'crdinfox', 'x']],
        'y' => ['좌표 Y (중부원점 TM)', ['좌표정보y', '좌표정보yepsg5174', '좌표y', 'crdinfoy', 'y']],
        'lat' => ['위도', ['위도', 'lat', 'latitude']],
        'lng' => ['경도', ['경도', 'lng', 'lon', 'longitude']],
    ];

    private const SIDO = [
        '서울특별시' => '서울', '서울시' => '서울', '부산광역시' => '부산', '대구광역시' => '대구', '인천광역시' => '인천', '광주광역시' => '광주',
        '대전광역시' => '대전', '울산광역시' => '울산', '세종특별자치시' => '세종', '경기도' => '경기', '강원특별자치도' => '강원', '강원도' => '강원',
        '충청북도' => '충북', '충청남도' => '충남', '전북특별자치도' => '전북', '전라북도' => '전북', '전라남도' => '전남',
        '경상북도' => '경북', '경상남도' => '경남', '제주특별자치도' => '제주', '제주도' => '제주',
    ];

    public static function key(string $s): string
    {
        return preg_replace('/[^a-z0-9가-힣]/u', '', mb_strtolower($s));
    }

    /** 머리글 → [항목 => 열 이름] */
    public static function detect(array $headers): array
    {
        $map = [];
        $norm = [];
        foreach ($headers as $h) {
            $norm[(string) $h] = self::key((string) $h);
        }
        foreach (self::FIELDS as $f => [, $alias]) {
            foreach ($alias as $al) {
                $hit = array_search($al, $norm, true);
                if ($hit !== false && ! in_array($hit, $map, true)) {
                    $map[$f] = (string) $hit;
                    break;
                }
            }
        }

        return $map;
    }

    /** 원본 한 줄(열 이름 => 값) → 항목 => 값 */
    public static function canon(array $raw, array $map): array
    {
        $o = [];
        foreach ($map as $f => $h) {
            if (array_key_exists($h, $raw) && ! is_array($raw[$h])) {
                $o[$f] = trim((string) $raw[$h]);
            }
        }

        return $o;
    }

    public static function shortSido(string $s): string
    {
        return self::SIDO[$s] ?? $s;
    }

    /** 비교용 주소: 괄호·층수·띄어쓰기를 빼고 시·도 이름을 짧게 */
    public static function addrKey(string $a): string
    {
        $a = Geo::clean($a);
        $p = preg_split('/\s+/u', $a, 2);
        if (! $p || $p[0] === '') {
            return '';
        }
        $a = self::shortSido($p[0]).($p[1] ?? '');

        return self::key(str_replace('번지', '', $a));
    }

    public static function nameKey(string $n): string
    {
        return self::key(str_replace(['(주)', '㈜', '주식회사'], '', $n));
    }

    public static function fmtPhone(string $v): string
    {
        $d = preg_replace('/\D/', '', $v);
        if ($d === '') {
            return '';
        }
        if (str_starts_with($d, '02')) {
            return strlen($d) <= 9 ? preg_replace('/^(02)(\d{3})(\d{0,4}).*/', '$1-$2-$3', $d) : preg_replace('/^(02)(\d{4})(\d{0,4}).*/', '$1-$2-$3', $d);
        }
        if (strlen($d) === 8 && preg_match('/^1[5-9]/', $d)) {
            return substr($d, 0, 4).'-'.substr($d, 4);
        }

        return strlen($d) <= 10 ? rtrim(preg_replace('/^(\d{3})(\d{3})(\d{0,4}).*/', '$1-$2-$3', $d), '-') : preg_replace('/^(\d{3})(\d{4})(\d{0,4}).*/', '$1-$2-$3', $d);
    }

    public static function date(string $v): string
    {
        $d = preg_replace('/\D/', '', $v);

        return strlen($d) >= 8 ? substr($d, 0, 4).'-'.substr($d, 4, 2).'-'.substr($d, 6, 2) : '';
    }

    /** 영업 / 휴업 / 폐업 / '' (알 수 없음) */
    public static function status(array $r): string
    {
        $code = preg_replace('/\D/', '', (string) ($r['statusCode'] ?? ''));
        $code = $code === '' ? '' : str_pad(ltrim($code, '0'), 2, '0', STR_PAD_LEFT);
        $txt = ($r['status'] ?? '').' '.($r['detailStatus'] ?? '');
        if (preg_match('/폐업|폐쇄|취소|말소|만료|closed/ui', $txt) || in_array($code, ['03', '04'], true)) {
            return '폐업';
        }
        if (preg_match('/휴업|정지|중지/u', $txt) || $code === '02') {
            return '휴업';
        }
        if (preg_match('/영업|정상|운영|open/ui', $txt) || $code === '01') {
            return '영업';
        }

        return '';
    }

    /** 항목 => 값 → 병원 레코드에 넣을 값 (없으면 null + 이유) */
    public static function clean(array $r): array
    {
        $name = trim(preg_replace('/\s+/u', ' ', (string) ($r['name'] ?? '')));
        $road = trim((string) ($r['road'] ?? ''));
        $jibun = trim((string) ($r['jibun'] ?? ''));
        $gen = trim((string) ($r['address'] ?? ''));
        if ($gen !== '') {
            if ($road === '' && preg_match('/\S(로|길)\s*\d/u', $gen)) {
                $road = $gen;
            } elseif ($jibun === '') {
                $jibun = $gen;
            }
        }
        $main = $road !== '' ? $road : $jibun;
        $detail = trim((string) ($r['addressDetail'] ?? ''));
        // "…로 123, 2층 (역삼동)" → 주소 "…로 123 (역삼동)" + 상세주소 "2층"
        if (preg_match('/^(.*?\d+(?:-\d+)?)\s*,\s*([^()]*?)\s*(\([^)]*\))?\s*$/u', $main, $m)) {
            $main = trim($m[1].(isset($m[3]) && $m[3] !== '' ? ' '.$m[3] : ''));
            $detail = $detail !== '' ? $detail : trim($m[2]);
        }
        $main = trim(preg_replace('/\s+/u', ' ', $main));
        $jibunOut = $road !== '' ? trim(preg_replace('/\s+/u', ' ', $jibun)) : '';

        $parts = preg_split('/\s+/u', Geo::clean($main));
        $sido = self::shortSido($parts[0] ?? '');
        $sgg = $parts[1] ?? '';
        if (preg_match('/시$/u', $sgg) && preg_match('/구$/u', $parts[2] ?? '')) {
            $sgg .= ' '.$parts[2];
        }
        $lat = is_numeric($r['lat'] ?? null) ? (float) $r['lat'] : null;
        $lng = is_numeric($r['lng'] ?? null) ? (float) $r['lng'] : null;
        if ($lat !== null && $lng !== null && $lat > 120 && $lng < 45) {
            [$lat, $lng] = [$lng, $lat];
        }
        $geo = $lat !== null && $lng !== null && $lat > 32 && $lat < 39.5 && $lng > 124 && $lng < 132.5 ? ['lat' => $lat, 'lng' => $lng] : Geo::tmToWgs84($r['x'] ?? null, $r['y'] ?? null);

        $ext = mb_substr(trim((string) ($r['extId'] ?? '')), 0, 60);
        $auth = trim((string) ($r['authCode'] ?? ''));
        if ($ext !== '' && $auth !== '' && ! str_contains($ext, $auth)) {
            $ext = mb_substr($auth.'-'.$ext, 0, 60);
        }
        $vets = preg_replace('/\D/', '', (string) ($r['vetCount'] ?? ''));

        return [
            'ok' => $name !== '' && $main !== '',
            'why' => $name === '' ? '병원명 없음' : ($main === '' ? '주소 없음' : ''),
            'name' => mb_substr($name, 0, 120), 'address' => mb_substr($main, 0, 200), 'jibun' => mb_substr($jibunOut, 0, 200),
            'addressDetail' => mb_substr($detail, 0, 120),
            'zip' => substr(preg_replace('/\D/', '', (string) ($r['zip'] ?? '')), 0, 5), 'sido' => $sido, 'sigungu' => $sgg,
            'phone' => self::fmtPhone((string) ($r['phone'] ?? '')),
            'director' => mb_substr(trim((string) ($r['director'] ?? '')), 0, 40), 'directorPhone' => self::fmtPhone((string) ($r['directorPhone'] ?? '')),
            'vetCount' => $vets === '' ? '' : (int) $vets,
            'grade' => mb_substr(trim((string) ($r['grade'] ?? '')), 0, 40), 'specialty' => mb_substr(trim((string) ($r['specialty'] ?? '')), 0, 40),
            'bizStatus' => self::status($r), 'closedAt' => self::date((string) ($r['closedAt'] ?? '')),
            'extId' => $ext, 'fileGeo' => $geo, 'isRoad' => $road !== '',
        ];
    }

    /* ---------------- 가져오기 ---------------- */

    private array $byExt = [];

    private array $byName = [];   // 이름 => [[id, 주소키, 지번키, 전화]]

    private array $recs = [];

    public function __construct(private User $me) {}

    private function index(string $id, array $h): void
    {
        $this->recs[$id] = $h;
        if (($h['extId'] ?? '') !== '') {
            $this->byExt[$h['extId']] = $id;
        }
        $nk = self::nameKey((string) ($h['name'] ?? ''));
        if ($nk !== '') {
            $this->byName[$nk][] = [$id, self::addrKey((string) ($h['address'] ?? '')), self::addrKey((string) ($h['jibun'] ?? '')), preg_replace('/\D/', '', (string) ($h['phone'] ?? ''))];
        }
    }

    private function match(array $c): ?string
    {
        if ($c['extId'] !== '' && isset($this->byExt[$c['extId']])) {
            return $this->byExt[$c['extId']];
        }
        $ak = self::addrKey($c['address']);
        $jk = self::addrKey($c['jibun']);
        $ph = preg_replace('/\D/', '', $c['phone']);
        foreach ($this->byName[self::nameKey($c['name'])] ?? [] as [$id, $a, $j, $p]) {
            $keys = array_filter([$a, $j]);
            if (($ak !== '' && in_array($ak, $keys, true)) || ($jk !== '' && in_array($jk, $keys, true)) || ($ph !== '' && strlen($ph) >= 9 && $ph === $p)) {
                return $id;
            }
        }

        return null;
    }

    /**
     * @param  array  $rows  항목 => 값 (canon 결과)
     * @return array{created:int,updated:int,exists:int,skippedClosed:int,invalid:int,noGeo:int,changes:array,errors:array}
     */
    public function import(array $rows, string $origin, bool $createClosed): array
    {
        $n = ['created' => 0, 'updated' => 0, 'exists' => 0, 'skippedClosed' => 0, 'invalid' => 0, 'noGeo' => 0, 'changes' => [], 'errors' => []];
        $src = $origin === 'api' ? '공공데이터 연동' : '파일 업로드';

        DB::transaction(function () use ($rows, $origin, $createClosed, &$n, $src) {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('SELECT pg_advisory_xact_lock(724001)');
            }
            foreach (DB::table('hospitals')->select('id', 'data')->get() as $row) {
                $this->index($row->id, Store::decode($row));
            }
            $stage = collect(Store::all('stages'))->firstWhere('kind', 'main')['name'] ?? '미접촉(예정)';
            $seq = Store::seq();
            $today = now()->toDateString();
            $new = [];
            $fill = [];

            foreach ($rows as $i => $raw) {
                $c = self::clean(is_array($raw) ? $raw : []);
                if (! $c['ok']) {
                    $n['invalid']++;
                    if (count($n['errors']) < 20) {
                        $n['errors'][] = ($c['name'] ?: '이름 없음').' · '.$c['why'];
                    }

                    continue;
                }
                $id = $this->match($c);
                if ($id === null) {
                    // 같은 파일 안에서 두 번 나온 병원
                    foreach ($new as $k => $x) {
                        if (($c['extId'] !== '' && $c['extId'] === $x['extId']) || (self::nameKey($c['name']) === self::nameKey($x['name']) && self::addrKey($c['address']) === self::addrKey($x['address']))) {
                            $id = '_dup';
                            break;
                        }
                    }
                    if ($id === '_dup') {
                        $n['exists']++;

                        continue;
                    }
                    if ($c['bizStatus'] === '폐업' && ! $createClosed) {
                        $n['skippedClosed']++;

                        continue;
                    }
                    $new[] = $c;

                    continue;
                }

                // 이미 있는 병원: 새로 만들지 않고 영업 상태만 맞춘다 (+ 비어 있는 관리번호·좌표 채우기)
                $h = $this->recs[$id];
                $before = ($h['bizStatus'] ?? '') ?: '영업';
                $ch = [];
                $dirty = false;
                if ($c['bizStatus'] !== '' && $c['bizStatus'] !== $before) {
                    $ch[] = ['field' => '영업 상태', 'before' => $before, 'after' => $c['bizStatus']];
                    $h['bizStatus'] = $c['bizStatus'];
                    $closed = $c['bizStatus'] === '폐업' ? ($c['closedAt'] ?: $today) : '';
                    if (($h['closedAt'] ?? '') !== $closed) {
                        $ch[] = ['field' => '폐업일', 'before' => (string) ($h['closedAt'] ?? ''), 'after' => $closed];
                        $h['closedAt'] = $closed;
                    }
                }
                if ($c['extId'] !== '' && ($h['extId'] ?? '') === '') {
                    $h['extId'] = $c['extId'];
                    $this->byExt[$c['extId']] = $id;
                    $dirty = true;
                }
                if (empty($h['lat']) && ! empty($h['address'])) {
                    $fill[$id] = $c;
                }
                if ($ch) {
                    Store::put('hospitals', $h);
                    $this->recs[$id] = $h;
                    $n['updated']++;
                    if (count($n['changes']) < 200) {
                        $n['changes'][] = ['id' => $id, 'name' => $h['name'] ?? '', 'before' => $before, 'after' => $h['bizStatus']];
                    }
                    Sync::log($this->me, ['entity' => 'hospital', 'entityId' => $id, 'hospitalId' => $id, 'targetName' => $h['name'] ?? '', 'action' => 'update',
                        'section' => '영업 상태', 'changes' => $ch, 'summary' => $src.'으로 확인']);
                } else {
                    if ($dirty) {
                        Store::put('hospitals', $h);
                        $this->recs[$id] = $h;
                    }
                    $n['exists']++;
                }
            }

            // 좌표: 주소로 찾고, 못 찾으면 파일·API 의 좌표
            $addrs = [];
            foreach ($new as $k => $c) {
                $addrs['n'.$k] = $c['address'];
            }
            foreach ($fill as $id => $c) {
                $addrs['f'.$id] = (string) ($this->recs[$id]['address'] ?? $c['address']);
            }
            $geo = Geo::many($addrs);

            foreach ($fill as $id => $c) {
                $g = ($geo['f'.$id] ?? null) ?: $c['fileGeo'];
                if ($g) {
                    $h = $this->recs[$id];
                    $h['lat'] = $g['lat'];
                    $h['lng'] = $g['lng'];
                    Store::put('hospitals', $h);
                }
            }
            foreach ($new as $k => $c) {
                $g = $geo['n'.$k] ?? null;
                $ll = $g ?: $c['fileGeo'];
                if (! $ll) {
                    $n['noGeo']++;
                }
                do {
                    $id = 'VV-'.str_pad((string) ++$seq, 4, '0', STR_PAD_LEFT);
                } while (isset($this->recs[$id]));
                $h = [
                    'id' => $id, 'name' => $c['name'], 'zip' => $c['zip'] ?: ($g['zip'] ?? ''),
                    // 지번만 있으면 찾은 도로명 주소를 주소로, 지번은 아래 칸으로
                    'address' => ! $c['isRoad'] && ($g['road'] ?? '') !== '' ? $g['road'] : $c['address'],
                    'jibun' => $c['isRoad'] ? ($c['jibun'] ?: ($g['jibun'] ?? '')) : (($g['road'] ?? '') !== '' ? Geo::clean($c['address']) : ''),
                    'addressDetail' => $c['addressDetail'], 'sido' => self::shortSido(($g['sido'] ?? '') ?: $c['sido']), 'sigungu' => ($g['sigungu'] ?? '') ?: $c['sigungu'],
                    'lat' => $ll['lat'] ?? null, 'lng' => $ll['lng'] ?? null,
                    'grade' => $c['grade'], 'specialty' => $c['specialty'], 'phone' => $c['phone'], 'director' => $c['director'], 'directorPhone' => $c['directorPhone'],
                    'vetCount' => $c['vetCount'], 'ownerId' => '', 'categoryIds' => [], 'compId' => '', 'compUntil' => '', 'pre' => '', 'sources' => [],
                    'stage' => $stage, 'stageHistory' => [], 'eval' => [], 'activities' => [], 'next' => [],
                    'signupDate' => '', 'usageCount' => 0, 'lastUsedDate' => '', 'memo' => '',
                    'createdAt' => $today, 'createdBy' => $this->me->id,
                    'extId' => $c['extId'], 'bizStatus' => $c['bizStatus'] ?: '영업', 'closedAt' => $c['bizStatus'] === '폐업' ? $c['closedAt'] : '',
                    'importedFrom' => $origin === 'api' ? 'api' : 'file',
                ];
                Store::put('hospitals', $h);
                $this->index($id, $h);
                $n['created']++;
            }
        });

        return $n;
    }
}
