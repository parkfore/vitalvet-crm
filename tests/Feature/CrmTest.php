<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Hospital;
use App\Models\Role;
use App\Models\Stage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * 업무 규칙 검사: 권한(남의 병원 수정 차단), 리드 평가 시점, 자동 단계 전환, 변경 이력
 */
class CrmTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.maps.kakao.rest_key' => null]); // 테스트 중 외부 주소 검색 호출 안 함
    }

    private function user(string $roleKey, string $status = 'active'): User
    {
        static $n = 0;
        $n++;

        return User::create([
            'name' => "{$roleKey}{$n}", 'email' => "{$roleKey}{$n}@test.local", 'password' => 'secret1234',
            'role_id' => Role::where('key', $roleKey)->value('id'), 'status' => $status,
        ]);
    }

    private function hospital(User $by, array $extra = []): Hospital
    {
        $id = $this->actingAs($by)->postJson('/api/hospitals', ['name' => '테스트병원', 'address' => '서울 강남구 테헤란로 1'] + $extra)
            ->assertCreated()->json('id');

        return Hospital::findOrFail($id);
    }

    private function visit(User $by, Hospital $h, string $type = '방문')
    {
        return $this->actingAs($by)->postJson("/api/hospitals/{$h->id}/activities", ['type' => $type, 'date' => now()->toDateString()]);
    }

    // ---------- 로그인 ----------

    public function test_login_and_pending_user_blocked(): void
    {
        $u = $this->user('sales');
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'wrong'])->assertStatus(422);
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'secret1234'])
            ->assertOk()->assertJsonPath('user.id', $u->id)->assertJsonPath('scope', 'own');

        $p = $this->user('sales', 'pending');
        $this->postJson('/api/auth/login', ['email' => $p->email, 'password' => 'secret1234'])
            ->assertStatus(403)->assertJsonPath('code', 'ACCOUNT_NOT_ACTIVE');
    }

    public function test_api_requires_login_with_korean_message(): void
    {
        $this->getJson('/api/hospitals')->assertStatus(401)->assertJsonPath('message', '로그인이 필요합니다');
    }

    public function test_signup_creates_pending_user(): void
    {
        $this->postJson('/api/auth/signup', ['name' => '신입', 'email' => 'new@test.local', 'password' => 'secret1234'])->assertCreated();
        $this->assertSame('pending', User::where('email', 'new@test.local')->value('status'));
    }

    // ---------- 권한: 남의 병원 수정 차단 ----------

    public function test_sales_can_edit_only_own_hospital(): void
    {
        $a = $this->user('sales');
        $b = $this->user('sales');
        $mine = $this->hospital($a);
        $theirs = $this->hospital($b);

        // 읽기는 전체
        $this->actingAs($a)->getJson("/api/hospitals/{$theirs->id}")->assertOk()->assertJsonPath('can.hospital.update', false);
        $this->actingAs($a)->getJson("/api/hospitals/{$mine->id}")->assertOk()->assertJsonPath('can.hospital.update', true);

        // 남의 병원: 기본 정보·단계·활동·다음 액션·전환 모두 403
        $this->actingAs($a)->putJson("/api/hospitals/{$theirs->id}", ['name' => 'X', 'address' => 'Y'])->assertForbidden()->assertJsonPath('message', '담당 병원만 수정할 수 있습니다');
        $this->actingAs($a)->putJson("/api/hospitals/{$theirs->id}/stage", ['stage_id' => Stage::where('name', 'Lost')->value('id')])->assertForbidden();
        $this->visit($a, $theirs)->assertForbidden();
        $this->actingAs($a)->putJson("/api/hospitals/{$theirs->id}/next", ['next_date' => now()->toDateString(), 'next_todo' => 'x'])->assertForbidden();
        $this->actingAs($a)->putJson("/api/hospitals/{$theirs->id}/conversion", ['usage_count' => 3])->assertForbidden();

        // 내 병원은 가능
        $this->actingAs($a)->putJson("/api/hospitals/{$mine->id}", ['name' => '내 병원', 'address' => '서울'])->assertOk();
        $this->visit($a, $mine)->assertCreated();

        // 영업사원은 삭제 권한 없음
        $this->actingAs($a)->deleteJson("/api/hospitals/{$mine->id}")->assertForbidden();
    }

    public function test_sales_cannot_reassign_owner(): void
    {
        $a = $this->user('sales');
        $b = $this->user('sales');
        $h = $this->hospital($a, ['owner_id' => $b->id]);
        $this->assertSame($a->id, $h->owner_id, '담당만 역할은 등록 시 자기 자신이 담당');
        $this->actingAs($a)->putJson("/api/hospitals/{$h->id}", ['name' => 'x', 'address' => 'y', 'owner_id' => $b->id])->assertOk();
        $this->assertSame($a->id, $h->fresh()->owner_id);
    }

    public function test_lead_can_edit_any_hospital_and_delete_restore(): void
    {
        $sales = $this->user('sales');
        $lead = $this->user('lead');
        $h = $this->hospital($sales);
        $this->actingAs($lead)->putJson("/api/hospitals/{$h->id}", ['name' => '팀장 수정', 'address' => '서울'])->assertOk();
        $this->actingAs($lead)->deleteJson("/api/hospitals/{$h->id}")->assertOk();
        $this->actingAs($lead)->getJson('/api/hospitals')->assertJsonMissing(['id' => $h->id]);
        $this->actingAs($lead)->postJson("/api/hospitals/{$h->id}/restore")->assertOk();
        $this->assertNull($h->fresh()->deleted_at);
    }

    public function test_viewer_is_read_only_and_conversion_hidden(): void
    {
        $sales = $this->user('sales');
        $viewer = $this->user('viewer');
        $h = $this->hospital($sales);
        $this->actingAs($viewer)->getJson("/api/hospitals/{$h->id}")->assertOk()->assertJsonMissingPath('usage_count');
        $this->actingAs($viewer)->postJson('/api/hospitals', ['name' => 'x', 'address' => 'y'])->assertForbidden();
        $this->actingAs($viewer)->getJson('/api/users')->assertForbidden();
    }

    public function test_admin_role_locked_and_last_admin_protected(): void
    {
        $admin = $this->user('admin');
        $adminRole = Role::where('key', 'admin')->first();
        $this->actingAs($admin)->putJson("/api/roles/{$adminRole->id}", ['name' => '관리자', 'scope' => 'all', 'permissions' => []])->assertForbidden();
        $this->actingAs($admin)->putJson("/api/users/{$admin->id}", ['name' => 'a', 'email' => $admin->email, 'status' => 'inactive', 'role_id' => $adminRole->id])->assertStatus(422);
    }

    public function test_role_permission_dependency_rules(): void
    {
        $admin = $this->user('admin');
        $id = $this->actingAs($admin)->postJson('/api/roles', [
            'name' => '테스트 역할', 'scope' => 'own',
            'permissions' => [
                'hospital' => ['update' => true],
                'conv' => ['read' => true],
                'eval' => ['view' => true],
                'map' => ['view' => false, 'read' => false],
            ],
        ])->assertCreated()->json('id');
        $p = Role::find($id)->effective();
        $this->assertTrue($p['hospital']['view'] && $p['hospital']['read'], '수정을 켜면 표시·읽기도 켜짐');
        $this->assertTrue($p['conv']['view'], '읽기를 켜면 표시도 켜짐');
        $this->assertTrue($p['eval']['view'] && ! $p['eval']['read'] && ! $p['eval']['create'], '표시만 켜면 표시만');
        $this->assertFalse(in_array(true, $p['map'], true), '표시가 꺼지면 전부 꺼짐');
        $this->assertFalse($p['settings']['create'], '기능에 없는 동작은 항상 꺼짐');
    }

    // ---------- 리드 평가 시점 ----------

    public function test_eval_blocked_before_first_visit(): void
    {
        $u = $this->user('sales');
        $h = $this->hospital($u);
        $this->actingAs($u)->putJson("/api/hospitals/{$h->id}/eval", ['adoption' => 3, 'favor' => 3, 'surgeries' => 3])
            ->assertStatus(422)->assertJsonPath('message', '리드 평가는 1차 방문 이후에 할 수 있습니다');

        $this->visit($u, $h, '전화')->assertCreated(); // 전화는 접촉/리드까지만
        $this->actingAs($u)->putJson("/api/hospitals/{$h->id}/eval", ['adoption' => 3])->assertStatus(422);

        $this->visit($u, $h)->assertCreated();
        $this->actingAs($u)->putJson("/api/hospitals/{$h->id}/eval", ['adoption' => 3, 'favor' => 2, 'surgeries' => 1])
            ->assertOk()->assertJsonPath('eval_grade', '중')->assertJsonPath('eval_sum', 6);
    }

    public function test_eval_grade_thresholds(): void
    {
        $this->assertSame('상', Hospital::gradeFromSum(9));
        $this->assertSame('상', Hospital::gradeFromSum(7));
        $this->assertSame('중', Hospital::gradeFromSum(6));
        $this->assertSame('중', Hospital::gradeFromSum(5));
        $this->assertSame('하', Hospital::gradeFromSum(4));
        $this->assertSame('하', Hospital::gradeFromSum(3));
        $this->assertSame('미평가', Hospital::gradeFromSum(null));
    }

    public function test_eval_shot_upload_is_private_and_limited(): void
    {
        Storage::fake('local');
        $u = $this->user('sales');
        $h = $this->hospital($u);
        $this->visit($u, $h)->assertCreated();
        for ($i = 0; $i < 4; $i++) {
            $this->actingAs($u)->post("/api/hospitals/{$h->id}/shots", ['file' => UploadedFile::fake()->image("s{$i}.png")], ['Accept' => 'application/json'])->assertOk();
        }
        $this->actingAs($u)->post("/api/hospitals/{$h->id}/shots", ['file' => UploadedFile::fake()->image('s5.png')], ['Accept' => 'application/json'])->assertStatus(422);
        $shot = $h->shots()->first();
        $this->actingAs($u)->get("/api/shots/{$shot->id}")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/shots/{$shot->id}")->assertStatus(401);
    }

    // ---------- 자동 단계 전환 ----------

    public function test_stage_auto_advances_forward_only(): void
    {
        $u = $this->user('sales');
        $h = $this->hospital($u);
        $name = fn () => $h->fresh()->stage->name;
        $this->assertSame('미접촉(예정)', $name());

        $this->visit($u, $h, '전화')->assertJsonPath('stage_moved', '접촉/리드');
        $this->visit($u, $h)->assertJsonPath('stage_moved', '1차 방문');
        $this->visit($u, $h)->assertJsonPath('stage_moved', '2차 방문');
        $this->actingAs($u)->putJson("/api/hospitals/{$h->id}/conversion", ['signup_date' => now()->toDateString()])->assertJsonPath('stage_moved', '회원가입');
        $this->actingAs($u)->putJson("/api/hospitals/{$h->id}/conversion", ['signup_date' => now()->toDateString(), 'usage_count' => 5])->assertJsonPath('stage_moved', 'VitalVet 사용');

        // 뒤로 가지 않음
        $this->visit($u, $h)->assertJsonPath('stage_moved', null);
        $this->assertSame('VitalVet 사용', $name());
        $this->assertSame(5, $h->stageHistory()->where('auto', true)->count());
    }

    public function test_exit_stage_is_not_auto_moved(): void
    {
        $u = $this->user('sales');
        $h = $this->hospital($u);
        $this->actingAs($u)->putJson("/api/hospitals/{$h->id}/stage", ['stage_id' => Stage::where('name', '보류')->value('id')])->assertOk();
        $this->visit($u, $h)->assertJsonPath('stage_moved', null);
        $this->assertSame('보류', $h->fresh()->stage->name);
    }

    // ---------- 변경 이력 ----------

    public function test_changes_are_audited_with_before_after(): void
    {
        $u = $this->user('sales');
        $h = $this->hospital($u, ['phone' => '0212345678']);
        $this->actingAs($u)->putJson("/api/hospitals/{$h->id}", ['name' => '새 이름', 'address' => '서울 강남구 테헤란로 1', 'phone' => '0212345678'])->assertOk();

        $log = AuditLog::where('hospital_id', $h->id)->where('action', 'update')->latest('id')->first();
        $this->assertSame('기본 정보', $log->section);
        $this->assertContains(['field' => '병원명', 'before' => '테스트병원', 'after' => '새 이름'], $log->getAttribute('changes'));
        $this->assertSame('02-1234-5678', $h->fresh()->phone);

        $this->actingAs($u)->getJson("/api/hospitals/{$h->id}/timeline")->assertOk()->assertJsonPath('0.changes.0.after', '새 이름');
    }

    public function test_deleting_user_unassigns_hospitals(): void
    {
        $admin = $this->user('admin');
        $s = $this->user('sales');
        $h = $this->hospital($s);
        $this->actingAs($admin)->deleteJson("/api/users/{$s->id}")->assertOk()->assertJsonPath('unassigned', 1);
        $this->assertNull($h->fresh()->owner_id);
    }
}
