<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvalShot;
use App\Models\Hospital;
use App\Services\HospitalService as HS;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** 디지털 수용도 근거 이미지: 서버 비공개 폴더에 저장, 로그인한 권한자만 볼 수 있음 */
class ShotController extends Controller
{
    public function store(Request $r, Hospital $hospital)
    {
        $has = $hospital->evalCount() > 0 || $hospital->shots()->exists();
        Perm::need($this->actor(), 'eval', $has ? 'update' : 'create', $hospital);
        if (! HS::canEvalStage($hospital)) {
            return $this->fail('리드 평가는 1차 방문 이후에 할 수 있습니다');
        }
        $max = config('crm.eval_max_shots');
        if ($hospital->shots()->count() >= $max) {
            return $this->fail("근거 이미지는 최대 {$max}장까지 올릴 수 있습니다");
        }
        $r->validate(['file' => 'required|file|mimes:jpg,jpeg,png,webp|max:5120']);
        $f = $r->file('file');
        HS::mutate($hospital, '리드 평가', function (Hospital $h) use ($f) {
            $path = $f->store("eval-shots/{$h->id}", 'local');
            $h->shots()->create(['path' => $path, 'name' => mb_substr($f->getClientOriginalName() ?: '캡처 이미지', 0, 200), 'mime' => $f->getMimeType(), 'size' => $f->getSize(), 'uploaded_by' => $this->actor()->id]);
        });

        return app(HospitalController::class)->show($hospital->fresh());
    }

    public function show(EvalShot $shot)
    {
        Perm::need($this->actor(), 'eval', 'read');
        abort_unless(Storage::disk('local')->exists($shot->path), 404);

        return Storage::disk('local')->response($shot->path, $shot->name, ['Cache-Control' => 'private, max-age=3600']);
    }

    public function destroy(EvalShot $shot)
    {
        $h = Hospital::findOrFail($shot->hospital_id);
        Perm::need($this->actor(), 'eval', 'update', $h);
        HS::mutate($h, '리드 평가', function () use ($shot) {
            Storage::disk('local')->delete($shot->path);
            $shot->delete();
        });

        return app(HospitalController::class)->show($h->fresh());
    }
}
