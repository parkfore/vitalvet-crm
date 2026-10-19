<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Perm;
use App\Support\Store;
use App\Support\Sync;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** 담당 영업사원 일괄 지정 (전체 병원을 관리하는 역할만) */
class HospitalAssignController extends Controller
{
    public function __invoke(Request $r)
    {
        $me = $this->actor();
        if (! Perm::can($me, 'hospital', 'update') || Perm::scope($me) !== 'all') {
            return $this->fail('담당 일괄 지정 권한이 없습니다 (병원 수정 권한과 전체 병원 범위가 필요합니다)', 403, 'FORBIDDEN');
        }
        $ids = array_values(array_unique(array_filter(array_map('strval', (array) $r->input('ids', [])), fn ($x) => preg_match('/^VV-\d{4,}$/', $x))));
        if (! $ids) {
            return $this->fail('병원을 선택하세요');
        }
        if (count($ids) > 10000) {
            return $this->fail('한 번에 10,000곳까지 지정할 수 있습니다');
        }
        $owner = (string) $r->input('ownerId', '');
        $ou = $owner === '' ? null : User::find($owner);
        if ($owner !== '' && (! $ou || ! $ou->isActive())) {
            return $this->fail('활성 사용자만 담당자로 지정할 수 있습니다');
        }
        $after = $ou ? $ou->name() : '';
        $names = User::all()->mapWithKeys(fn ($u) => [$u->id => $u->name()]);
        $n = 0;
        DB::transaction(function () use ($ids, $owner, $after, $names, $me, &$n) {
            foreach (array_chunk($ids, 500) as $chunk) {
                foreach (DB::table('hospitals')->whereIn('id', $chunk)->whereNull('deleted_at')->lockForUpdate()->get() as $row) {
                    $h = Store::decode($row);
                    if (($h['ownerId'] ?? '') === $owner) {
                        continue;
                    }
                    $before = $names[$h['ownerId'] ?? ''] ?? '';
                    $h['ownerId'] = $owner;
                    Store::put('hospitals', $h);
                    Sync::log($me, ['entity' => 'hospital', 'entityId' => $h['id'], 'hospitalId' => $h['id'], 'targetName' => $h['name'] ?? '', 'action' => 'update',
                        'section' => '담당 일괄 지정', 'changes' => [['field' => '담당 영업사원', 'before' => $before, 'after' => $after]]]);
                    $n++;
                }
            }
        });

        return response()->json(['changed' => $n]);
    }
}
