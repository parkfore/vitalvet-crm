<?php

return [
    'required' => ':attribute 항목을 입력하세요.',
    'required_with' => ':attribute 항목을 입력하세요.',
    'email' => ':attribute 형식이 올바르지 않습니다.',
    'unique' => '이미 사용 중인 :attribute입니다.',
    'exists' => '선택한 :attribute이(가) 올바르지 않습니다.',
    'in' => '선택한 :attribute이(가) 올바르지 않습니다.',
    'integer' => ':attribute은(는) 숫자로 입력하세요.',
    'numeric' => ':attribute은(는) 숫자로 입력하세요.',
    'boolean' => ':attribute 값이 올바르지 않습니다.',
    'date' => ':attribute 날짜 형식이 올바르지 않습니다.',
    'date_format' => ':attribute 날짜 형식이 올바르지 않습니다.',
    'before_or_equal' => ':attribute은(는) 오늘 이후로 정할 수 없습니다.',
    'array' => ':attribute 값이 올바르지 않습니다.',
    'string' => ':attribute 값이 올바르지 않습니다.',
    'image' => ':attribute은(는) 이미지 파일이어야 합니다.',
    'mimes' => ':attribute은(는) 이미지 파일(jpg, png, webp)이어야 합니다.',
    'regex' => ':attribute 형식이 올바르지 않습니다.',
    'confirmed' => ':attribute 확인이 일치하지 않습니다.',
    'min' => [
        'numeric' => ':attribute은(는) :min 이상이어야 합니다.',
        'string' => ':attribute은(는) :min자 이상이어야 합니다.',
        'array' => ':attribute을(를) :min개 이상 선택하세요.',
    ],
    'max' => [
        'numeric' => ':attribute은(는) :max 이하여야 합니다.',
        'string' => ':attribute은(는) :max자 이하여야 합니다.',
        'array' => ':attribute은(는) :max개까지 선택할 수 있습니다.',
        'file' => ':attribute은(는) :max KB 이하여야 합니다.',
    ],
    'between' => [
        'numeric' => ':attribute은(는) :min~:max 사이여야 합니다.',
    ],
    'attributes' => [
        'name' => '이름', 'email' => '이메일', 'password' => '비밀번호', 'team' => '소속', 'phone' => '연락처',
        'address' => '주소', 'zip' => '우편번호', 'role_id' => '역할', 'owner_id' => '담당 영업사원',
        'stage_id' => '단계', 'pre_type' => '예정 구분', 'sources' => '접촉 경로', 'category_ids' => '카테고리',
        'type' => '유형', 'date' => '날짜', 'note' => '내용', 'next_date' => '다음 액션일', 'next_todo' => '팔로우업 할 사항',
        'file' => '파일', 'scope' => '수정 범위', 'color' => '색상', 'kind' => '구분', 'vet_count' => '봉직수의사 수',
        'usage_count' => '사용 건수', 'surgery_count' => '실제 월 마취 건수', 'visit_goal' => '일일 방문 목표',
    ],
];
