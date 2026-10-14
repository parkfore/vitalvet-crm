<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_reports_api_and_database_ok(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('checks.api', true)
            ->assertJsonPath('checks.database', true)
            ->assertJsonStructure(['app', 'env', 'time', 'timezone', 'checks' => ['api', 'database', 'map_key'], 'map_provider']);
    }

    public function test_health_hides_details_in_production(): void
    {
        config(['app.debug' => false]);
        $this->app->detectEnvironment(fn () => 'production');

        $this->getJson('/api/health')->assertOk()->assertJsonPath('detail', null);
    }

    public function test_map_key_flag_follows_provider(): void
    {
        config(['services.maps.provider' => 'kakao', 'services.maps.kakao.js_key' => 'abc']);
        $this->getJson('/api/health')->assertJsonPath('checks.map_key', true);

        config(['services.maps.provider' => 'naver', 'services.maps.naver.client_id' => null]);
        $this->getJson('/api/health')->assertJsonPath('checks.map_key', false)->assertJsonPath('map_provider', 'naver');
    }
}
