<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\Audit;
use App\Support\Perm;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    private function v(Request $r, ?Category $c = null): array
    {
        return $r->validate([
            'name' => ['required', 'string', 'max:40', Rule::unique('categories')->ignore($c?->id)],
            'description' => 'nullable|string|max:200',
            'color' => 'required|string|max:20',
        ], ['name.unique' => '같은 이름의 카테고리가 이미 있습니다.']);
    }

    private function snap(Category $c): array
    {
        return ['name' => ['이름', $c->name], 'desc' => ['설명', $c->description], 'color' => ['색상', $c->color]];
    }

    public function store(Request $r)
    {
        Perm::need($this->actor(), 'category', 'create');
        $c = Category::create($this->v($r) + ['sort' => (int) Category::max('sort') + 1]);
        Audit::log('category', $c->id, $c->name, 'create', '카테고리', Audit::diff([], $this->snap($c)));

        return response()->json($c, 201);
    }

    public function update(Request $r, Category $category)
    {
        Perm::need($this->actor(), 'category', 'update');
        $before = $this->snap($category);
        $category->update($this->v($r, $category));
        if ($ch = Audit::diff($before, $this->snap($category))) {
            Audit::log('category', $category->id, $category->name, 'update', '카테고리', $ch);
        }

        return response()->json($category);
    }

    public function destroy(Category $category)
    {
        Perm::need($this->actor(), 'category', 'delete');
        $n = $category->hospitals()->count();
        Audit::log('category', $category->id, $category->name, 'delete', '카테고리', Audit::diff($this->snap($category), []), null, $n ? "병원 {$n}곳에서 빠짐" : null);
        $category->delete();

        return response()->json(['ok' => true, 'detached' => $n]);
    }
}
