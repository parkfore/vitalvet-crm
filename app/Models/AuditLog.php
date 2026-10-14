<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['changes' => 'array', 'at' => 'datetime'];
    }

    public function toPublic(): array
    {
        return [
            'id' => $this->id,
            'at' => $this->at?->format('Y-m-d H:i'),
            'actor_id' => $this->actor_id,
            'actor_name' => $this->actor_name,
            'entity' => $this->entity,
            'entity_id' => $this->entity_id,
            'hospital_id' => $this->hospital_id,
            'target_name' => $this->target_name,
            'action' => $this->action,
            'section' => $this->section,
            'summary' => $this->summary,
            'changes' => $this->getAttribute('changes') ?? [],
        ];
    }
}
