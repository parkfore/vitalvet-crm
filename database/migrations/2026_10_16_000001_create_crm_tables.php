<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * VitalVET 영업 CRM 테이블
 * - 각 행은 화면에서 쓰는 레코드 하나 (data 칸에 JSON 전체, 검색·권한에 쓰는 값은 별도 칸)
 * - id 는 화면에서 만든 문자열 (병원 VV-0001, 사용자 u_xxx …)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->integer('sort')->default(0);
            $t->json('data');            // name, desc, scope(all|own), locked, perms{기능:{view,read,create,update,delete}}
            $t->timestamps();
        });

        Schema::create('hospitals', function (Blueprint $t) {
            $t->string('id', 20)->primary();   // VV-0001
            $t->string('name', 120)->index();
            $t->string('owner_id', 40)->nullable()->index();
            $t->string('stage', 60)->index();
            $t->string('deleted_at', 10)->nullable();  // 삭제일 (YYYY-MM-DD), 복원하면 비움
            $t->json('data');            // 기본 정보·단계 이력·리드 평가·영업 활동·다음 액션·전환 정보
            $t->timestamps();
        });

        // 리드 평가 근거 이미지 (병원 data.eval.shots 에는 id·이름·날짜만 두고 이미지는 여기)
        Schema::create('eval_shots', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('hospital_id', 20)->index();
            $t->string('mime', 40);
            $t->longText('data');        // base64
            $t->string('created_by', 40)->nullable();
            $t->timestamps();
        });

        foreach (['categories', 'stages'] as $name) {
            Schema::create($name, function (Blueprint $t) {
                $t->string('id', 40)->primary();
                $t->integer('sort')->default(0);
                $t->json('data');
                $t->timestamps();
            });
        }

        Schema::create('competitors', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->json('data');
            $t->timestamps();
        });

        Schema::create('reports', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('author_id', 40)->index();
            $t->string('date', 10)->index();
            $t->string('status', 12);    // draft | submitted | confirmed | returned
            $t->json('data');
            $t->timestamps();
            $t->unique(['author_id', 'date']);
        });

        Schema::create('attendance', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('user_id', 40)->index();
            $t->string('status', 12);    // requested | approved | rejected | canceled
            $t->string('from_date', 10);
            $t->string('to_date', 10);
            $t->json('data');
            $t->timestamps();
        });

        Schema::create('todos', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('user_id', 40)->index();
            $t->json('data');
            $t->timestamps();
        });

        Schema::create('coaching', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('user_id', 40)->index();
            $t->json('data');
            $t->timestamps();
        });

        // 변경 이력: 추가만 가능 (수정·삭제 API 없음)
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('ts', 30)->index();
            $t->string('user_id', 40)->nullable()->index();
            $t->string('entity', 20)->index();
            $t->string('entity_id', 40)->nullable()->index();
            $t->string('hospital_id', 20)->nullable()->index();
            $t->json('data');
            $t->timestamp('created_at')->useCurrent();
        });

        // settings(카카오 키·방문 목표) · codes(선택 목록) · holidays(회사 휴일)
        Schema::create('app_settings', function (Blueprint $t) {
            $t->string('key', 40)->primary();
            $t->json('value');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['app_settings', 'audit_logs', 'coaching', 'todos', 'attendance', 'reports', 'competitors', 'stages', 'categories', 'eval_shots', 'hospitals', 'roles'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
