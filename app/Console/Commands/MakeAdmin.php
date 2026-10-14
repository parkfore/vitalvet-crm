<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;

/** 첫 관리자 계정 만들기: php artisan crm:admin */
class MakeAdmin extends Command
{
    protected $signature = 'crm:admin {--email=} {--name=} {--password=}';

    protected $description = '관리자 계정을 만들거나, 이미 있는 계정을 관리자로 바꿉니다';

    public function handle(): int
    {
        $email = $this->option('email') ?: $this->ask('관리자 이메일 (로그인 ID)');
        $name = $this->option('name') ?: $this->ask('이름');
        $password = $this->option('password') ?: $this->secret('비밀번호 (8자 이상, 입력해도 화면에 보이지 않습니다)');
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('이메일 형식이 올바르지 않습니다.');

            return self::FAILURE;
        }
        if (strlen((string) $password) < 8) {
            $this->error('비밀번호는 8자 이상이어야 합니다.');

            return self::FAILURE;
        }
        $role = Role::where('key', 'admin')->first();
        if (! $role) {
            $this->error('기본 역할이 없습니다. 먼저 php artisan db:seed 를 실행하세요.');

            return self::FAILURE;
        }
        $u = User::updateOrCreate(['email' => $email], ['name' => $name, 'password' => $password, 'role_id' => $role->id, 'status' => 'active']);
        $this->info("관리자 계정 준비 완료: {$u->name} <{$u->email}>");

        return self::SUCCESS;
    }
}
