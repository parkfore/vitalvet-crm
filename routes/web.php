<?php

use Illuminate\Support\Facades\Route;

// 화면: /api, /up 을 제외한 모든 주소는 같은 화면을 내려준다.
Route::view('/{any?}', 'app')
    ->where('any', '^(?!api(/|$)|up$).*$')
    ->name('app');
