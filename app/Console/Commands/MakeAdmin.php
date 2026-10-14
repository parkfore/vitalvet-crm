<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * 관리자 계정 만들기 (이미 있는 아이디면 비밀번호를 바꾸고 관리자로 지정)
 *
 *   php artisan crm:admin --username=admin --name=관리자 --password=비밀번호
 *   (옵션을 빼면 하나씩 물어봅니다)
 */
class MakeAdmin extends Command
{
    protected $signature = 'crm:admin {--username=} {--name=} {--password=}';

    protected $description = '관리자 계정을 만들거나, 이미 있는 계정을 관리자로 바꿉니다';

    public function handle(): int
    {
        $username = strtolower(trim((string) ($this->option('username') ?: $this->ask('관리자 아이디 (영문 소문자·숫자 4자 이상)'))));
        if (! preg_match('/^[a-z][a-z0-9._-]{3,29}$/', $username)) {
            $this->error('아이디는 영문 소문자로 시작하고, 영문 소문자·숫자·. _ - 로 4~30자여야 합니다.');

            return self::FAILURE;
        }
        $name = $this->option('name') ?: $this->ask('이름', '관리자');
        $password = (string) ($this->option('password') ?: $this->secret('비밀번호 (8자 이상, 화면에 보이지 않습니다. 한/영 키가 영문인지 확인하세요)'));
        if (strlen($password) < 8) {
            $this->error('비밀번호는 8자 이상이어야 합니다.');

            return self::FAILURE;
        }
        if (! $this->option('password') && $this->secret('비밀번호 확인 (한 번 더)') !== $password) {
            $this->error('비밀번호 확인이 일치하지 않습니다. 다시 실행하세요.');

            return self::FAILURE;
        }
        $role = Role::where('key', 'admin')->first();
        if (! $role) {
            $this->error('기본 역할이 없습니다. 먼저 php artisan db:seed 를 실행하세요.');

            return self::FAILURE;
        }
        $u = User::updateOrCreate(['username' => $username], ['name' => $name, 'password' => $password, 'role_id' => $role->id, 'status' => 'active']);
        $this->info("관리자 계정 준비 완료: {$u->name} (아이디 {$u->username})");

        return self::SUCCESS;
    }
}
