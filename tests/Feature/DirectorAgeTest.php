<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\HospitalImport;
use App\Support\Store;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** 원장님 나이대 저장·검사·가져오기 정리 */
class DirectorAgeTest extends TestCase
{
    use RefreshDatabase;

    public function test_director_age_saved_and_validated(): void
    {
        $this->seed(DatabaseSeeder::class);
        $a = User::create(['id' => 'u_a', 'username' => 'admin', 'password' => 'password123', 'status' => 'active', 'role_id' => 'r_admin', 'data' => ['name' => 'A', 'team' => '운영팀', 'slot' => 1]]);
        $h = ['id' => 'VV-0001', 'name' => '테스트 병원', 'zip' => '', 'address' => '서울 강남구 테헤란로 1', 'jibun' => '', 'addressDetail' => '', 'sido' => '서울', 'sigungu' => '강남구',
            'lat' => 37.5, 'lng' => 127.03, 'grade' => '', 'specialty' => '', 'phone' => '', 'director' => '', 'directorPhone' => '', 'vetCount' => '',
            'ownerId' => '', 'categoryIds' => [], 'compId' => '', 'compUntil' => '', 'sources' => [], 'stage' => '접촉/리드', 'stageHistory' => [],
            'eval' => [], 'activities' => [], 'next' => [], 'signupDate' => '', 'usageCount' => 0, 'lastUsedDate' => '', 'memo' => '', 'createdAt' => '2026-10-01', 'createdBy' => 'u_a'];
        Store::put('hospitals', $h);
        $sync = fn ($b, $x) => $this->actingAs($a)->postJson('/api/sync', ['changes' => [['c' => 'hospitals', 'id' => 'VV-0001', 'b' => $b, 'a' => $x]]]);
        $sync($h, ['directorAge' => '40대'] + $h)->assertOk();
        $this->assertSame('40대', Store::find('hospitals', 'VV-0001')['directorAge']);
        $cur = Store::find('hospitals', 'VV-0001');
        $sync($cur, ['directorAge' => '45살'] + $cur)->assertStatus(422);
    }

    public function test_import_age_normalized(): void
    {
        $m = new \ReflectionMethod(HospitalImport::class, 'age');
        $this->assertSame('40대', $m->invoke(null, '40대 후반'));
        $this->assertSame('50대', $m->invoke(null, '57'));
        $this->assertSame('70대 이상', $m->invoke(null, '80대'));
        $this->assertSame('', $m->invoke(null, '모름'));
    }
}
