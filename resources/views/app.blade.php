<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0B6E63">
    <title>VitalVET 영업 CRM</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
    <script>
        // 화면에서 쓰는 공개 설정 (비밀 키는 넣지 않는다)
        window.__CRM = {{ Js::from(['kakaoKey' => (string) config('services.maps.kakao.js_key')]) }};
    </script>
    @vite(['resources/css/crm.css', 'resources/js/crm/app.js'])
</head>
<body>
<div class="app">
  <nav class="nav" id="nav"></nav>
  <main class="main" id="main"></main>
  <div class="tabbar" id="tabbar"></div>
</div>
<div id="drawerLayer"></div>
<div id="modalLayer"></div>
<div id="addrLayer"></div>
<div id="confirmLayer"></div>
<div id="loginLayer"></div>
<div id="toastLayer"></div>
</body>
</html>
