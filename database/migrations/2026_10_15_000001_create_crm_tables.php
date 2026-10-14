<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * VitalVET CRM 1단계 테이블.
 * Laravel 전용 흔적(클래스 이름 저장 등)을 남기지 않아 다른 백엔드(Spring 등)로 옮겨도 그대로 쓸 수 있게 한다.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $t) {
            $t->id();
            $t->string('key', 40)->nullable()->unique();      // 기본 역할 식별자 (admin, lead, sales, viewer)
            $t->string('name', 40)->unique();
            $t->string('description', 200)->nullable();
            $t->string('scope', 10)->default('all');          // all | own
            $t->boolean('locked')->default(false);             // 관리자: 항상 전체 권한
            $t->json('permissions');                           // {feature: {view,read,create,update,delete}}
            $t->timestamps();
        });

        Schema::table('users', function (Blueprint $t) {
            $t->string('team', 40)->nullable();
            $t->string('phone', 20)->nullable();
            $t->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
            $t->string('status', 10)->default('pending');     // pending | active | inactive
            $t->decimal('annual_leave', 4, 1)->default(15);
            $t->timestamp('last_login_at')->nullable();
        });

        Schema::create('stages', function (Blueprint $t) {
            $t->id();
            $t->string('name', 30)->unique();
            $t->string('kind', 10);                            // main | exit
            $t->string('trigger', 20)->nullable()->unique();   // contact | visit1 | visit2 | signup | use
            $t->string('color', 20);
            $t->integer('sort')->default(0);
            $t->timestamps();
        });

        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->string('name', 40)->unique();
            $t->string('description', 200)->nullable();
            $t->string('color', 20);
            $t->integer('sort')->default(0);
            $t->timestamps();
        });

        Schema::create('code_items', function (Blueprint $t) {
            $t->id();
            $t->string('grp', 20);                             // grade | specialty
            $t->string('value', 40);
            $t->integer('sort')->default(0);
            $t->unique(['grp', 'value']);
        });

        Schema::create('competitors', function (Blueprint $t) {
            $t->id();
            $t->string('name', 100)->unique();
            $t->string('company', 100)->nullable();
            $t->string('type', 40)->nullable();
            $t->string('threat', 10)->default('mid');          // high | mid | low
            $t->string('website', 300)->nullable();
            $t->string('phone', 20)->nullable();
            $t->string('zip', 10)->nullable();
            $t->string('address', 200)->nullable();
            $t->string('address_detail', 100)->nullable();
            $t->string('regions', 200)->nullable();
            $t->text('strengths')->nullable();
            $t->text('weaknesses')->nullable();
            $t->text('counter')->nullable();
            $t->text('memo')->nullable();
            $t->timestamps();
        });

        Schema::create('hospitals', function (Blueprint $t) {
            $t->id();
            $t->string('code', 12)->nullable()->unique();      // VV-0001
            $t->string('name', 100);
            $t->string('zip', 10)->nullable();
            $t->string('address', 200);
            $t->string('jibun', 200)->nullable();
            $t->string('address_detail', 100)->nullable();
            $t->string('sido', 20)->nullable();
            $t->string('sigungu', 30)->nullable();
            $t->decimal('lat', 9, 6)->nullable();
            $t->decimal('lng', 9, 6)->nullable();
            $t->string('grade', 20)->nullable();
            $t->string('specialty', 40)->nullable();
            $t->string('phone', 20)->nullable();
            $t->string('director', 40)->nullable();
            $t->string('director_phone', 20)->nullable();
            $t->smallInteger('vet_count')->nullable();
            $t->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('stage_id')->constrained('stages');
            $t->string('pre_type', 10)->nullable();            // 미접촉(예정) 구분: call | visit | send
            $t->json('sources')->nullable();                   // 접촉 경로 (복수)
            // 리드 평가: 3=상 2=중 1=하, NULL=미입력
            $t->smallInteger('eval_adoption')->nullable();
            $t->smallInteger('eval_favor')->nullable();
            $t->smallInteger('eval_surgeries')->nullable();
            $t->integer('eval_surgery_count')->nullable();     // 실제 월 마취 건수 (참고)
            $t->date('eval_date')->nullable();
            // 다음 액션
            $t->string('next_todo', 200)->nullable();
            $t->date('next_date')->nullable();
            $t->boolean('next_done')->default(false);
            // 전환·사용
            $t->date('signup_date')->nullable();
            $t->integer('usage_count')->default(0);
            $t->date('last_used_date')->nullable();
            $t->text('conv_note')->nullable();
            $t->foreignId('competitor_id')->nullable()->constrained('competitors')->nullOnDelete();
            $t->date('competitor_until')->nullable();
            $t->text('memo')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('deleted_at')->nullable();
            $t->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['owner_id', 'deleted_at']);
            $t->index(['stage_id', 'deleted_at']);
            $t->index('next_date');
        });

        Schema::create('category_hospital', function (Blueprint $t) {
            $t->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $t->foreignId('category_id')->constrained()->cascadeOnDelete();
            $t->primary(['hospital_id', 'category_id']);
        });

        Schema::create('activities', function (Blueprint $t) {
            $t->id();
            $t->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $t->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('type', 20);
            $t->date('date');
            $t->string('purpose', 40)->nullable();
            $t->string('contact', 20)->nullable();
            $t->string('reaction', 10)->nullable();
            $t->text('note')->nullable();
            // 보고서 항목 (그날 영업 보고서에 자동 반영)
            $t->string('voc_type', 20)->nullable();
            $t->text('voc_text')->nullable();
            $t->foreignId('comp_id')->nullable()->constrained('competitors')->nullOnDelete();
            $t->text('comp_text')->nullable();
            $t->string('issue_type', 20)->nullable();
            $t->text('issue_text')->nullable();
            $t->timestamps();
            $t->index(['author_id', 'date']);
            $t->index(['hospital_id', 'date']);
        });

        Schema::create('stage_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $t->date('date');
            $t->string('from_stage', 30)->nullable();          // 단계 이름을 그대로 저장 (이름이 바뀌어도 기록 유지)
            $t->string('to_stage', 30);
            $t->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->boolean('auto')->default(false);
            $t->timestamps();
        });

        Schema::create('eval_shots', function (Blueprint $t) {
            $t->id();
            $t->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $t->string('path', 300);                           // storage/app/private 아래 경로 (공개 URL 아님)
            $t->string('name', 200)->nullable();
            $t->string('mime', 60)->nullable();
            $t->integer('size')->nullable();
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        // 변경 이력: 추가만 가능 (수정·삭제 API 없음)
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->timestamp('at')->useCurrent();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('actor_name', 40)->nullable();          // 사용자가 지워져도 이름 유지
            $t->string('entity', 20);                          // hospital, category, user, role, settings, stage
            $t->string('entity_id', 40);
            $t->unsignedBigInteger('hospital_id')->nullable();
            $t->string('target_name', 120)->nullable();
            $t->string('action', 10);                          // create | update | delete | restore
            $t->string('section', 40)->nullable();
            $t->string('summary', 200)->nullable();
            $t->json('changes');                               // [{field, before, after}]
            $t->index(['entity', 'entity_id']);
            $t->index(['hospital_id', 'at']);
            $t->index('at');
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->string('key', 40)->primary();
            $t->json('value');
        });
    }

    public function down(): void
    {
        foreach (['settings', 'audit_logs', 'eval_shots', 'stage_history', 'activities', 'category_hospital', 'hospitals', 'competitors', 'code_items', 'categories', 'stages'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', function (Blueprint $t) {
            $t->dropConstrainedForeignId('role_id');
            $t->dropColumn(['team', 'phone', 'status', 'annual_leave', 'last_login_at']);
        });
        Schema::dropIfExists('roles');
    }
};
