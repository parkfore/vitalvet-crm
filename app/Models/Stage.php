<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stage extends Model
{
    protected $guarded = ['id'];

    /** 진행 단계(main) 먼저 sort 순, 그 뒤 이탈 단계(exit) */
    public static function ordered()
    {
        return static::query()->orderByRaw("case when kind = 'main' then 0 else 1 end")->orderBy('sort')->orderBy('id')->get();
    }

    public static function initial(): ?self
    {
        return static::query()->where('kind', 'main')->orderBy('sort')->orderBy('id')->first();
    }
}
