<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Perm;
use Illuminate\Support\Facades\DB;

/** 리드 평가 근거 이미지 보기 (리드 평가 읽기 권한 필요) */
class ShotController extends Controller
{
    public function __invoke(string $id)
    {
        abort_unless(Perm::canRead($this->actor(), 'eval'), 403, '리드 평가 열람 권한이 없습니다');
        $s = DB::table('eval_shots')->where('id', $id)->first();
        abort_unless($s, 404);

        return response(base64_decode($s->data), 200, [
            'Content-Type' => $s->mime,
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
