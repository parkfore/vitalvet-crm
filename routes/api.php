<?php

use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HospitalController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\ShotController;
use App\Http\Controllers\Api\StageController;
use App\Http\Controllers\Api\UserController;
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
    Route::get('/meta', MetaController::class);
    Route::get('/dashboard', DashboardController::class);

    // 병원
    Route::get('/hospitals', [HospitalController::class, 'index']);
    Route::post('/hospitals', [HospitalController::class, 'store']);
    Route::get('/hospitals/{hospital}', [HospitalController::class, 'show']);
    Route::put('/hospitals/{hospital}', [HospitalController::class, 'update']);
    Route::delete('/hospitals/{hospital}', [HospitalController::class, 'destroy']);
    Route::post('/hospitals/{id}/restore', [HospitalController::class, 'restore'])->whereNumber('id');
    Route::put('/hospitals/{hospital}/stage', [HospitalController::class, 'stage']);
    Route::put('/hospitals/{hospital}/eval', [HospitalController::class, 'saveEval']);
    Route::delete('/hospitals/{hospital}/eval', [HospitalController::class, 'deleteEval']);
    Route::post('/hospitals/{hospital}/shots', [ShotController::class, 'store']);
    Route::get('/shots/{shot}', [ShotController::class, 'show']);
    Route::delete('/shots/{shot}', [ShotController::class, 'destroy']);
    Route::put('/hospitals/{hospital}/next', [HospitalController::class, 'saveNext']);
    Route::delete('/hospitals/{hospital}/next', [HospitalController::class, 'clearNext']);
    Route::put('/hospitals/{hospital}/conversion', [HospitalController::class, 'saveConv']);
    Route::get('/hospitals/{hospital}/timeline', [HospitalController::class, 'timeline']);

    // 영업 활동
    Route::post('/hospitals/{hospital}/activities', [ActivityController::class, 'store']);
    Route::put('/activities/{activity}', [ActivityController::class, 'update']);
    Route::delete('/activities/{activity}', [ActivityController::class, 'destroy']);

    // 관리
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::post('/users/{user}/approve', [UserController::class, 'approve']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);
    Route::get('/roles', [RoleController::class, 'index']);
    Route::post('/roles', [RoleController::class, 'store']);
    Route::put('/roles/{role}', [RoleController::class, 'update']);
    Route::post('/roles/{role}/reset', [RoleController::class, 'reset']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
    Route::post('/stages', [StageController::class, 'store']);
    Route::put('/stages/order', [StageController::class, 'order']);
    Route::put('/stages/{stage}', [StageController::class, 'update']);
    Route::delete('/stages/{stage}', [StageController::class, 'destroy']);
    Route::put('/settings', [SettingController::class, 'update']);
    Route::put('/codes/{grp}', [SettingController::class, 'codes']);
    Route::get('/audit-logs', [AuditController::class, 'index']);
});
