<?php

namespace App\Support;

/** 전화번호 자릿수 확인 (화면의 isMobile·isTel 과 같은 규칙) */
class Phone
{
    public static function digits($v): string
    {
        return preg_replace('/\D/', '', (string) $v);
    }

    /** 휴대폰: 010 은 11자리, 011·016~019 는 10~11자리 */
    public static function mobile($v): bool
    {
        $d = self::digits($v);

        return (bool) (preg_match('/^010\d{8}$/', $d) || preg_match('/^01[16789]\d{7,8}$/', $d));
    }

    /** 일반 전화: 지역번호·070·050·080·대표번호·휴대폰 */
    public static function tel($v): bool
    {
        $d = self::digits($v);

        return self::mobile($d) || (bool) preg_match('/^(02\d{7,8}|0[3-6][1-5]\d{7,8}|070\d{8}|050\d{8,9}|080\d{7,8}|1[5-9]\d{6})$/', $d);
    }

    /** 비어 있으면 통과. 틀리면 SyncError */
    public static function check($v, string $kind, string $label): void
    {
        if (trim((string) $v) === '') {
            return;
        }
        if ($kind === 'mobile' ? ! self::mobile($v) : ! self::tel($v)) {
            throw new SyncError($label.': '.($kind === 'mobile' ? '휴대폰 번호는 010-1234-5678 처럼 010 다음 8자리여야 합니다' : '전화번호 자릿수가 맞지 않습니다'), 422);
        }
    }
}
