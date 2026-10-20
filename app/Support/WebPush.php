<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * 웹푸시 발송 (외부 라이브러리 없이 PHP openssl 로 구현)
 * - 내용 암호화: RFC 8291 (aes128gcm)
 * - 보내는 서버 확인: RFC 8292 (VAPID, ES256)
 * 키는 처음 쓸 때 자동으로 만들어 app_settings 'vapid' 에 보관한다 (화면에는 공개 키만 보낸다).
 */
class WebPush
{
    private const SPKI_P256 = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

    public static function b64u(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    public static function unb64u(string $s): string
    {
        return (string) base64_decode(strtr($s, '-_', '+/').str_repeat('=', (4 - strlen($s) % 4) % 4));
    }

    /** @return array{pem:string, pub:string} pub = 공개 키(65바이트, base64url) */
    public static function keys(): array
    {
        $k = Store::setting('vapid');
        if (is_array($k) && ! empty($k['pem']) && ! empty($k['pub'])) {
            return $k;
        }
        [$pem, $pub] = self::newKey();
        $k = ['pem' => $pem, 'pub' => self::b64u($pub)];
        Store::putSetting('vapid', $k);

        return $k;
    }

    public static function publicKey(): string
    {
        return self::keys()['pub'];
    }

    /** P-256 키 쌍 [PEM 개인 키, 65바이트 공개 키] */
    private static function newKey(): array
    {
        $res = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if (! $res) {
            throw new RuntimeException('웹푸시 키를 만들지 못했습니다: '.openssl_error_string());
        }
        openssl_pkey_export($res, $pem);
        $d = openssl_pkey_get_details($res)['ec'];
        $pub = "\x04".str_pad($d['x'], 32, "\0", STR_PAD_LEFT).str_pad($d['y'], 32, "\0", STR_PAD_LEFT);

        return [$pem, $pub, $res];
    }

    private static function pubKeyRes(string $raw65)
    {
        $pem = "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode(hex2bin(self::SPKI_P256).$raw65), 64, "\n")."-----END PUBLIC KEY-----\n";
        $k = openssl_pkey_get_public($pem);
        if (! $k) {
            throw new RuntimeException('받는 기기의 키가 올바르지 않습니다');
        }

        return $k;
    }

    private static function hmac(string $key, string $data): string
    {
        return hash_hmac('sha256', $data, $key, true);
    }

    /** RFC 8291 암호화: 보낼 본문(바이너리) */
    public static function encrypt(string $payload, string $p256dh, string $auth, ?array $eph = null, ?string $salt = null): string
    {
        $ua = self::unb64u($p256dh);
        $authSecret = self::unb64u($auth);
        if (strlen($ua) !== 65 || strlen($authSecret) < 16) {
            throw new RuntimeException('받는 기기의 키가 올바르지 않습니다');
        }
        [, $asPub, $asPriv] = $eph ?? self::newKey();
        $ecdh = openssl_pkey_derive(self::pubKeyRes($ua), $asPriv, 32);
        if ($ecdh === false) {
            throw new RuntimeException('암호화 키 계산 실패: '.openssl_error_string());
        }
        $ecdh = str_pad($ecdh, 32, "\0", STR_PAD_LEFT);
        $prkKey = self::hmac($authSecret, $ecdh);
        $ikm = self::hmac($prkKey, "WebPush: info\0".$ua.$asPub."\x01");
        $salt ??= random_bytes(16);
        $prk = self::hmac($salt, $ikm);
        $cek = substr(self::hmac($prk, "Content-Encoding: aes128gcm\0\x01"), 0, 16);
        $nonce = substr(self::hmac($prk, "Content-Encoding: nonce\0\x01"), 0, 12);
        $ct = openssl_encrypt($payload."\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);

        return $salt.pack('N', 4096).chr(65).$asPub.$ct.$tag;
    }

    /** RFC 8292 VAPID 헤더 값 */
    public static function vapid(string $endpoint, ?int $exp = null): string
    {
        $k = self::keys();
        $u = parse_url($endpoint);
        $aud = $u['scheme'].'://'.$u['host'].(isset($u['port']) ? ':'.$u['port'] : '');
        $h = self::b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $p = self::b64u(json_encode(['aud' => $aud, 'exp' => $exp ?? time() + 12 * 3600, 'sub' => 'mailto:'.(config('mail.from.address') ?: 'admin@vitalvet.co.kr')], JSON_UNESCAPED_SLASHES));
        openssl_sign("$h.$p", $der, $k['pem'], OPENSSL_ALGO_SHA256);

        return 'vapid t='."$h.$p.".self::b64u(self::derToRaw($der)).', k='.$k['pub'];
    }

    /** ECDSA 서명 DER → r||s (64바이트) */
    private static function derToRaw(string $der): string
    {
        $o = 2;
        if (ord($der[1]) & 0x80) {
            $o += ord($der[1]) & 0x7F;
        }
        $out = '';
        for ($i = 0; $i < 2; $i++) {
            $len = ord($der[$o + 1]);
            $v = substr($der, $o + 2, $len);
            $out .= str_pad(ltrim($v, "\0"), 32, "\0", STR_PAD_LEFT);
            $o += 2 + $len;
        }

        return $out;
    }

    /**
     * 한 기기로 보내기
     *
     * @return int HTTP 상태 (201 성공, 404·410 은 더 이상 없는 기기)
     */
    public static function send(array $sub, array $msg, string $urgency = 'normal', int $ttl = 86400): int
    {
        $body = self::encrypt(json_encode($msg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $sub['p256dh'], $sub['auth']);
        $res = Http::timeout(10)->withHeaders([
            'Authorization' => self::vapid($sub['endpoint']),
            'TTL' => (string) $ttl,
            'Urgency' => $urgency,
            'Content-Encoding' => 'aes128gcm',
            'Content-Type' => 'application/octet-stream',
        ] + (isset($msg['tag']) ? ['Topic' => substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string) $msg['tag']), 0, 32)] : []))
            ->withBody($body, 'application/octet-stream')->post($sub['endpoint']);

        return $res->status();
    }
}
