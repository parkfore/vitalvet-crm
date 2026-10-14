<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_app_shell_is_served(): void
    {
        $this->withoutVite();

        $this->get('/')
            ->assertOk()
            ->assertSee('<div id="root"></div>', false)
            ->assertSee('favicon.svg', false);
    }

    public function test_map_keys_come_from_env_without_secrets(): void
    {
        $this->seed(DatabaseSeeder::class);
        config([
            'services.maps.provider' => 'kakao',
            'services.maps.kakao.js_key' => 'public-js-key',
            'services.maps.kakao.rest_key' => 'secret-rest-key',
            'services.maps.naver.client_secret' => 'naver-secret',
        ]);
        $u = User::create(['id' => 'u_a', 'username' => 'admin', 'password' => 'password123', 'status' => 'active', 'role_id' => 'r_admin', 'data' => ['name' => 'A']]);

        $this->actingAs($u)->getJson('/api/state')
            ->assertOk()
            ->assertJsonPath('maps.kakaoKey', 'public-js-key')
            ->assertDontSee('secret-rest-key', false)
            ->assertDontSee('naver-secret', false);
    }

    public function test_spa_routes_fall_back_to_the_app_shell(): void
    {
        $this->withoutVite();

        $this->get('/hospitals/123')->assertOk()->assertSee('id="root"', false);
    }

    public function test_unknown_api_routes_return_json_404(): void
    {
        $this->getJson('/api/does-not-exist')->assertNotFound();
    }
}
