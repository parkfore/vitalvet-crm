<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CoachingReadController;
use App\Http\Controllers\Api\ErrorLogController;
use App\Http\Controllers\Api\GoalController;
use App\Http\Controllers\Api\NotifController;
use App\Http\Controllers\Api\HospitalAssignController;
use App\Http\Controllers\Api\HospitalIdController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\MapViewController;
use App\Http\Controllers\Api\RouteController;
use App\Http\Controllers\Api\StateController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// 모든 경로 앞에 /api 가 붙는다 (bootstrap/app.php). 세션 로그인 + CSRF 보호.

Route::get('/health', HealthController::class)->name('api.health');

// 로그인 전
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/auth/signup', [AuthController::class, 'signup'])->middleware('throttle:10,1');
Route::get('/auth/teams', [AuthController::class, 'teams']);
Route::get('/me', [AuthController::class, 'me']);

// 로그인 후
Route::middleware(['auth:web', 'active'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/password', [AuthController::class, 'changePassword']);
    Route::post('/users/{id}/password', [AuthController::class, 'setPassword']);
    Route::get('/state', StateController::class);
    Route::post('/sync', SyncController::class);
    Route::post('/me/map-views', MapViewController::class);
    Route::post('/me/route', RouteController::class);
    Route::post('/hospitals/reserve', HospitalIdController::class);
    Route::post('/hospitals/assign', HospitalAssignController::class);
    Route::post('/goals', GoalController::class);
    // 바뀐 것이 있는지만 확인 (아주 작은 응답)
    Route::get('/ping', fn () => response()->json(['v' => (string) App\Support\Store::setting('data_ver', '')]));
    // 알림 (웹푸시)
    Route::post('/push/subscribe', [NotifController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [NotifController::class, 'unsubscribe']);
    Route::post('/notif/test', [NotifController::class, 'test']);
    Route::post('/notif/me', [NotifController::class, 'saveMine']);
    Route::get('/admin/notif', [NotifController::class, 'admin']);
    Route::post('/admin/notif', [NotifController::class, 'saveDefaults']);
    Route::post('/me/coaching-read', CoachingReadController::class);

    // 관리자 전용: 백업, 접속·이용 기록
    Route::get('/admin/backups', [AdminController::class, 'backups']);
    Route::post('/admin/backups', [AdminController::class, 'backupNow']);
    Route::get('/admin/backups/{name}', [AdminController::class, 'download'])->where('name', '[A-Za-z0-9._-]+');
    Route::get('/admin/logs', [AdminController::class, 'logs']);
    Route::get('/admin/errors', [ErrorLogController::class, 'index']);
    Route::post('/admin/errors/clear', [ErrorLogController::class, 'clear']);
    Route::post('/client-errors', [ErrorLogController::class, 'client']);

    // 병원 정보 가져오기 (엑셀·CSV, 공공데이터 API)
    Route::post('/import/preview', [ImportController::class, 'preview']);
    Route::post('/import/rows', [ImportController::class, 'rows']);
    Route::post('/import/finish', [ImportController::class, 'finish']);
    Route::post('/import/geocode', [ImportController::class, 'geocode']);
    Route::post('/import/api/config', [ImportController::class, 'apiConfig']);
    Route::post('/import/api/test', [ImportController::class, 'apiTest']);
    Route::post('/import/api/page', [ImportController::class, 'apiPage']);
});
