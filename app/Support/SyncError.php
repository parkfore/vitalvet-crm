<?php

namespace App\Support;

use RuntimeException;

/** 저장 거부 (권한 없음·형식 오류·동시 수정 충돌) */
class SyncError extends RuntimeException
{
    public function __construct(string $message, public int $status = 422, public string $codeName = 'VALIDATION')
    {
        parent::__construct($message);
    }
}
