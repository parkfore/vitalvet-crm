<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Str;

/**
 * 로그인 사용자. 화면에서 쓰는 정보(이름·소속·연락처·연차·색상 순번·가입일)는 data(JSON)에 있다.
 *
 * @property string $id
 * @property string $username
 * @property string $status active|inactive|pending
 * @property ?string $role_id
 * @property array $data
 */
class User extends Authenticatable
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'username', 'password', 'status', 'role_id', 'data'];

    protected $hidden = ['password', 'remember_token'];

    /** 아이디 규칙: 영문 소문자로 시작, 영문 소문자·숫자·. _ - 4~30자 */
    public const USERNAME_REGEX = '/^[a-z][a-z0-9._-]{3,29}$/';

    protected function casts(): array
    {
        return ['password' => 'hashed', 'data' => 'array', 'last_login_at' => 'datetime'];
    }

    public static function newId(): string
    {
        return 'u_'.Str::lower(Str::random(7));
    }

    public function setUsernameAttribute($v): void
    {
        $this->attributes['username'] = strtolower(trim((string) $v));
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function name(): string
    {
        return (string) ($this->data['name'] ?? $this->username);
    }

    /** 화면용 사용자 객체 (프로토타입 S.users 와 같은 모양) */
    public function present(): array
    {
        return ['id' => $this->id, 'username' => $this->username, 'status' => $this->status, 'roleId' => (string) $this->role_id] + ($this->data ?? []);
    }
}
