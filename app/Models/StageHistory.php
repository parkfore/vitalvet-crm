<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StageHistory extends Model
{
    protected $table = 'stage_history';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'auto' => 'boolean'];
    }
}
