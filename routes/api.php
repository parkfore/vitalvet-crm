<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ShotController;
use App\Http\Controllers\Api\StateController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// 모든 경로 앞에 /api 가 붙는다 (bootstrap/app.php). 세션 로그인 + CSRF 보호.

Route::get('/health', HealthController::class)->name('api.health');

// 로그인 전
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/auth/signup', [AuthController::class, 'signup'])->middleware('throttle:10,1');
Route::get('/me', [AuthController::class, 'me']);

// 로그인 후
Route::middleware(['auth:web', 'active'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/password', [AuthController::class, 'changePassword']);
    Route::post('/users/{id}/password', [AuthController::class, 'setPassword']);
    Route::get('/state', StateController::class);
    Route::post('/sync', SyncController::class);
    Route::get('/shots/{id}', ShotController::class);
});
