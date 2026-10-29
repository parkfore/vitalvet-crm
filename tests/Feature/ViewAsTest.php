<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** 대표 관리자(admin)의 '다른 사용자로 보기' (보기 전용) */
class ViewAsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    private function user(string $id, string $role, string $username, string $status = 'active'): User
    {
        return User::create(['id' => $id, 'username' => $username, 'password' => 'password123', 'status' => $status, 'role_id' => $role,
            'data' => ['name' => strtoupper($username), 'team' => '영업1팀', 'slot' => 1]]);
    }

    public function test_main_admin_can_view_as_other_user_read_only(): void
    {
        $admin = $this->user('u_admin', 'r_admin', 'admin');
        $this->user('u_sy', 'r_admin', 'shyoon');
        $this->user('u_s', 'r_sales', 'sales');
        $this->user('u_p', 'r_sales', 'pend', 'pending');

        $this->actingAs($admin)->getJson('/api/state')->assertJsonPath('canViewAs', true)->assertJsonPath('viewAs', null);
        // 승인 대기 계정은 볼 수 없음
        $this->actingAs($admin)->postJson('/api/auth/impersonate/u_p')->assertStatus(422);
        // 다른 관리자 화면으로 보기
        $this->actingAs($admin)->postJson('/api/auth/impersonate/u_sy')->assertOk();
        $this->getJson('/api/state')->assertJsonPath('session', 'u_sy')->assertJsonPath('viewAs.by', 'u_admin')->assertJsonPath('canViewAs', false);
        // 보기 전용: 저장·변경 막힘
        $this->postJson('/api/sync', ['changes' => []])->assertStatus(403)->assertJsonPath('code', 'VIEW_ONLY');
        $this->postJson('/api/notif/me', [])->assertStatus(403);
        // 보는 중에 또 다른 사람으로 보기 불가
        $this->postJson('/api/auth/impersonate/u_s')->assertStatus(403);
        // 돌아가기
        $this->postJson('/api/auth/impersonate/stop')->assertOk()->assertJsonPath('user.id', 'u_admin');
        $this->getJson('/api/state')->assertJsonPath('session', 'u_admin')->assertJsonPath('viewAs', null);
        $this->assertSame(2, DB::table('access_logs')->where('event', 'view_as')->count());
    }

    public function test_other_admins_and_users_cannot_view_as(): void
    {
        $this->user('u_admin', 'r_admin', 'admin');
        $sy = $this->user('u_sy', 'r_admin', 'shyoon');
        $s = $this->user('u_s', 'r_sales', 'sales');
        $this->actingAs($sy)->getJson('/api/state')->assertJsonPath('canViewAs', false);
        $this->actingAs($sy)->postJson('/api/auth/impersonate/u_s')->assertStatus(403);
        $this->actingAs($s)->postJson('/api/auth/impersonate/u_admin')->assertStatus(403);
    }
}
