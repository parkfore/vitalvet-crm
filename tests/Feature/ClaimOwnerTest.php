<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Store;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** 담당 미지정 병원은 영업사원도 담당자를 지정할 수 있고, 담당자가 있으면 바꿀 수 없다 */
class ClaimOwnerTest extends TestCase
{
    use RefreshDatabase;

    private function hosp(string $id, string $owner): array
    {
        $h = ['id' => $id, 'name' => "병원 $id", 'zip' => '', 'address' => '서울 강남구 테헤란로 1', 'jibun' => '', 'addressDetail' => '', 'sido' => '서울', 'sigungu' => '강남구',
            'lat' => 37.5, 'lng' => 127.03, 'grade' => '', 'specialty' => '', 'phone' => '', 'director' => '', 'directorPhone' => '', 'vetCount' => '',
            'ownerId' => $owner, 'categoryIds' => [], 'compId' => '', 'compUntil' => '', 'sources' => [], 'stage' => '접촉/리드', 'stageHistory' => [],
            'eval' => [], 'activities' => [], 'next' => [], 'signupDate' => '', 'usageCount' => 0, 'lastUsedDate' => '', 'memo' => '', 'createdAt' => '2026-10-01', 'createdBy' => 'u_a'];
        Store::put('hospitals', $h);

        return $h;
    }

    public function test_sales_can_assign_unassigned_only(): void
    {
        $this->seed(DatabaseSeeder::class);
        $mk = fn ($id, $role, $un) => User::create(['id' => $id, 'username' => $un, 'password' => 'password123', 'status' => 'active', 'role_id' => $role, 'data' => ['name' => strtoupper($un), 'team' => '영업1팀', 'slot' => 1]]);
        $mk('u_a', 'r_admin', 'admin');
        $s = $mk('u_s', 'r_sales', 'sales');
        $mk('u_t', 'r_sales', 'other');
        $free = $this->hosp('VV-0001', '');
        $taken = $this->hosp('VV-0002', 'u_t');
        $sync = fn ($id, $b, $a) => $this->actingAs($s)->postJson('/api/sync', ['changes' => [['c' => 'hospitals', 'id' => $id, 'b' => $b, 'a' => $a]]]);
        // 미지정 → 다른 정보까지 바꾸려 하면 거부, 담당만 지정은 허용
        $sync('VV-0001', $free, ['ownerId' => 'u_s', 'memo' => 'x'] + $free)->assertStatus(403);
        $sync('VV-0001', $free, ['ownerId' => 'u_s'] + $free)->assertOk();
        $this->assertSame('u_s', Store::find('hospitals', 'VV-0001')['ownerId']);
        // 담당자가 있는 병원은 바꿀 수 없음
        $sync('VV-0002', $taken, ['ownerId' => 'u_s'] + $taken)->assertStatus(403);
        // 없는 사용자로는 지정 불가
        $f2 = $this->hosp('VV-0003', '');
        $sync('VV-0003', $f2, ['ownerId' => 'nobody'] + $f2)->assertStatus(422);
    }
}
