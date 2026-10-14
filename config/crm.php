<?php

/*
|--------------------------------------------------------------------------
| VitalVET CRM 공통 기준
|--------------------------------------------------------------------------
| 화면(React)과 서버가 같은 기준을 쓰도록 /api/meta 로 그대로 내려준다.
| 값을 바꾸면 화면도 함께 바뀐다.
*/

return [

    // 권한 동작: 표시 · 읽기 · 입력 · 수정 · 삭제
    'ops' => ['view', 'read', 'create', 'update', 'delete'],

    // 기능(메뉴) 목록: 키 => [이름, 가능한 동작, 설명]
    'features' => [
        'myday' => ['오늘 할 일', ['view', 'read'], '내 담당 병원 기준 오늘 할 일'],
        'dash' => ['대시보드', ['view', 'read'], '영업 현황 요약'],
        'hospital' => ['병원 기본 정보', ['view', 'read', 'create', 'update', 'delete'], '병원 등록·수정·삭제(복원), 단계·카테고리 지정'],
        'eval' => ['리드 평가', ['view', 'read', 'create', 'update', 'delete'], '디지털 수용도·서비스 호감도·월 마취 건수 (상·중·하)'],
        'activity' => ['영업 활동', ['view', 'read', 'create', 'update', 'delete'], '방문·전화 기록, 다음 액션'],
        'conv' => ['전환·사용', ['view', 'read', 'create', 'update', 'delete'], '회원가입일·사용 건수·비고'],
        'map' => ['지도·동선', ['view', 'read'], '지도, 동선 짜기'],
        'attendance' => ['근태 일정', ['view', 'read', 'create', 'update', 'delete'], '연차·반차 등 신청·승인'],
        'report' => ['영업 보고', ['view', 'read', 'create', 'update', 'delete'], '일일 보고서 작성·검토·분석'],
        'category' => ['카테고리', ['view', 'read', 'create', 'update', 'delete'], '카테고리 추가·변경·삭제'],
        'team' => ['팀 성과', ['view', 'read', 'create', 'update', 'delete'], '영업사원 역량 비교와 코칭 메모'],
        'competitor' => ['경쟁사', ['view', 'read', 'create', 'update', 'delete'], '경쟁사·경쟁 제품 정보'],
        'history' => ['변경 이력', ['view', 'read'], '병원 타임라인, 전체 변경 이력'],
        'users' => ['사용자·권한', ['view', 'read', 'create', 'update', 'delete'], '가입 승인, 사용자·역할 관리'],
        'settings' => ['설정', ['view', 'read', 'update'], '영업 단계, 선택 목록, 영업 목표'],
    ],

    // '담당만' 범위가 적용되는 기능 (입력·수정·삭제가 담당 병원으로 제한됨)
    'scoped' => ['hospital', 'eval', 'activity', 'conv'],

    // 기본 역할 (V 표시 · R 읽기 · C 입력 · U 수정 · D 삭제)
    'roles' => [
        'admin' => ['관리자', '모든 기능과 권한 관리', 'all', true, '*'],
        'lead' => ['영업팀장', '전체 병원 관리, 사용자는 조회만', 'all', false, ['*' => 'VRCUD', 'users' => 'VR', 'settings' => 'VR']],
        'sales' => ['영업사원', '담당 병원만 수정, 삭제 불가', 'own', false, [
            'myday' => 'VR', 'dash' => 'VR', 'hospital' => 'VRCU', 'eval' => 'VRCUD', 'activity' => 'VRCUD', 'conv' => 'VRCU',
            'report' => 'VRCUD', 'attendance' => 'VRCD', 'competitor' => 'VRC', 'map' => 'VR', 'category' => 'VR', 'history' => 'VR',
        ]],
        'viewer' => ['조회 전용', '마케팅·경영지원용, 전환·사용 숨김', 'all', false, [
            'dash' => 'VR', 'hospital' => 'VR', 'eval' => 'VR', 'activity' => 'VR', 'map' => 'VR', 'category' => 'VR',
            'attendance' => 'VRCD', 'competitor' => 'VR',
        ]],
    ],

    // 영업 단계 기본값 [이름, 구분(main 진행 / exit 이탈), 자동 전환 조건, 색]
    'stages' => [
        ['미접촉(예정)', 'main', null, '#8A9794'],
        ['접촉/리드', 'main', 'contact', '#5B7FA6'],
        ['1차 방문', 'main', 'visit1', '#2E90FA'],
        ['2차 방문', 'main', 'visit2', '#5A67E8'],
        ['회원가입', 'main', 'signup', '#9460E0'],
        ['VitalVet 사용', 'main', 'use', '#12A66A'],
        ['활성 고객', 'main', null, '#067647'],
        ['보류', 'exit', null, '#D16A06'],
        ['Lost', 'exit', null, '#B42318'],
    ],

    'triggers' => [
        'contact' => '첫 접촉 기록 시',
        'visit1' => '첫 방문 기록 시',
        'visit2' => '두 번째 방문 기록 시',
        'signup' => '회원가입일 입력 시',
        'use' => '사용 건수 입력 시',
    ],

    // 미접촉(예정) 구분 [이름, 색]
    'pre_types' => [
        'call' => ['연락 예정', '#1D5FA8'],
        'visit' => ['방문 예정', '#067647'],
        'send' => ['자료전송 예정', '#9460E0'],
    ],

    // 접촉 경로 (복수 선택)
    'lead_sources' => ['전시회', '광고', '세미나', '지인추천', '고객추천', '방문영업', '행사영업'],

    // 리드 평가: 항목별 상(3)·중(2)·하(1) 합산 → 7~9 상 / 5~6 중 / 3~4 하
    'eval_items' => [
        'adoption' => ['디지털 수용도', '태블릿·전자차트·온라인 서비스 활용 정도. 근거 화면을 캡처해 올려 두세요'],
        'favor' => ['서비스 호감도', 'VitalVET 서비스에 대한 관심과 호의'],
        'surgeries' => ['월 마취 건수', '월 평균 마취·수술 규모'],
    ],
    'eval_levels' => [3 => '상', 2 => '중', 1 => '하'],
    'eval_max_shots' => 4,

    'activity_types' => ['방문', '전화', '문자/카톡', '이메일', '세미나/행사', '기타'],
    'activity_purposes' => ['첫 소개', '제품 소개·시연', '추가 시연', '가입 상담', '가입 지원', '사용 교육', '정기 관리', '불만 대응', '후속 연락', '일정 조율', '사용 현황 확인', '자료 발송', '자료 안내'],
    'activity_contacts' => ['원장', '봉직의', '실장', '테크니션', '기타'],
    'activity_reactions' => ['긍정', '보통', '부정', '부재'],
    'voc_types' => ['기능 요청', '불만/개선', '가격', '교육 요청', '칭찬'],
    'issue_types' => ['자료 요청', '시연 장비', '기술 지원', '가격 승인', '기타'],

    'category_colors' => ['#0B6E63', '#2E90FA', '#9460E0', '#D16A06', '#D92D20', '#C11574', '#4E5BA6', '#6E7F2E'],

    'codes' => [
        'grade' => ['1차', '1.5차', '2차'],
        'specialty' => ['일반진료', '내과', '외과', '정형외과', '피부과', '안과', '치과', '영상의학', '응급/중환자', '종양', '고양이 전문', '특수동물', '기타'],
    ],
];
