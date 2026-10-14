<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    /*
    | 지도 제공자 설정
    | MAP_PROVIDER 값만 바꾸면 화면이 다른 지도(kakao → naver)를 쓰도록 만든다.
    | JavaScript 키는 브라우저에 노출되는 값이라 도메인 제한으로 보호하고,
    | REST/Secret 키는 서버(.env)에만 둔다.
    */
    'maps' => [
        'provider' => env('MAP_PROVIDER', 'kakao'),
        'kakao' => [
            'js_key' => env('KAKAO_JS_KEY'),
            'rest_key' => env('KAKAO_REST_KEY'),
        ],
        'naver' => [
            'client_id' => env('NAVER_MAP_CLIENT_ID'),
            'client_secret' => env('NAVER_MAP_CLIENT_SECRET'),
        ],
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
