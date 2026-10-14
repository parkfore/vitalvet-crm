<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// 서버·DB 연결 상태 확인 (배포 후 점검용)
Route::get('/health', HealthController::class)->name('api.health');
