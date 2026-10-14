<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Sync;
use App\Support\SyncError;
use Illuminate\Http\Request;

/** 화면에서 바뀐 내용 저장 (권한 확인 후 바뀐 항목만 반영) */
class SyncController extends Controller
{
    public function __invoke(Request $r)
    {
        try {
            $res = (new Sync($this->actor()))->apply($r->all());
        } catch (SyncError $e) {
            return $this->fail($e->getMessage(), $e->status, $e->codeName);
        }

        return response()->json(['ok' => true] + $res);
    }
}
