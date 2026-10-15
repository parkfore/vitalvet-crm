<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Geo;
use App\Support\Store;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** 병원 정보 가져오기 (파일·공공데이터 API), 좌표 변환, 필수 정보, 내 영업 맵 */
class ImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        config(['services.maps.kakao.rest_key' => null, 'services.maps.naver.client_id' => null, 'services.maps.naver.client_secret' => null]);
    }

    private function user(string $id, string $role, string $username): User
    {
        return User::create(['id' => $id, 'username' => $username, 'password' => 'password123', 'status' => 'active', 'role_id' => $role,
            'data' => ['name' => strtoupper($username), 'team' => '영업1팀', 'slot' => 1]]);
    }

    private function hospital(string $id, array $extra = []): array
    {
        $h = $extra + ['id' => $id, 'name' => "병원 $id", 'zip' => '', 'address' => '서울 강남구 테헤란로 1', 'jibun' => '', 'addressDetail' => '', 'sido' => '서울', 'sigungu' => '강남구',
            'lat' => 37.5, 'lng' => 127.0, 'grade' => '', 'specialty' => '', 'phone' => '', 'director' => '', 'directorPhone' => '', 'vetCount' => '',
            'ownerId' => '', 'categoryIds' => [], 'compId' => '', 'compUntil' => '', 'pre' => 'call', 'sources' => [], 'stage' => '접촉/리드', 'stageHistory' => [],
            'eval' => [], 'activities' => [], 'next' => [], 'signupDate' => '', 'usageCount' => 0, 'lastUsedDate' => '', 'memo' => '', 'createdAt' => '2026-10-01', 'createdBy' => 'u_a'];
        Store::put('hospitals', $h);

        return $h;
    }

    private function row(string $name, string $road, string $status = '영업/정상', array $extra = []): array
    {
        return $extra + ['name' => $name, 'road' => $road, 'status' => $status, 'x' => '205000', 'y' => '445000'];
    }

    public function test_tm_coordinates_convert_to_wgs84(): void
    {
        // pyproj (EPSG:5174 + towgs84) 결과와 비교
        $this->assertSame(['lat' => 37.5698167, 'lng' => 126.9787831], Geo::tmToWgs84(198056, 451948));
        $this->assertSame(['lat' => 35.155613, 'lng' => 129.0639726], Geo::tmToWgs84(388000, 186000));
        $this->assertNull(Geo::tmToWgs84('', ''));
    }

    public function test_preview_detects_localdata_columns(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $headers = ['번호', '관리번호', '영업상태명', '폐업일자', '소재지전화', '소재지전체주소', '도로명전체주소', '사업장명', '좌표정보(x)', '좌표정보(y)'];
        $raw = array_combine($headers, ['1', 'M-1', '폐업', '20200101', '025551234', '서울특별시 강남구 역삼동 1', '서울특별시 강남구 테헤란로 123, 2층 (역삼동)', '새봄동물병원', '205000', '445000']);
        $r = $this->actingAs($a)->postJson('/api/import/preview', ['headers' => $headers, 'rows' => [$raw]])->assertOk();
        $r->assertJsonPath('mapping.name', '사업장명')->assertJsonPath('mapping.road', '도로명전체주소')->assertJsonPath('mapping.status', '영업상태명');
        $r->assertJsonPath('sample.0.address', '서울특별시 강남구 테헤란로 123 (역삼동)')->assertJsonPath('sample.0.addressDetail', '2층')
            ->assertJsonPath('sample.0.bizStatus', '폐업')->assertJsonPath('sample.0.closedAt', '2020-01-01')->assertJsonPath('sample.0.phone', '02-555-1234')
            ->assertJsonPath('sample.0.geo', true);
    }

    public function test_file_import_creates_new_skips_existing_and_updates_closed(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $this->hospital('VV-0001', ['name' => '온누리 동물병원', 'address' => '서울 강남구 테헤란로 349', 'phone' => '02-564-9019']);
        $this->hospital('VV-0002', ['name' => '한빛 동물병원', 'address' => '서울 마포구 양화로 320']);
        $rows = [
            $this->row('온누리동물병원', '서울특별시 강남구 테헤란로 349, 3층 (역삼동)', '폐업', ['closedAt' => '20261001']),   // 이미 있음 → 폐업으로
            $this->row('한빛 동물병원', '서울특별시 마포구 양화로 320 (서교동)'),                                             // 이미 있음 → 그대로
            $this->row('새봄동물병원', '서울특별시 강남구 역삼로 10'),                                                         // 새로 등록
            $this->row('새봄동물병원', '서울특별시 강남구 역삼로 10'),                                                         // 같은 파일 중복
            $this->row('옛날동물병원', '서울특별시 강남구 역삼로 99', '폐업'),                                                 // 등록 안 된 폐업 → 건너뜀
            $this->row('', '서울특별시 강남구 역삼로 1'),                                                                      // 병원명 없음
        ];
        $r = $this->actingAs($a)->postJson('/api/import/rows', ['runId' => 'run_test1', 'fileName' => 'a.csv', 'rows' => $rows])->assertOk();
        $r->assertJsonPath('created', 1)->assertJsonPath('updated', 1)->assertJsonPath('exists', 2)->assertJsonPath('skippedClosed', 1)->assertJsonPath('invalid', 1);

        $h1 = Store::find('hospitals', 'VV-0001');
        $this->assertSame('폐업', $h1['bizStatus']);
        $this->assertSame('2026-10-01', $h1['closedAt']);
        $new = Store::find('hospitals', 'VV-0003');
        $this->assertSame('새봄동물병원', $new['name']);
        $this->assertSame('file', $new['importedFrom']);
        $this->assertSame('', $new['ownerId']);
        $this->assertSame('미접촉(예정)', $new['stage']);
        $this->assertEqualsWithDelta(37.5072, $new['lat'], 0.0001);   // 파일 좌표(TM) 변환
        $this->assertTrue(DB::table('audit_logs')->where('hospital_id', 'VV-0001')->exists());

        $this->actingAs($a)->postJson('/api/import/finish', ['runId' => 'run_test1'])->assertOk()->assertJsonPath('n.created', 1);
        $log = collect(DB::table('audit_logs')->get())->map(fn ($r) => json_decode($r->data, true))->firstWhere('targetName', '병원 정보 가져오기');
        $this->assertStringContainsString('신규 등록 1곳', $log['summary']);

        // 다시 올리면 새로 만들지 않는다
        $this->actingAs($a)->postJson('/api/import/rows', ['runId' => 'run_test2', 'rows' => $rows])->assertOk()->assertJsonPath('created', 0);
    }

    public function test_import_uses_geocoder_when_rest_key_exists(): void
    {
        config(['services.maps.kakao.rest_key' => 'test-rest']);
        Http::fake(['dapi.kakao.com/*' => Http::response(['documents' => [['x' => '127.0276', 'y' => '37.4979',
            'road_address' => ['address_name' => '서울 강남구 강남대로 396', 'zone_no' => '06232', 'region_1depth_name' => '서울', 'region_2depth_name' => '강남구'],
            'address' => ['address_name' => '서울 강남구 역삼동 825']]]])]);
        $a = $this->user('u_a', 'r_admin', 'admin');
        $this->actingAs($a)->postJson('/api/import/rows', ['runId' => 'run_g', 'rows' => [['name' => '강남역동물병원', 'jibun' => '서울특별시 강남구 역삼동 825']]])->assertOk()->assertJsonPath('created', 1);
        $h = Store::find('hospitals', 'VV-0001');
        $this->assertSame(37.4979, $h['lat']);
        $this->assertSame('06232', $h['zip']);
        $this->assertSame('서울 강남구 강남대로 396', $h['address']);    // 지번만 있으면 찾은 도로명 주소로
        $this->assertSame('서울특별시 강남구 역삼동 825', $h['jibun']);
        Http::assertSent(fn ($r) => $r->hasHeader('Authorization', 'KakaoAK test-rest'));
    }

    public function test_sales_role_cannot_import(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $this->actingAs($s)->postJson('/api/import/rows', ['rows' => [$this->row('가', '서울 강남구 역삼로 1')]])->assertStatus(403);
        $this->actingAs($s)->postJson('/api/import/api/config', ['url' => 'https://x.test'])->assertStatus(403);
    }

    public function test_public_api_config_hides_key_and_page_import_reads_xml(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $this->actingAs($a)->postJson('/api/import/api/config', ['url' => 'https://apis.data.go.kr/test/animal', 'key' => 'abc%2Bdef9876', 'params' => 'type=xml'])
            ->assertOk()->assertJsonPath('hasKey', true)->assertJsonPath('keyTail', '9876')->assertJsonMissingPath('key');
        $st = $this->actingAs($a)->getJson('/api/state')->assertOk();
        $this->assertStringNotContainsString('abc%2Bdef', $st->getContent());

        $xml = '<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>'
            .'<item><bplcNm>가동물병원</bplcNm><rdnWhlAddr>서울특별시 중구 세종대로 110</rdnWhlAddr><trdStateNm>영업/정상</trdStateNm><mgtNo>A1</mgtNo><x>198056</x><y>451948</y></item>'
            .'<item><bplcNm>나동물병원</bplcNm><rdnWhlAddr>부산광역시 중구 중앙대로 1</rdnWhlAddr><trdStateNm>폐업</trdStateNm><mgtNo>A2</mgtNo></item>'
            .'</items><numOfRows>100</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>';
        $body = $xml;
        Http::fake(function () use (&$body) {
            return Http::response($body, 200, ['Content-Type' => 'application/xml']);
        });
        $r = $this->actingAs($a)->postJson('/api/import/api/page', ['runId' => 'run_api', 'page' => 1])->assertOk();
        $r->assertJsonPath('total', 2)->assertJsonPath('count', 2)->assertJsonPath('created', 1)->assertJsonPath('skippedClosed', 1);
        $h = Store::find('hospitals', 'VV-0001');
        $this->assertSame('api', $h['importedFrom']);
        $this->assertSame('A1', $h['extId']);
        $this->assertSame(37.5698167, $h['lat']);
        Http::assertSent(fn ($req) => str_contains($req->url(), 'serviceKey=abc%2Bdef9876') && str_contains($req->url(), 'pageNo=1') && str_contains($req->url(), 'type=xml'));

        // 같은 관리번호가 폐업으로 오면 상태만 바뀐다
        $body = str_replace('<trdStateNm>영업/정상</trdStateNm><mgtNo>A1', '<trdStateNm>폐업</trdStateNm><mgtNo>A1', $xml);
        $this->actingAs($a)->postJson('/api/import/api/page', ['runId' => 'run_api2', 'page' => 1])->assertOk()->assertJsonPath('updated', 1)->assertJsonPath('created', 0);
        $this->assertSame('폐업', Store::find('hospitals', 'VV-0001')['bizStatus']);
        $this->actingAs($a)->postJson('/api/import/finish', ['runId' => 'run_api2'])->assertOk();
        $this->actingAs($a)->getJson('/api/state')->assertJsonPath('publicApi.last.by', 'ADMIN');
    }

    public function test_public_api_error_message_is_shown(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $this->actingAs($a)->postJson('/api/import/api/config', ['url' => 'https://apis.data.go.kr/test/animal', 'key' => 'k'])->assertOk();
        Http::fake(['*' => Http::response('<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>')]);
        $r = $this->actingAs($a)->postJson('/api/import/api/test')->assertStatus(502);
        $this->assertStringContainsString('SERVICE_KEY_IS_NOT_REGISTERED_ERROR', $r->json('message'));
    }

    public function test_geocode_fills_missing_coordinates(): void
    {
        config(['services.maps.kakao.rest_key' => 'k']);
        Http::fake(['dapi.kakao.com/*' => Http::response(['documents' => [['x' => '127.1', 'y' => '37.4', 'road_address' => ['zone_no' => '12345', 'region_1depth_name' => '경기', 'region_2depth_name' => '성남시 분당구', 'address_name' => '']]]])]);
        $a = $this->user('u_a', 'r_admin', 'admin');
        $this->hospital('VV-0001', ['lat' => null, 'lng' => null, 'zip' => '']);
        $this->actingAs($a)->postJson('/api/import/geocode')->assertOk()->assertJsonPath('done', 1)->assertJsonPath('remaining', 0);
        $h = Store::find('hospitals', 'VV-0001');
        $this->assertSame(37.4, $h['lat']);
        $this->assertSame('12345', $h['zip']);
    }

    public function test_required_fields_and_biz_status_sync(): void
    {
        $a = $this->user('u_a', 'r_admin', 'admin');
        $this->actingAs($a)->getJson('/api/state')->assertJsonPath('settings.requiredFields', ['name', 'address', 'phone', 'director', 'ownerId']);
        $b = ['visitGoal' => 4, 'mapProvider' => 'kakao', 'requiredFields' => ['name', 'address', 'phone', 'director', 'ownerId']];
        $this->actingAs($a)->postJson('/api/sync', ['app' => ['settings' => ['b' => $b, 'a' => ['requiredFields' => ['phone', 'grade', 'nope']] + $b]]])->assertOk();
        $this->actingAs($a)->getJson('/api/state')->assertJsonPath('settings.requiredFields', ['name', 'address', 'phone', 'grade']);

        $h = $this->hospital('VV-0001');
        $this->actingAs($a)->postJson('/api/sync', ['changes' => [['c' => 'hospitals', 'id' => 'VV-0001', 'b' => $h, 'a' => ['bizStatus' => '폐업', 'closedAt' => '2026-10-02'] + $h]]])->assertOk();
        $this->assertSame('폐업', Store::find('hospitals', 'VV-0001')['bizStatus']);
        $h2 = Store::find('hospitals', 'VV-0001');
        $this->actingAs($a)->postJson('/api/sync', ['changes' => [['c' => 'hospitals', 'id' => 'VV-0001', 'b' => $h2, 'a' => ['bizStatus' => '없어짐'] + $h2]]])->assertStatus(422);
    }

    public function test_map_views_are_saved_per_user(): void
    {
        $s = $this->user('u_s', 'r_sales', 'sales');
        $o = $this->user('u_o', 'r_sales', 'other');
        $this->actingAs($s)->postJson('/api/me/map-views', ['views' => [['id' => 'mv_1', 'name' => '강남 신규', 'f' => ['sido' => '서울', 'sigungu' => '강남구', 'biz' => ['영업'], 'owner' => '__none']]]])
            ->assertOk()->assertJsonPath('views.0.f.sigungu', '강남구');
        $this->actingAs($s)->getJson('/api/state')->assertJsonPath('mapViews.0.name', '강남 신규');
        $this->actingAs($o)->getJson('/api/state')->assertJsonPath('mapViews', []);
    }
}
