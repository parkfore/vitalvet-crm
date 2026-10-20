<?php

use App\Http\Middleware\EnsureActiveUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // 화면과 같은 주소에서 쓰는 API: 세션 로그인 + CSRF 보호를 위해 web 미들웨어를 쓴다
        then: function () {
            Route::middleware(['web', App\Http\Middleware\DataVersion::class])->prefix('api')->group(base_path('routes/api.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['active' => EnsureActiveUser::class]);
        // 클라우드웨이즈(Nginx·Varnish 등 서버 안 프록시) 뒤에서 실제 접속 IP 를 쓰도록 (접속 기록·로그인 제한)
        $middleware->trustProxies(at: ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // 서버 오류를 오류 기록(관리자 › 오류 기록)에 모은다
        $exceptions->report(function (Throwable $e) {
            App\Support\ErrorLog::server($e);
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        // 한국어 오류 응답 {code, message}
        $exceptions->render(fn (AuthenticationException $e, Request $r) => $r->is('api/*')
            ? response()->json(['code' => 'UNAUTHENTICATED', 'message' => '로그인이 필요합니다'], 401) : null);
        $exceptions->render(fn (TokenMismatchException|HttpException $e, Request $r) => $r->is('api/*') && ($e instanceof TokenMismatchException || $e->getStatusCode() === 419)
            ? response()->json(['code' => 'SESSION_EXPIRED', 'message' => '화면이 오래되어 다시 시도해야 합니다. 새로고침 후 다시 해 주세요'], 419) : null);
        $exceptions->render(fn (ModelNotFoundException|NotFoundHttpException $e, Request $r) => $r->is('api/*')
            ? response()->json(['code' => 'NOT_FOUND', 'message' => '찾을 수 없습니다. 삭제되었을 수 있습니다'], 404) : null);
    })->create();
