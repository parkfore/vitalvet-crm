<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Category extends Model
{
    protected $guarded = ['id'];

    public function hospitals(): BelongsToMany
    {
        return $this->belongsToMany(Hospital::class);
    }
}
