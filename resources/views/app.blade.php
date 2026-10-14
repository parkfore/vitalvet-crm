<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#0B6E63">
    <title>{{ config('app.name') }}</title>
    @php
        // 화면(React)에서 쓰는 공개 설정. 비밀 키는 절대 넣지 않는다.
        $mapProvider = config('services.maps.provider');
        $publicConfig = [
            'name' => config('app.name'),
            'env' => app()->environment(),
            'mapProvider' => $mapProvider,
            'mapJsKey' => $mapProvider === 'naver'
                ? config('services.maps.naver.client_id')
                : config('services.maps.kakao.js_key'),
        ];
    @endphp
    <script>
        window.__APP__ = {{ Js::from($publicConfig) }};
    </script>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/main.tsx'])
</head>
<body>
    <div id="root"></div>
</body>
</html>
