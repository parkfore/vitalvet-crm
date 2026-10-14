<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_the_app_shell_is_served(): void
    {
        $this->withoutVite();

        $this->get('/')
            ->assertOk()
            ->assertSee('<div id="root"></div>', false);
    }

    public function test_public_config_is_exposed_without_secrets(): void
    {
        $this->withoutVite();
        config([
            'services.maps.provider' => 'kakao',
            'services.maps.kakao.js_key' => 'public-js-key',
            'services.maps.kakao.rest_key' => 'secret-rest-key',
        ]);

        $this->get('/')
            ->assertOk()
            ->assertSee('public-js-key', false)
            ->assertDontSee('secret-rest-key', false);
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
