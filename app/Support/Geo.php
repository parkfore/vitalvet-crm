<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Throwable;

/** 주소 → 좌표 (카카오 로컬 REST API, 서버에서만 호출). 키가 없거나 실패하면 null */
class Geo
{
    public static function lookup(?string $address): ?array
    {
        $key = config('services.maps.kakao.rest_key');
        if (! $key || ! $address) {
            return null;
        }
        try {
            $res = Http::timeout(4)->withHeaders(['Authorization' => 'KakaoAK '.$key])
                ->get('https://dapi.kakao.com/v2/local/search/address.json', ['query' => $address]);
            $doc = $res->json('documents.0');

            return $doc ? ['lat' => (float) $doc['y'], 'lng' => (float) $doc['x']] : null;
        } catch (Throwable) {
            return null;
        }
    }
}
