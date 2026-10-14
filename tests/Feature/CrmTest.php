<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Store;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CrmTest extends TestCase
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

    private function hospital(string $id, string $owner, array $extra = []): array
    {
        $h = $extra + ['id' => $id, 'name' => "병원 $id", 'zip' => '06236', 'address' => '서울 강남구 테헤란로 1', 'jibun' => '', 'addressDetail' => '', 'sido' => '서울', 'sigungu' => '강남구',
            'lat' => null, 'lng' => null, 'grade' => '1차', 'specialty' => '내과', 'phone' => '', 'director' => '', 'directorPhone' => '', 'vetCount' => '',
            'ownerId' => $owner, 'categoryIds' => [], 'compId' => '', 'compUntil' => '', 'pre' => 'call', 'sources' => [], 'stage' => '접촉/리드', 'stageHistory' => [],
            'eval' => [], 'activities' => [], 'next' => [], 'signupDate' => '', 'usageCount' => 0, 'lastUsedDate' => '', 'memo' => '', 'createdAt' => '2026-10-01', 'createdBy' => $owner];
        Store::put('hospitals', $h);

        return $h;
    }

    private function sync(User $u, array $body)
    {
        return $this->actingAs($u)->postJson('/api/sync', $body);
    }

    public function test_login_with_username_and_password(): void
    {
        $this->user('u_a', 'r_admin', 'admin');
        $this->postJson('/api/auth/login', ['username' => 'ADMIN ', 'password' => 'password123'])->assertOk()->assertJsonPath('user.username', 'admin');
        $this->getJson('/api/me')->assertJsonPath('user.id', 'u_a');
    }

    public function test_wrong_password_and_pending_user_cannot_log_in(): void
    {
        $this->user('u_a', 'r_admin', 'admin');
        $this->postJson('/api/auth/login', ['username' => 'admin', 'password' => 'nope'])->assertStatus(422);
        $this->user('u_p', 'r_sales', 'newbie', 'pending');
        $this->postJson('/api/auth/login', ['username' => 'newbie', 'password' => 'password123'])->assertStatus(403);
    }

    public function test_signup_creates_pending_user_and_audit(): void
    {
        $this->postJson('/api/auth/signup', ['name' => '신규', 'username' => 'Sinkyu', 'password' => 'password123', 'team' => '영업2팀'])->assertCreated();
        $u = User::where('username', 'sinkyu')->first();
        $this->assertSame('pending', $u->status);
        $this->assertNull($u->role_id);
        $this->assertSame(1, DB::table('audit_logs')->where('entity_id', $u->id)->count());
        $this->postJson('/api/auth/signup', ['name' => '중복', 'username' => 'sinkyu', 'password' => 'password123'])->assertStatus(422);
    }

    public function test_state_masks_sections_without_read_permission(): void
    {
        $viewer = $this->user('u_v', 'r_viewer', 'viewer');
        $this->hospital('VV-0001', 'u_x', ['signupDate' => '2026-10-02', 'usageCount' => 5, 'memo' => '비밀', 'eval' => ['adoption' => 5, 'favor' => 4, 'surgeries' => 3]]);
        $res = $this->actingAs($viewer)->getJson('/api/state')->assertOk();
        $h = $res->json('hospitals.0');
        $this->assertSame('', $h['signupDate']);
        $this->assertSame(0, $h['usageCount']);
        $this->assertSame(5, $h['eval']['adoption']); // 조회 전용은 리드 평가 읽기 가능
        $this->assertSame([], $res->json('reports'));
    }

    public function test_sales_can_update_own_hospital_but_not_others(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $mine = $this->hospital('VV-0001', 'u_s');
        $other = $this->hospital('VV-0002', 'u_x');
        $this->sync($s, ['changes' => [['c' => 'hospitals', 'id' => 'VV-0001', 'b' => $mine, 'a' => ['director' => '홍길동'] + $mine]]])->assertOk();
        $this->assertSame('홍길동', Store::find('hospitals', 'VV-0001')['director']);
        $this->sync($s, ['changes' => [['c' => 'hospitals', 'id' => 'VV-0002', 'b' => $other, 'a' => ['director' => '홍길동'] + $other]]])->assertStatus(403);
        $this->assertSame('', Store::find('hospitals', 'VV-0002')['director']);
    }

    public function test_sales_cannot_delete_hospital(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $mine = $this->hospital('VV-0001', 'u_s');
        $this->sync($s, ['changes' => [['c' => 'hospitals', 'id' => 'VV-0001', 'b' => $mine, 'a' => ['deletedAt' => '2026-10-10', 'deletedBy' => 'u_s'] + $mine]]])->assertStatus(403);
    }

    public function test_activity_merge_keeps_concurrent_changes_and_stamps_author(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $h = $this->hospital('VV-0001', 'u_s');
        // 다른 사람이 먼저 기록 하나 추가
        $server = $h;
        $server['activities'][] = ['id' => 'a1', 'type' => '전화', 'date' => '2026-10-05', 'note' => '먼저', 'authorId' => 'u_k'];
        Store::put('hospitals', $server);
        // 영업사원은 옛 화면 기준으로 방문 기록 추가 + 작성자 위조 시도
        $after = $h;
        $after['activities'][] = ['id' => 'a2', 'type' => '방문', 'date' => '2026-10-06', 'note' => '방문', 'authorId' => 'u_k'];
        $after['stage'] = '1차 방문';
        $after['stageHistory'][] = ['date' => '2026-10-06', 'from' => '접촉/리드', 'to' => '1차 방문'];
        $this->sync($s, ['changes' => [['c' => 'hospitals', 'id' => 'VV-0001', 'b' => $h, 'a' => $after]],
            'audit' => [['id' => 'au1', 'entity' => 'hospital', 'entityId' => 'VV-0001', 'hospitalId' => 'VV-0001', 'targetName' => 'x', 'action' => 'create', 'section' => '영업 활동', 'changes' => [], 'userId' => 'u_k', 'userName' => '가짜']]])->assertOk();
        $cur = Store::find('hospitals', 'VV-0001');
        $this->assertSame(['a1', 'a2'], array_column($cur['activities'], 'id'));
        $this->assertSame('u_s', $cur['activities'][1]['authorId']);
        $this->assertSame('1차 방문', $cur['stage']);
        $log = json_decode(DB::table('audit_logs')->where('id', 'au1')->value('data'), true);
        $this->assertSame('u_s', $log['userId']);
        $this->assertSame('SALES', $log['userName']);
    }

    public function test_eval_shot_is_stored_separately_and_served(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $h = $this->hospital('VV-0001', 'u_s', ['stage' => '1차 방문']);
        $png = 'data:image/png;base64,'.base64_encode(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='));
        $after = ['eval' => ['adoption' => 5, 'favor' => 4, 'surgeries' => 2, 'surgeryCount' => '', 'scale' => 5, 'date' => '2026-10-10', 'shots' => [['id' => 'shot1', 'name' => 'a.png', 'data' => $png, 'at' => '2026-10-10']]]] + $h;
        $this->sync($s, ['changes' => [['c' => 'hospitals', 'id' => 'VV-0001', 'b' => $h, 'a' => $after]]])->assertOk();
        $cur = Store::find('hospitals', 'VV-0001');
        $this->assertSame([['id' => 'shot1', 'name' => 'a.png', 'at' => '2026-10-10']], $cur['eval']['shots']);
        $this->actingAs($s)->get('/api/shots/shot1')->assertOk()->assertHeader('Content-Type', 'image/png');
        $state = $this->actingAs($s)->getJson('/api/state')->json('hospitals.0.eval.shots.0.data');
        $this->assertSame('/api/shots/shot1', $state);
    }

    public function test_category_delete_cascades_to_hospitals(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        Store::put('categories', ['id' => 'c1', 'name' => '권역', 'desc' => '', 'color' => '#000'], 0);
        $this->hospital('VV-0001', 'u_x', ['categoryIds' => ['c1']]);
        $this->sync($a, ['changes' => [['c' => 'categories', 'id' => 'c1', 'b' => ['id' => 'c1', 'name' => '권역', 'desc' => '', 'color' => '#000'], 'a' => null]]])->assertOk();
        $this->assertSame([], Store::find('hospitals', 'VV-0001')['categoryIds']);
    }

    public function test_stage_rename_cascades(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $this->hospital('VV-0001', 'u_x', ['stage' => '접촉/리드', 'stageHistory' => [['date' => '2026-10-01', 'from' => '미접촉(예정)', 'to' => '접촉/리드']]]);
        $st = Store::find('stages', 'st1');
        $this->sync($a, ['changes' => [['c' => 'stages', 'id' => 'st1', 'b' => $st, 'a' => ['name' => '리드'] + $st]]])->assertOk();
        $h = Store::find('hospitals', 'VV-0001');
        $this->assertSame('리드', $h['stage']);
        $this->assertSame('리드', $h['stageHistory'][0]['to']);
    }

    public function test_report_author_submits_and_reviewer_confirms(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $lead = $this->user('u_k', 'r_lead', 'lead');
        $r = ['id' => 'rp1', 'authorId' => 'u_s', 'date' => now()->toDateString(), 'status' => 'submitted', 'highlights' => '요약', 'voc' => [], 'comp' => [], 'issues' => [], 'exp' => [], 'plan' => ['hospitalIds' => [], 'goal' => 4, 'note' => '']];
        $this->sync($s, ['changes' => [['c' => 'reports', 'id' => 'rp1', 'b' => null, 'a' => $r]]])->assertOk();
        // 작성자는 스스로 확인 처리할 수 없음
        $this->sync($s, ['changes' => [['c' => 'reports', 'id' => 'rp1', 'b' => $r, 'a' => ['status' => 'confirmed'] + $r]]])->assertStatus(403);
        // 팀장은 내용은 못 바꾸고 검토만
        $this->sync($lead, ['changes' => [['c' => 'reports', 'id' => 'rp1', 'b' => $r, 'a' => ['highlights' => '변조'] + $r]]])->assertStatus(403);
        $this->sync($lead, ['changes' => [['c' => 'reports', 'id' => 'rp1', 'b' => $r, 'a' => ['status' => 'confirmed', 'reviewedAt' => now()->toIso8601String(), 'reviewComment' => ''] + $r]]])->assertOk();
        $this->assertSame('confirmed', Store::find('reports', 'rp1')['status']);
        $this->assertSame('u_k', Store::find('reports', 'rp1')['reviewerId']);
        // 다른 영업사원은 보고서가 안 보임
        $other = $this->user('u_o', 'r_sales', 'other');
        $this->assertSame([], $this->actingAs($other)->getJson('/api/state')->json('reports'));
    }

    public function test_attendance_request_and_approval(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $lead = $this->user('u_k', 'r_lead', 'lead');
        $a = ['id' => 'at1', 'userId' => 'u_s', 'type' => '연차', 'from' => '2026-11-02', 'to' => '2026-11-02', 'reason' => '', 'status' => 'approved', 'requestedBy' => 'u_s'];
        $this->sync($s, ['changes' => [['c' => 'attendance', 'id' => 'at1', 'b' => null, 'a' => $a]]])->assertStatus(403); // 스스로 승인 불가
        $a['status'] = 'requested';
        $this->sync($s, ['changes' => [['c' => 'attendance', 'id' => 'at1', 'b' => null, 'a' => $a]]])->assertOk();
        $this->sync($lead, ['changes' => [['c' => 'attendance', 'id' => 'at1', 'b' => $a, 'a' => ['status' => 'approved'] + $a]]])->assertOk();
        $this->assertSame('approved', Store::find('attendance', 'at1')['status']);
        $this->assertSame('u_k', Store::find('attendance', 'at1')['approverId']);
    }

    public function test_last_admin_is_protected_and_self_role_locked(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $me = $a->present();
        $this->sync($a, ['changes' => [['c' => 'users', 'id' => 'u_a', 'b' => $me, 'a' => ['roleId' => 'r_sales'] + $me]]])->assertStatus(403);
        $this->sync($a, ['changes' => [['c' => 'users', 'id' => 'u_a', 'b' => $me, 'a' => null]]])->assertStatus(403);
    }

    public function test_admin_creates_user_then_sets_password(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $n = ['id' => 'u_new', 'username' => 'newsales', 'name' => '새 사원', 'team' => '', 'phone' => '', 'roleId' => 'r_sales', 'status' => 'active', 'slot' => 2, 'annualLeave' => 15, 'joinedAt' => '2026-10-15'];
        $this->sync($a, ['changes' => [['c' => 'users', 'id' => 'u_new', 'b' => null, 'a' => $n]]])->assertOk();
        $this->actingAs($a)->postJson('/api/users/u_new/password', ['password' => 'newpass123'])->assertOk();
        auth()->logout();
        $this->postJson('/api/auth/login', ['username' => 'newsales', 'password' => 'newpass123'])->assertOk();
    }

    public function test_sales_cannot_change_roles_or_settings(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $role = Store::find('roles', 'r_sales');
        $this->sync($s, ['changes' => [['c' => 'roles', 'id' => 'r_sales', 'b' => $role, 'a' => ['scope' => 'all'] + $role]]])->assertStatus(403);
        $this->sync($s, ['app' => ['settings' => ['b' => ['kakaoKey' => '', 'visitGoal' => 4], 'a' => ['kakaoKey' => 'x', 'visitGoal' => 4]]]])->assertStatus(403);
    }

    public function test_demo_seeder_runs(): void
    {
        $this->seed(\Database\Seeders\DemoSeeder::class);
        $this->assertSame(60, DB::table('hospitals')->count());
        $this->postJson('/api/auth/login', ['username' => 'sumin', 'password' => 'demo1234!'])->assertOk();
        $st = $this->getJson('/api/state')->assertOk();
        $this->assertSame(60, count($st->json('hospitals')));
        $evals = collect($st->json('hospitals'))->pluck('eval.adoption')->filter(fn ($v) => $v !== null && $v !== '');
        $this->assertTrue($evals->every(fn ($v) => $v >= 0 && $v <= 5));
    }
}
