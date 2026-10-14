<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CodeItem;
use App\Models\Hospital;
use App\Models\Setting;
use App\Support\Audit;
use App\Support\Perm;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function update(Request $r)
    {
        Perm::need($this->actor(), 'settings', 'update');
        $d = $r->validate(['visit_goal' => 'required|integer|min:1|max:20']);
        $old = Setting::get('visit_goal', 4);
        Setting::put('visit_goal', (int) $d['visit_goal']);
        if ((int) $old !== (int) $d['visit_goal']) {
            Audit::log('settings', 'visit_goal', '영업 목표', 'update', '설정', [['field' => '일일 방문 목표', 'before' => (string) $old, 'after' => (string) $d['visit_goal']]]);
        }

        return response()->json(['ok' => true]);
    }

    /** 선택 목록(병원 등급·전문과) 저장: 순서대로 전체 목록 */
    public function codes(Request $r, string $grp)
    {
        Perm::need($this->actor(), 'settings', 'update');
        abort_unless(in_array($grp, ['grade', 'specialty'], true), 404);
        $d = $r->validate(['values' => 'required|array|min:1', 'values.*' => 'required|string|max:40|distinct']);
        $before = CodeItem::where('grp', $grp)->orderBy('sort')->pluck('value')->implode(', ');
        CodeItem::where('grp', $grp)->delete();
        foreach ($d['values'] as $i => $v) {
            CodeItem::create(['grp' => $grp, 'value' => trim($v), 'sort' => $i]);
        }
        $after = implode(', ', $d['values']);
        $label = $grp === 'grade' ? '병원 등급 목록' : '전문과 목록';
        if ($before !== $after) {
            Audit::log('settings', $grp, $label, 'update', '설정', [['field' => '항목', 'before' => $before, 'after' => $after]]);
        }

        return response()->json(['ok' => true, 'in_use_removed' => Hospital::whereNotIn($grp === 'grade' ? 'grade' : 'specialty', $d['values'])->whereNotNull($grp === 'grade' ? 'grade' : 'specialty')->count()]);
    }
}
