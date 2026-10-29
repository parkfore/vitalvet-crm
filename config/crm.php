<?php

/*
|--------------------------------------------------------------------------
| VitalVET 영업 CRM 서버 기준
|--------------------------------------------------------------------------
| 화면 동작(계산·표시)은 resources/js/crm/app.js 에 있고, 서버는 저장과 권한 확인을 맡는다.
| 아래 값은 화면(프로토타입)과 같은 값이어야 한다.
*/

return [

    // 기능(메뉴) => 가능한 동작
    'features' => [
        'myday' => ['view', 'read'],
        'dash' => ['view', 'read'],
        'hospital' => ['view', 'read', 'create', 'update', 'delete'],
        'eval' => ['view', 'read', 'create', 'update', 'delete'],
        'activity' => ['view', 'read', 'create', 'update', 'delete'],
        'conv' => ['view', 'read', 'create', 'update', 'delete'],
        'map' => ['view', 'read'],
        'attendance' => ['view', 'read', 'create', 'update', 'delete'],
        'report' => ['view', 'read', 'create', 'update', 'delete'],
        'category' => ['view', 'read', 'create', 'update', 'delete'],
        'team' => ['view', 'read', 'create', 'update', 'delete'],
        'competitor' => ['view', 'read', 'create', 'update', 'delete'],
        'history' => ['view', 'read'],
        'users' => ['view', 'read', 'create', 'update', 'delete'],
        'settings' => ['view', 'read', 'update'],
    ],

    // '내 담당 병원만' 범위가 적용되는 기능
    'scoped' => ['hospital', 'eval', 'activity', 'conv'],

    // 관리자 역할 (잠김, 항상 모든 권한)
    'admin_role' => 'r_admin',

    // 기본 역할: [id, 이름, 설명, 범위, 잠김, 권한(v r c u d)]
    'roles' => [
        ['r_admin', '관리자', '모든 기능과 권한 관리', 'all', true, '*'],
        ['r_lead', '영업팀장', '전체 병원 관리, 사용자 조회', 'all', false, ['*' => 'vrcud', 'users' => 'vr', 'settings' => 'vr']],
        ['r_sales', '영업사원', '담당 병원만 수정, 삭제 불가', 'own', false, [
            'myday' => 'vr', 'dash' => 'vr', 'hospital' => 'vrcu', 'eval' => 'vrcud', 'activity' => 'vrcud', 'conv' => 'vrcu',
            'report' => 'vrcud', 'attendance' => 'vrcd', 'competitor' => 'vrc', 'map' => 'vr', 'category' => 'vr', 'history' => 'vr',
        ]],
        ['r_viewer', '조회 전용', '마케팅·경영지원용, 전환·사용 숨김', 'all', false, [
            'dash' => 'vr', 'hospital' => 'vr', 'eval' => 'vr', 'activity' => 'vr', 'map' => 'vr', 'category' => 'vr',
            'attendance' => 'vrcd', 'competitor' => 'vr',
        ]],
    ],

    // 기본 영업 단계 [이름, 구분, 자동 전환]
    'stages' => [
        ['미접촉(예정)', 'main', ''],
        ['접촉/리드', 'main', 'contact'],
        ['1차 방문', 'main', 'visit1'],
        ['2차 방문', 'main', 'visit2'],
        ['회원가입', 'main', 'signup'],
        ['VitalVet 사용', 'main', 'use'],
        ['활성 고객', 'main', ''],
        ['보류', 'exit', ''],
        ['Lost', 'exit', ''],
    ],

    // 선택 목록
    'codes' => [
        'grades' => ['1차', '1.5차', '2차'],
        'specialties' => ['일반진료', '내과', '외과', '정형외과', '치과', '안과', '피부과', '영상의학', '응급/중환자', '기타'],
        // 소속 (회원가입·사용자 등록에서 고르는 목록, 설정에서 관리)
        'teams' => ['영업1팀', '영업2팀', '운영팀'],
    ],

    'settings' => ['visitGoal' => 4, 'mapProvider' => 'kakao'],

    // 병원 필수 정보: 직접 등록·수정할 때 꼭 넣어야 하고, 빠져 있으면 '정보 미완성'으로 표시한다 (설정에서 바꿈)
    'required_options' => ['name', 'address', 'phone', 'director', 'directorPhone', 'directorAge', 'ownerId', 'grade', 'specialty', 'vetCount', 'geo'],
    'required_default' => ['name', 'address', 'phone', 'director', 'ownerId'],

    // 회사 휴일 (근태·영업 보고의 근무일 계산). 화면의 근태 일정 > 회사 휴일에서 바꿀 수 있다.
    'holidays' => [
        '2026-09-24' => '추석 연휴', '2026-09-25' => '추석', '2026-10-03' => '개천절', '2026-10-05' => '대체공휴일',
        '2026-10-09' => '한글날', '2026-12-25' => '성탄절',
        '2027-01-01' => '신정', '2027-02-05' => '설날 연휴', '2027-02-08' => '설날 대체공휴일',
        '2027-03-01' => '삼일절', '2027-05-05' => '어린이날', '2027-05-13' => '부처님오신날', '2027-06-06' => '현충일',
        '2027-08-16' => '광복절 대체공휴일', '2027-09-14' => '추석 연휴', '2027-09-15' => '추석', '2027-09-16' => '추석 연휴',
        '2027-10-04' => '개천절 대체공휴일', '2027-10-11' => '한글날 대체공휴일', '2027-12-27' => '성탄절 대체공휴일',
    ],
];
