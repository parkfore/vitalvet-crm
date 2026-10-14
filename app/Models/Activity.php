<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Activity extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d'];
    }

    public function hospital(): BelongsTo
    {
        return $this->belongsTo(Hospital::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function toPublic(): array
    {
        return [
            'id' => $this->id,
            'hospital_id' => $this->hospital_id,
            'author_id' => $this->author_id,
            'author_name' => $this->author?->name,
            'type' => $this->type,
            'date' => $this->date?->toDateString(),
            'purpose' => $this->purpose,
            'contact' => $this->contact,
            'reaction' => $this->reaction,
            'note' => $this->note,
            'voc_type' => $this->voc_type,
            'voc_text' => $this->voc_text,
            'comp_id' => $this->comp_id,
            'comp_text' => $this->comp_text,
            'issue_type' => $this->issue_type,
            'issue_text' => $this->issue_text,
        ];
    }
}
