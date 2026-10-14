<?php

namespace App\Models;

use App\Support\Perm;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['permissions' => 'array', 'locked' => 'boolean'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** 실제 적용되는 권한 (관리자는 전체) */
    public function effective(): array
    {
        return $this->locked ? Perm::full() : Perm::normalize($this->permissions ?? []);
    }
}
