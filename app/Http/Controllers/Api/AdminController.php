<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AccessLog;
use App\Support\Backup;
use App\Support\Geo;
use App\Support\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** 관리자 전용: 백업 확인·내려받기, 접속·이용 기록 */
class AdminController extends Controller
{
    private function admin(): bool
    {
        $u = $this->actor();

        return $u->isActive() && $u->role_id === config('crm.admin_role');
    }

    private function deny()
    {
        return $this->fail('관리자만 볼 수 있습니다', 403, 'FORBIDDEN');
    }

    public function backups()
    {
        if (! $this->admin()) {
            return $this->deny();
        }
        $last = Store::setting('schedule_ping');

        return response()->json(['list' => Backup::list(), 'last' => Store::setting('backup_last'), 'keepDays' => Backup::KEEP_DAYS,
            'scheduler' => $last, 'tables' => Backup::TABLES]);
    }

    public function backupNow()
    {
        if (! $this->admin()) {
            return $this->deny();
        }
        $b = Backup::create('manual', $this->actor()->name());
        AccessLog::log('backup', $this->actor(), $b['name']);

        return response()->json($b);
    }

    public function download(string $name)
    {
        if (! $this->admin()) {
            return $this->deny();
        }
        $name = basename($name);
        if (! Backup::valid($name)) {
            return $this->fail('백업 파일을 찾을 수 없습니다', 404, 'NOT_FOUND');
        }
        AccessLog::log('backup_download', $this->actor(), $name);

        return response()->download(Backup::dir().'/'.$name, $name, ['Content-Type' => 'application/gzip']);
    }

    /** 접속·이용 기록: 사람·종류·기간으로 걸러 최근 순 100개씩 */
    public function logs(Request $r)
    {
        if (! $this->admin()) {
            return $this->deny();
        }
        $q = DB::table('access_logs');
        if ($u = (string) $r->query('user', '')) {
            $q->where('user_id', $u);
        }
        if ($e = (string) $r->query('event', '')) {
            $q->where('event', $e);
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r->query('from', ''))) {
            $q->where('created_at', '>=', $r->query('from').' 00:00:00');
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r->query('to', ''))) {
            $q->where('created_at', '<=', $r->query('to').' 23:59:59');
        }
        if ($s = trim((string) $r->query('q', ''))) {
            $q->where(fn ($w) => $w->where('ip', 'like', "%$s%")->orWhere('detail', 'like', "%$s%")->orWhere('username', 'like', "%$s%"));
        }
        $total = (clone $q)->count();
        $page = max(1, (int) $r->query('page', 1));
        $rows = $q->orderByDesc('id')->offset(($page - 1) * 100)->limit(100)->get()
            ->map(fn ($x) => ['id' => $x->id, 'at' => \Illuminate\Support\Carbon::parse($x->created_at)->toIso8601ZuluString(), 'userId' => $x->user_id, 'username' => $x->username,
                'name' => $x->name, 'event' => $x->event, 'detail' => $x->detail, 'ip' => $x->ip, 'ua' => $x->ua]);
        // 오늘 요약
        $today = DB::table('access_logs')->where('created_at', '>=', now()->startOfDay());
        $sum = ['logins' => (clone $today)->where('event', 'login')->count(), 'fails' => (clone $today)->where('event', 'login_fail')->count(),
            'users' => (clone $today)->whereNotNull('user_id')->distinct()->count('user_id')];

        return response()->json(['rows' => $rows, 'total' => $total, 'page' => $page, 'events' => AccessLog::EVENTS, 'today' => $sum, 'geocoder' => Geo::provider()]);
    }
}
