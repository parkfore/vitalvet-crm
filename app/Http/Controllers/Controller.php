<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;

abstract class Controller
{
    protected function actor(): User
    {
        /** @var User $u */
        $u = auth()->user();

        return $u;
    }

    /** 업무 규칙 위반 응답 (422) */
    protected function fail(string $message, int $status = 422, string $code = 'VALIDATION'): JsonResponse
    {
        return response()->json(['code' => $code, 'message' => $message], $status);
    }

    /** 전화번호 하이픈 정리 (02 지역번호 포함) */
    protected function phone(?string $v): ?string
    {
        $d = preg_replace('/\D/', '', (string) $v);
        if ($d === '') {
            return null;
        }
        if (str_starts_with($d, '02')) {
            return strlen($d) <= 9 ? preg_replace('/^(02)(\d{3})(\d{0,4})$/', '$1-$2-$3', $d) : preg_replace('/^(02)(\d{4})(\d{0,4}).*$/', '$1-$2-$3', $d);
        }
        if (strlen($d) === 8) {
            return preg_replace('/^(\d{4})(\d{4})$/', '$1-$2', $d);
        }

        return strlen($d) <= 10 ? preg_replace('/^(\d{3})(\d{3})(\d{0,4})$/', '$1-$2-$3', $d) : preg_replace('/^(\d{3})(\d{4})(\d{0,4}).*$/', '$1-$2-$3', $d);
    }
}
