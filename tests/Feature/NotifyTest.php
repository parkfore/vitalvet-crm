<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Notify;
use App\Support\Store;
use App\Support\WebPush;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NotifyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        // 평일 오전 10시 (한국) - 조용한 시간이 아님
        Carbon::setTestNow(Carbon::parse('2026-10-20 10:00', 'Asia/Seoul')->utc());
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $id, string $role, string $username): User
    {
        return User::create(['id' => $id, 'username' => $username, 'password' => 'password123', 'status' => 'active', 'role_id' => $role,
            'data' => ['name' => strtoupper($username), 'team' => '영업1팀', 'slot' => 1]]);
    }

    private function device(string $uid): void
    {
        $ep = 'https://fcm.googleapis.com/fcm/send/'.$uid;
        $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $d = openssl_pkey_get_details($k)['ec'];
        DB::table('push_subscriptions')->insert(['user_id' => $uid, 'endpoint_hash' => hash('sha256', $ep), 'endpoint' => $ep,
            'p256dh' => WebPush::b64u("\x04".str_pad($d['x'], 32, "\0", STR_PAD_LEFT).str_pad($d['y'], 32, "\0", STR_PAD_LEFT)), 'auth' => WebPush::b64u(random_bytes(16)), 'created_at' => now()]);
    }

    private function report(string $author, array $extra = []): array
    {
        return $extra + ['id' => 'rp_'.$author, 'authorId' => $author, 'date' => '2026-10-20', 'status' => 'submitted', 'workType' => '외근', 'region' => '', 'mileage' => '',
            'highlights' => '오늘 요약', 'voc' => [], 'comp' => [], 'issues' => [], 'plan' => ['hospitalIds' => [], 'goal' => '', 'note' => ''], 'exp' => [], 'memo' => ''];
    }

    public function test_report_submit_notifies_managers_even_if_author_turned_off_own_alerts(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $s = $this->user('u_s', 'r_sales', 'sales');
        $this->actingAs($s)->postJson('/api/notif/me', ['prefs' => ['off' => true]])->assertOk();
        $rep = $this->report('u_s', ['issues' => [['type' => '시연 지원', 'urgency' => '긴급', 'text' => '장비 필요']]]);
        $this->actingAs($s)->postJson('/api/sync', ['changes' => [['c' => 'reports', 'id' => $rep['id'], 'b' => null, 'a' => $rep]]])->assertOk();
        $q = DB::table('notif_queue')->get();
        $this->assertTrue($q->contains(fn ($r) => $r->user_id === 'u_a' && $r->type === 'report_submitted'));
        $this->assertTrue($q->contains(fn ($r) => $r->user_id === 'u_a' && $r->type === 'support_request' && str_contains($r->title, '긴급')));
        $this->assertFalse($q->contains(fn ($r) => $r->user_id === 'u_s'));
    }

    public function test_locked_alert_cannot_be_turned_off_and_admin_sees_overrides(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $s = $this->user('u_s', 'r_sales', 'sales');
        $this->actingAs($s)->postJson('/api/admin/notif', ['locked' => ['r_sales' => ['report_returned']]])->assertStatus(403);
        $this->actingAs($a)->postJson('/api/admin/notif', ['roles' => ['r_sales' => ['morning' => '08:30', 'types' => ['coaching' => true]]], 'locked' => ['r_sales' => ['report_returned']]])->assertOk();
        $this->actingAs($s)->postJson('/api/notif/me', ['prefs' => ['off' => true, 'types' => ['report_returned' => false, 'coaching' => false], 'evening' => '19:00']])->assertOk()
            ->assertJsonPath('notif.effective.types.report_returned', true)->assertJsonPath('notif.effective.types.coaching', false)
            ->assertJsonPath('notif.effective.morning', '08:30')->assertJsonPath('notif.effective.evening', '19:00');
        $this->assertArrayNotHasKey('report_returned', (array) Notify::mine('u_s')['types']);
        $res = $this->actingAs($a)->getJson('/api/admin/notif')->assertOk();
        $row = collect($res->json('users'))->firstWhere('id', 'u_s');
        $this->assertTrue($row['mine']['off']);
        $this->assertTrue(DB::table('audit_logs')->where('entity_id', 'u_s')->where('data', 'like', '%알림 설정%')->exists());
        // 반려는 고정이라 '모두 끄기'여도 간다
        $rep = $this->report('u_s');
        Store::put('reports', $rep);
        $this->actingAs($a)->postJson('/api/sync', ['changes' => [['c' => 'reports', 'id' => $rep['id'], 'b' => $rep, 'a' => ['status' => 'returned', 'reviewComment' => '보완 필요'] + $rep]]])->assertOk();
        $this->assertTrue(DB::table('notif_queue')->where('user_id', 'u_s')->where('type', 'report_returned')->exists());
    }

    public function test_quiet_hours_defer_and_flush_sends_encrypted_push(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $s = $this->user('u_s', 'r_sales', 'sales');
        $this->device('u_s');
        Carbon::setTestNow(Carbon::parse('2026-10-20 22:30', 'Asia/Seoul')->utc());
        $this->actingAs($a)->postJson('/api/sync', ['changes' => [['c' => 'coaching', 'id' => 'co_1', 'b' => null, 'a' => ['id' => 'co_1', 'userId' => 'u_s', 'text' => '내일 시연 준비', 'ts' => now()->toIso8601ZuluString()]]]])->assertOk();
        $row = DB::table('notif_queue')->where('user_id', 'u_s')->first();
        $this->assertSame('2026-10-21 08:00', Carbon::parse($row->send_after, 'UTC')->setTimezone('Asia/Seoul')->format('Y-m-d H:i'));
        Http::fake(['*' => Http::response('', 201)]);
        $this->assertSame(0, Notify::flush());
        Carbon::setTestNow(Carbon::parse('2026-10-21 08:01', 'Asia/Seoul')->utc());
        $this->assertSame(1, Notify::flush());
        Http::assertSent(fn ($r) => str_starts_with($r->header('Authorization')[0], 'vapid t=') && $r->header('Content-Encoding')[0] === 'aes128gcm' && strlen($r->body()) > 86);
        $this->assertSame('sent', DB::table('notif_queue')->value('result'));
        // 없어진 기기(410)는 지운다
        DB::table('notif_queue')->update(['sent_at' => null, 'claim' => null]);
        Http::fake(['*' => Http::response('', 410)]);
        Notify::flush();
        $this->assertSame(0, DB::table('push_subscriptions')->count());
    }

    public function test_briefs_once_per_day_at_chosen_time(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $this->device('u_s');
        $this->actingAs($s)->postJson('/api/notif/me', ['prefs' => ['evening' => '19:00']])->assertOk();
        $this->assertSame(0, Notify::briefs(Carbon::parse('2026-10-20 18:50', 'Asia/Seoul')->utc()));
        $this->assertSame(1, Notify::briefs(Carbon::parse('2026-10-20 19:01', 'Asia/Seoul')->utc()));
        $this->assertSame(0, Notify::briefs(Carbon::parse('2026-10-20 19:05', 'Asia/Seoul')->utc()));
        $this->assertStringContainsString('보고서', DB::table('notif_queue')->where('type', 'evening')->value('body'));
        // 토요일은 쉬는 날 (기본값: 주말 안 받음)
        $this->assertSame(0, Notify::briefs(Carbon::parse('2026-10-24 19:01', 'Asia/Seoul')->utc()));
    }

    public function test_ping_and_data_version_headers(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $v0 = $this->actingAs($a)->getJson('/api/ping')->assertOk()->json('v');
        $res = $this->actingAs($a)->postJson('/api/goals', ['default' => ['visits' => 10]])->assertOk();
        $this->assertSame($v0, $res->headers->get('X-Data-Prev'));
        $this->assertSame($res->headers->get('X-Data-Ver'), $this->actingAs($a)->getJson('/api/ping')->json('v'));
        $this->assertNotSame($v0, $res->headers->get('X-Data-Ver'));
        $this->actingAs($a)->getJson('/api/state')->assertJsonPath('dataVer', $res->headers->get('X-Data-Ver'))->assertJsonStructure(['notif' => ['types', 'base', 'locked', 'vapid', 'devices']]);
    }

    public function test_push_subscribe_validates(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $this->actingAs($s)->postJson('/api/push/subscribe', ['endpoint' => 'http://evil', 'keys' => ['p256dh' => 'x', 'auth' => 'y']])->assertStatus(422);
        $this->actingAs($s)->postJson('/api/push/subscribe', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123', 'keys' => ['p256dh' => str_repeat('A', 87), 'auth' => str_repeat('B', 22)]])->assertOk()->assertJsonPath('devices', 1);
        $this->actingAs($s)->postJson('/api/push/unsubscribe', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123'])->assertJsonPath('devices', 0);
    }
}
