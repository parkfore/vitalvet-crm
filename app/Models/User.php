<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $guarded = ['id'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'annual_leave' => 'float',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** 아이디 규칙: 영문 소문자로 시작, 영문 소문자·숫자·._- 4~30자 */
    public const USERNAME_RULE = ['required', 'string', 'min:4', 'max:30', 'regex:/^[a-z][a-z0-9._-]{3,29}$/'];

    /** 아이디는 항상 소문자·공백 제거로 저장 */
    protected function username(): \Illuminate\Database\Eloquent\Casts\Attribute
    {
        return \Illuminate\Database\Eloquent\Casts\Attribute::make(set: fn ($v) => $v === null ? null : strtolower(trim($v)));
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /** 화면에 내려줄 공개 정보 */
    public function toPublic(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'team' => $this->team,
            'phone' => $this->phone,
            'role_id' => $this->role_id,
            'role_name' => $this->role?->name,
            'status' => $this->status,
            'annual_leave' => $this->annual_leave,
            'created_at' => $this->created_at?->toDateString(),
            'last_login_at' => $this->last_login_at?->format('Y-m-d H:i'),
        ];
    }
}
