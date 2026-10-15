<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;

/**
 * 공공데이터 API 불러오기 (공공데이터포털 data.go.kr 등)
 *
 * 설정: 요청 주소(End Point), 인증키(serviceKey), 추가 조건(예: type=json&cond[...]=...)
 * 응답이 JSON 이든 XML 이든, 안에 들어 있는 "행 목록"과 전체 건수를 찾아 꺼낸다.
 */
class PublicApi
{
    public const KEY = 'public_api';

    public static function config(): array
    {
        $c = (array) Store::setting(self::KEY, []);

        return ['url' => (string) ($c['url'] ?? ''), 'key' => (string) ($c['key'] ?? ''), 'params' => (string) ($c['params'] ?? ''),
            'rows' => max(10, min(1000, (int) ($c['rows'] ?? 100))), 'last' => $c['last'] ?? null];
    }

    /** 화면에 보여줄 설정 (인증키는 끝 4자리만) */
    public static function publicConfig(): array
    {
        $c = self::config();

        return ['url' => $c['url'], 'params' => $c['params'], 'rows' => $c['rows'], 'hasKey' => $c['key'] !== '',
            'keyTail' => $c['key'] !== '' ? substr($c['key'], -4) : '', 'last' => $c['last']];
    }

    /**
     * @return array{total:int,items:array<int,array>}
     */
    public static function fetch(int $page, ?int $rows = null): array
    {
        $c = self::config();
        if ($c['url'] === '' || $c['key'] === '') {
            throw new SyncError('설정 > 병원 정보 연동에서 API 요청 주소와 인증키를 먼저 저장하세요', 422);
        }
        if (! preg_match('#^https?://#i', $c['url'])) {
            throw new SyncError('API 요청 주소는 http:// 또는 https:// 로 시작해야 합니다', 422);
        }
        // 인증키: 포털의 "Encoding" 키(%2B 등)를 넣어도 한 번만 인코딩되도록 풀어 둔다
        $key = preg_match('/%[0-9A-Fa-f]{2}/', $c['key']) ? rawurldecode($c['key']) : $c['key'];
        parse_str(ltrim($c['params'], '?&'), $extra);
        $q = array_merge(['serviceKey' => $key, 'pageNo' => $page, 'numOfRows' => $rows ?? $c['rows']], $extra);
        try {
            $r = Http::timeout(30)->retry(2, 800, throw: false)->accept('application/json, application/xml, text/xml, */*')->get($c['url'], $q);
        } catch (\Throwable $e) {
            throw new SyncError('공공데이터 API에 연결하지 못했습니다: '.mb_substr($e->getMessage(), 0, 120), 502);
        }
        $body = (string) $r->body();
        $data = self::decode($body);
        $err = self::error($data);
        $hint = [
            'SERVICE_KEY_IS_NOT_REGISTERED' => ' · 인증키가 아직 등록되지 않았거나 잘못됐습니다. 활용신청 승인 후 1~2시간 뒤부터 쓸 수 있고, 포털의 "일반 인증키(Decoding)"를 넣어 보세요',
            'LIMITED_NUMBER_OF_SERVICE_REQUESTS' => ' · 오늘 호출 한도를 넘었습니다. 내일 다시 하거나 포털에서 한도를 늘리세요',
            'NO_OPENAPI_SERVICE' => ' · 요청 주소가 잘못됐습니다. 포털 상세 화면의 요청주소(End Point)와 오퍼레이션 이름을 확인하세요',
            'UNREGISTERED_IP' => ' · 이 서버 IP 가 등록되지 않았습니다. 포털에서 IP 제한을 확인하세요',
        ];
        foreach ($hint as $k => $v) {
            if ($err && str_contains($err, $k)) {
                $err .= $v;
            }
        }
        if (! $r->successful() || $err) {
            throw new SyncError('공공데이터 API 오류: '.($err ?: 'HTTP '.$r->status().' '.mb_substr(strip_tags($body), 0, 120)), 502);
        }
        $items = self::items($data);
        $total = self::total($data);

        return ['total' => $total ?? count($items), 'items' => $items];
    }

    public static function decode(string $body): array
    {
        $t = ltrim($body);
        if ($t === '') {
            return [];
        }
        if ($t[0] === '{' || $t[0] === '[') {
            return (array) json_decode($t, true);
        }
        if ($t[0] === '<') {
            $prev = libxml_use_internal_errors(true);
            $x = simplexml_load_string($t, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_NONET);
            libxml_use_internal_errors($prev);
            if ($x !== false) {
                return [$x->getName() => self::xml($x)];
            }
        }

        return ['_text' => mb_substr(strip_tags($t), 0, 300)];
    }

    private static function xml(\SimpleXMLElement $x)
    {
        $kids = $x->children();
        if (! count($kids)) {
            return trim((string) $x);
        }
        $o = [];
        $multi = [];
        foreach ($kids as $name => $k) {
            $v = self::xml($k);
            if (! array_key_exists($name, $o)) {
                $o[$name] = $v;
            } else {
                if (! isset($multi[$name])) {
                    $o[$name] = [$o[$name]];
                    $multi[$name] = true;
                }
                $o[$name][] = $v;
            }
        }

        return $o;
    }

    /** 오류 메시지 찾기 (resultCode 가 정상이 아니거나 OpenAPI 오류 응답) */
    public static function error(array $d): string
    {
        $code = self::find($d, ['resultcode', 'returnreasoncode', 'errorcode']);
        $msg = null;
        foreach (['returnauthmsg', 'resultmsg', 'errmsg', 'message'] as $k) {
            $msg ??= self::find($d, [$k]);
        }
        if (isset($d['_text'])) {
            return $d['_text'];
        }
        if ($code !== null && is_scalar($code) && ! in_array(strtoupper((string) $code), ['00', '0', '000', '200', 'INFO-000', 'SUCCESS', 'NORMAL_SERVICE', ''], true)) {
            return trim(($msg && is_scalar($msg) ? $msg : '').' ('.$code.')');
        }

        return '';
    }

    private static function find($d, array $keys, int $depth = 0)
    {
        if (! is_array($d) || $depth > 6) {
            return null;
        }
        foreach ($d as $k => $v) {
            if (is_string($k) && in_array(strtolower(str_replace('_', '', $k)), $keys, true) && ! is_array($v)) {
                return $v;
            }
        }
        foreach ($d as $v) {
            $r = self::find($v, $keys, $depth + 1);
            if ($r !== null) {
                return $r;
            }
        }

        return null;
    }

    public static function total(array $d): ?int
    {
        $v = self::find($d, ['totalcount', 'listtotalcount', 'totalcnt', 'total']);

        return is_numeric($v) ? (int) $v : null;
    }

    /** 가장 큰 "레코드 목록" 찾기: 같은 모양의 객체가 줄지어 있는 배열 */
    public static function items(array $d): array
    {
        $best = [];
        $walk = function ($v, int $depth) use (&$walk, &$best) {
            if (! is_array($v) || $depth > 8) {
                return;
            }
            if (array_is_list($v) && $v && is_array($v[0]) && ! array_is_list($v[0]) && count($v[0]) >= 3) {
                if (count($v) > count($best)) {
                    $best = $v;
                }

                return;
            }
            // XML 에서 한 건만 오면 목록이 아니라 객체 하나로 온다: items.item = {...}
            if (isset($v['item']) && is_array($v['item']) && ! array_is_list($v['item']) && count($v['item']) >= 3 && ! $best) {
                $best = [$v['item']];
            }
            foreach ($v as $x) {
                $walk($x, $depth + 1);
            }
        };
        $walk($d, 0);

        return array_values(array_map(fn ($r) => array_map(fn ($x) => is_array($x) ? '' : $x, $r), $best));
    }
}
