<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ErrorLog;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

class ErrorLogController extends Controller
{
    /** 화면(브라우저)에서 난 오류를 받는다: 한 번에 10건, 사람당 1분 30건까지 */
    public function client(Request $r)
    {
        $me = $this->actor();
        $key = 'client-err:'.$me->id;
        $rows = array_slice((array) $r->input('errors', []), 0, 10);
        foreach ($rows as $e) {
            if (RateLimiter::tooManyAttempts($key, 30)) {
                break;
            }
            RateLimiter::hit($key, 60);
            $e = (array) $e;
            $msg = (string) ($e['message'] ?? '');
            if ($msg === '') {
                continue;
            }
            ErrorLog::record('client', $msg, mb_substr((string) ($e['stack'] ?? ''), 0, 3000)."\n".mb_substr((string) $r->userAgent(), 0, 200), (string) ($e['url'] ?? ''), (string) ($e['key'] ?? ''));
        }

        return response()->json(['ok' => true]);
    }

    public function index(Request $r)
    {
        if ($this->actor()->role_id !== config('crm.admin_role')) {
            return $this->fail('관리자만 볼 수 있습니다', 403, 'FORBIDDEN');
        }
        $q = DB::table('error_logs');
        if (in_array($s = (string) $r->query('source', ''), ['server', 'client'], true)) {
            $q->where('source', $s);
        }
        $rows = $q->orderByDesc('last_at')->limit(300)->get()->map(fn ($x) => [
            'id' => $x->id, 'source' => $x->source, 'message' => $x->message, 'detail' => $x->detail, 'url' => $x->url,
            'userName' => $x->user_name, 'count' => (int) $x->count,
            'firstAt' => Carbon::parse($x->first_at)->toIso8601ZuluString(), 'lastAt' => Carbon::parse($x->last_at)->toIso8601ZuluString(),
        ]);

        return response()->json(['rows' => $rows, 'recent' => ErrorLog::recentCount()]);
    }

    /** 확인한 오류 지우기 (ids 없으면 전부) */
    public function clear(Request $r)
    {
        if ($this->actor()->role_id !== config('crm.admin_role')) {
            return $this->fail('관리자만 할 수 있습니다', 403, 'FORBIDDEN');
        }
        $ids = array_filter(array_map('intval', (array) $r->input('ids', [])));
        $n = $ids ? DB::table('error_logs')->whereIn('id', $ids)->delete() : DB::table('error_logs')->delete();

        return response()->json(['deleted' => $n]);
    }
}
