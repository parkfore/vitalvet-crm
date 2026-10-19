<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Perm;
use App\Support\Store;

/** 병원 등록 직전에 새 Lead 번호(VV-0000) 받기 */
class HospitalIdController extends Controller
{
    public function __invoke()
    {
        if (! Perm::can($this->actor(), 'hospital', 'create')) {
            return $this->fail('병원 등록 권한이 없습니다', 403, 'FORBIDDEN');
        }

        return response()->json(['id' => Store::reserveHospitalId()]);
    }
}
