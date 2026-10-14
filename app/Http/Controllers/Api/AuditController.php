<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\Perm;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $r)
    {
        Perm::need($this->actor(), 'history', 'read');
        $q = AuditLog::query()->orderByDesc('at')->orderByDesc('id');
        foreach (['entity', 'action', 'actor_id'] as $k) {
            if ($r->filled($k)) {
                $q->where($k, $r->input($k));
            }
        }
        if ($r->filled('q')) {
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], $r->input('q')).'%';
            $q->where(fn ($w) => $w->where('target_name', 'like', $term)->orWhere('summary', 'like', $term)->orWhere('section', 'like', $term));
        }
        $page = $q->paginate(60);

        return response()->json(['items' => collect($page->items())->map->toPublic(), 'total' => $page->total(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage()]);
    }
}
