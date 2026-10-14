<?php

use Illuminate\Support\Facades\Route;

// React 화면(SPA): /api, /up 을 제외한 모든 주소는 같은 화면을 내려주고
// 실제 화면 전환은 React 라우터가 처리한다.
Route::view('/{any?}', 'app')
    ->where('any', '^(?!api(/|$)|up$).*$')
    ->name('app');
