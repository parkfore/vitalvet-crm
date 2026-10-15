<?php

namespace App\Support;

use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Http;

/**
 * 주소 → 좌표
 *
 * 1) 카카오 로컬 API (KAKAO_REST_KEY) 또는 네이버 Geocoding (NAVER_MAP_CLIENT_ID + SECRET) 으로 주소를 찾는다.
 * 2) 찾지 못하면 공공데이터의 좌표(중부원점 TM, EPSG:5174)를 위도·경도로 바꿔 쓴다.
 */
class Geo
{
    /** 쓸 수 있는 주소 검색 서비스: kakao | naver | '' */
    public static function provider(): string
    {
        $pref = config('services.maps.provider') === 'naver' ? ['naver', 'kakao'] : ['kakao', 'naver'];
        foreach ($pref as $p) {
            if ($p === 'kakao' && config('services.maps.kakao.rest_key')) {
                return 'kakao';
            }
            if ($p === 'naver' && config('services.maps.naver.client_id') && config('services.maps.naver.client_secret')) {
                return 'naver';
            }
        }

        return '';
    }

    /**
     * 주소 여러 개를 한 번에 (동시에 10개씩)
     *
     * @param  array<string,string>  $addrs  [키 => 주소]
     * @return array<string,array{lat:float,lng:float,zip:string,sido:string,sigungu:string,road:string,jibun:string}|null>
     */
    public static function many(array $addrs): array
    {
        $out = array_fill_keys(array_keys($addrs), null);
        $p = self::provider();
        $addrs = array_filter($addrs, fn ($a) => trim((string) $a) !== '');
        if (! $p || ! $addrs) {
            return $out;
        }
        foreach (array_chunk($addrs, 10, true) as $chunk) {
            try {
                $res = Http::pool(function (Pool $pool) use ($chunk, $p) {
                    $rq = [];
                    foreach ($chunk as $k => $a) {
                        $rq[] = $p === 'kakao'
                            ? $pool->as((string) $k)->timeout(6)->withHeaders(['Authorization' => 'KakaoAK '.config('services.maps.kakao.rest_key')])
                                ->get('https://dapi.kakao.com/v2/local/search/address.json', ['query' => self::clean($a), 'size' => 1])
                            : $pool->as((string) $k)->timeout(6)->withHeaders([
                                'x-ncp-apigw-api-key-id' => config('services.maps.naver.client_id'),
                                'x-ncp-apigw-api-key' => config('services.maps.naver.client_secret'),
                                'Accept' => 'application/json',
                            ])->get('https://maps.apigw.ntruss.com/map-geocode/v2/geocode', ['query' => self::clean($a)]);
                    }

                    return $rq;
                });
            } catch (\Throwable) {
                continue;
            }
            foreach ($chunk as $k => $_) {
                $r = $res[(string) $k] ?? null;
                if (! $r instanceof \Illuminate\Http\Client\Response || ! $r->successful()) {
                    continue;
                }
                $out[$k] = $p === 'kakao' ? self::fromKakao((array) $r->json()) : self::fromNaver((array) $r->json());
            }
        }

        return $out;
    }

    public static function one(string $addr): ?array
    {
        return self::many(['a' => $addr])['a'];
    }

    /** 검색에 방해되는 괄호·층수 정보 빼기: "서울특별시 강남구 테헤란로 1, 2층 (역삼동)" → "서울특별시 강남구 테헤란로 1" */
    public static function clean(string $a): string
    {
        $a = preg_replace('/\s*\([^)]*\)\s*/u', ' ', $a);
        $a = preg_replace('/,.*$/u', '', $a);

        return trim(preg_replace('/\s+/u', ' ', $a));
    }

    private static function fromKakao(array $j): ?array
    {
        $d = $j['documents'][0] ?? null;
        if (! $d || ! isset($d['x'], $d['y'])) {
            return null;
        }
        $road = $d['road_address'] ?? null;
        $jib = $d['address'] ?? null;
        $reg = $road ?: $jib ?: [];

        return [
            'lat' => round((float) $d['y'], 7), 'lng' => round((float) $d['x'], 7),
            'zip' => (string) ($road['zone_no'] ?? ''),
            'sido' => (string) ($reg['region_1depth_name'] ?? ''), 'sigungu' => (string) ($reg['region_2depth_name'] ?? ''),
            'road' => (string) ($road['address_name'] ?? ''), 'jibun' => (string) ($jib['address_name'] ?? ''),
        ];
    }

    private static function fromNaver(array $j): ?array
    {
        $d = $j['addresses'][0] ?? null;
        if (! $d || ! isset($d['x'], $d['y'])) {
            return null;
        }
        $el = [];
        foreach ((array) ($d['addressElements'] ?? []) as $e) {
            $el[($e['types'][0] ?? '')] = (string) ($e['longName'] ?? '');
        }

        return [
            'lat' => round((float) $d['y'], 7), 'lng' => round((float) $d['x'], 7),
            'zip' => $el['POSTAL_CODE'] ?? '', 'sido' => $el['SIDO'] ?? '', 'sigungu' => $el['SIGUGUN'] ?? '',
            'road' => (string) ($d['roadAddress'] ?? ''), 'jibun' => (string) ($d['jibunAddress'] ?? ''),
        ];
    }

    /**
     * 중부원점 TM(EPSG:5174, 지방행정 인허가 데이터 좌표) → WGS84 위도·경도
     * Bessel 타원체 역 횡메르카토르 + 7변수 변환(-115.80, 474.99, 674.11, 1.16″, -2.31″, -1.63″, 6.43ppm)
     *
     * @return array{lat:float,lng:float}|null
     */
    public static function tmToWgs84($x, $y): ?array
    {
        if (! is_numeric($x) || ! is_numeric($y)) {
            return null;
        }
        $x = (float) $x;
        $y = (float) $y;
        if ($x < 0 || $x > 700000 || $y < -200000 || $y > 1000000 || ($x == 0 && $y == 0)) {
            return null;
        }
        // 1) 역 횡메르카토르 (Bessel 1841)
        $a = 6377397.155;
        $f = 1 / 299.1528128;
        $e2 = 2 * $f - $f * $f;
        $ep2 = $e2 / (1 - $e2);
        $lat0 = deg2rad(38);
        $lon0 = deg2rad(127.0028902777778);
        $k0 = 1.0;
        $x0 = 200000;
        $y0 = 500000;
        $M = fn ($p) => $a * ((1 - $e2 / 4 - 3 * $e2 ** 2 / 64 - 5 * $e2 ** 3 / 256) * $p - (3 * $e2 / 8 + 3 * $e2 ** 2 / 32 + 45 * $e2 ** 3 / 1024) * sin(2 * $p)
            + (15 * $e2 ** 2 / 256 + 45 * $e2 ** 3 / 1024) * sin(4 * $p) - (35 * $e2 ** 3 / 3072) * sin(6 * $p));
        $m = $M($lat0) + ($y - $y0) / $k0;
        $mu = $m / ($a * (1 - $e2 / 4 - 3 * $e2 ** 2 / 64 - 5 * $e2 ** 3 / 256));
        $e1 = (1 - sqrt(1 - $e2)) / (1 + sqrt(1 - $e2));
        $p1 = $mu + (3 * $e1 / 2 - 27 * $e1 ** 3 / 32) * sin(2 * $mu) + (21 * $e1 ** 2 / 16 - 55 * $e1 ** 4 / 32) * sin(4 * $mu)
            + (151 * $e1 ** 3 / 96) * sin(6 * $mu) + (1097 * $e1 ** 4 / 512) * sin(8 * $mu);
        $c1 = $ep2 * cos($p1) ** 2;
        $t1 = tan($p1) ** 2;
        $n1 = $a / sqrt(1 - $e2 * sin($p1) ** 2);
        $r1 = $a * (1 - $e2) / (1 - $e2 * sin($p1) ** 2) ** 1.5;
        $d = ($x - $x0) / ($n1 * $k0);
        $lat = $p1 - ($n1 * tan($p1) / $r1) * ($d ** 2 / 2 - (5 + 3 * $t1 + 10 * $c1 - 4 * $c1 ** 2 - 9 * $ep2) * $d ** 4 / 24
            + (61 + 90 * $t1 + 298 * $c1 + 45 * $t1 ** 2 - 252 * $ep2 - 3 * $c1 ** 2) * $d ** 6 / 720);
        $lon = $lon0 + ($d - (1 + 2 * $t1 + $c1) * $d ** 3 / 6 + (5 - 2 * $c1 + 28 * $t1 - 3 * $c1 ** 2 + 8 * $ep2 + 24 * $t1 ** 2) * $d ** 5 / 120) / cos($p1);

        // 2) Bessel 위경도 → 지구중심 좌표 → 7변수 변환 → WGS84
        $n = $a / sqrt(1 - $e2 * sin($lat) ** 2);
        $X = $n * cos($lat) * cos($lon);
        $Y = $n * cos($lat) * sin($lon);
        $Z = $n * (1 - $e2) * sin($lat);
        $sec = M_PI / (180 * 3600);
        [$rx, $ry, $rz] = [1.16 * $sec, -2.31 * $sec, -1.63 * $sec];
        $s = 1 + 6.43e-6;
        $X2 = -115.80 + $s * ($X - $rz * $Y + $ry * $Z);
        $Y2 = 474.99 + $s * ($rz * $X + $Y - $rx * $Z);
        $Z2 = 674.11 + $s * (-$ry * $X + $rx * $Y + $Z);
        $aw = 6378137.0;
        $fw = 1 / 298.257223563;
        $ew2 = 2 * $fw - $fw * $fw;
        $pp = sqrt($X2 ** 2 + $Y2 ** 2);
        $la = atan2($Z2, $pp * (1 - $ew2));
        for ($i = 0; $i < 6; $i++) {
            $nw = $aw / sqrt(1 - $ew2 * sin($la) ** 2);
            $la = atan2($Z2 + $ew2 * $nw * sin($la), $pp);
        }
        $lo = atan2($Y2, $X2);

        return ['lat' => round(rad2deg($la), 7), 'lng' => round(rad2deg($lo), 7)];
    }
}
