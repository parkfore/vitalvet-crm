<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Category;
use App\Models\Hospital;
use App\Models\Role;
use App\Models\Stage;
use App\Models\StageHistory;
use App\Models\User;
use App\Services\HospitalService;
use Illuminate\Database\Seeder;

/**
 * 테스트용 예시 데이터 (가상 병원 40곳 + 테스트 계정 4명).
 * 실행: php artisan db:seed --class=DemoSeeder
 * 실제 운영 전에는 php artisan migrate:fresh --seed 로 전부 지우고 다시 시작하세요.
 * 테스트 계정 비밀번호: demo1234!
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        mt_srand(42);
        $role = fn ($k) => Role::where('key', $k)->value('id');
        $users = [];
        foreach ([['김도현', 'lead', '영업1팀'], ['이수민', 'sales', '영업1팀'], ['박준호', 'sales', '영업2팀'], ['최유나', 'viewer', '마케팅팀']] as $i => [$name, $r, $team]) {
            $users[$r.$i] = User::updateOrCreate(['username' => "demo{$i}"], [
                'email' => "demo{$i}@vitalvet.example",
                'name' => $name, 'password' => 'demo1234!', 'team' => $team, 'role_id' => $role($r), 'status' => 'active',
                'phone' => sprintf('010-%04d-%04d', 2000 + $i * 777, 1000 + $i * 1234),
            ]);
        }
        $reps = [$users['sales1'], $users['sales2'], $users['lead0']];

        $cats = collect([['강남·서초 권역', '#2E90FA'], ['분당·판교 권역', '#9460E0'], ['마취 모니터링 관심', '#D16A06']])
            ->map(fn ($c, $i) => Category::firstOrCreate(['name' => $c[0]], ['color' => $c[1], 'sort' => $i + 1]));

        $stages = Stage::ordered()->values();
        $main = $stages->where('kind', 'main')->values();
        $areas = [
            ['서울', '강남구', '테헤란로', 37.5006, 127.0364], ['서울', '서초구', '서초대로', 37.4919, 127.0071], ['서울', '송파구', '올림픽로', 37.5133, 127.1001],
            ['서울', '마포구', '양화로', 37.5557, 126.9195], ['서울', '성동구', '왕십리로', 37.5446, 127.0443], ['경기', '성남시 분당구', '판교역로', 37.3947, 127.1112],
            ['경기', '수원시 영통구', '광교중앙로', 37.2886, 127.0496], ['경기', '고양시 일산동구', '중앙로', 37.6586, 126.7727],
        ];
        $names = ['온누리', '한빛', '푸른숲', '다온', '바른', '하늘', '새봄', '라온', '늘품', '여울', '해솔', '나래', '포근', '든든', '별빛', '아름', '솔빛', '다정', '함께', '청아', '지음', '보람', '소망', '큰숲', '은하', '미소', '정다운', '사랑', '튼튼', '행복'];
        $suffix = ['동물병원', '동물의료센터', '24시 동물메디컬센터'];
        $purposes = config('crm.activity_purposes');
        $sources = config('crm.lead_sources');

        for ($i = 0; $i < 40; $i++) {
            $a = $areas[$i % count($areas)];
            $si = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8][mt_rand(0, 13)];
            $stage = $stages[$si];
            $owner = $reps[$i % 3];
            $created = now()->subDays(mt_rand(20, 120));
            $h = Hospital::create([
                'name' => $names[$i % 30].' '.$suffix[$i % 3].($i >= 30 ? ' '.($i - 29).'호점' : ''),
                'zip' => (string) mt_rand(10000, 19999), 'address' => "{$a[0]} {$a[1]} {$a[2]} ".mt_rand(10, 400),
                'address_detail' => mt_rand(1, 4).'층', 'sido' => $a[0], 'sigungu' => $a[1],
                'lat' => $a[3] + mt_rand(-150, 150) / 10000, 'lng' => $a[4] + mt_rand(-150, 150) / 10000,
                'grade' => ['1차', '1.5차', '2차'][mt_rand(0, 2)], 'specialty' => ['일반진료', '내과', '외과', '영상의학'][mt_rand(0, 3)],
                'phone' => ($a[0] === '서울' ? '02-' : '031-').mt_rand(500, 799).'-'.mt_rand(1000, 9999),
                'director' => ['김', '이', '박', '최', '정'][mt_rand(0, 4)].['민준', '서연', '도윤', '하은', '지호'][mt_rand(0, 4)],
                'owner_id' => $owner->id, 'stage_id' => $stages[0]->id, 'created_by' => $owner->id,
                'pre_type' => ['call', 'visit', 'send'][mt_rand(0, 2)], 'sources' => [],
                'created_at' => $created, 'updated_at' => $created,
            ]);
            HospitalService::nextCode($h);
            $h->categories()->sync(mt_rand(0, 2) ? [$cats[$i % 3]->id] : []);

            if ($si === 0) {
                continue;
            }
            $h->sources = array_values(array_unique([$sources[mt_rand(0, 6)], $sources[mt_rand(0, 6)]]));
            // 단계에 맞는 활동 기록
            $d = $created->copy()->addDays(3);
            $acts = [['전화', '첫 소개']];
            $targetIdx = $si < count($main) ? $si : 3;
            if ($targetIdx >= 2 || $si >= count($main)) {
                $acts[] = ['방문', '제품 소개·시연'];
            }
            if ($targetIdx >= 3) {
                $acts[] = ['방문', '가입 상담'];
            }
            foreach ($acts as [$type, $purpose]) {
                $d = $d->copy()->addDays(mt_rand(4, 12));
                if ($d->isFuture()) {
                    $d = now()->subDay();
                }
                Activity::create(['hospital_id' => $h->id, 'author_id' => $owner->id, 'type' => $type, 'date' => $d->toDateString(),
                    'purpose' => $purpose, 'contact' => '원장', 'reaction' => ['긍정', '보통', '긍정', '부재'][mt_rand(0, 3)], 'note' => '예시 기록']);
            }
            if ($targetIdx >= 4) {
                $h->signup_date = now()->subDays(mt_rand(3, 15))->toDateString();
            }
            if ($targetIdx >= 5) {
                $h->usage_count = mt_rand(3, 80);
                $h->last_used_date = now()->subDays(mt_rand(0, 6))->toDateString();
            }
            $h->stage_id = $stage->id;
            if (HospitalService::canEvalStage($h)) {
                $h->fill(['eval_adoption' => mt_rand(1, 5), 'eval_favor' => mt_rand(1, 5), 'eval_surgeries' => mt_rand(0, 5), 'eval_date' => now()->subDays(mt_rand(1, 20))->toDateString()]);
            }
            if ($si <= 6 && mt_rand(0, 3)) {
                $h->next_date = now()->addDays(mt_rand(-5, 10))->toDateString();
                $h->next_todo = ['2차 방문 일정 확정', '시연 계정 발급 안내', '견적서 전달', '사용 교육 일정 조율'][mt_rand(0, 3)];
            }
            $h->save();
            StageHistory::create(['hospital_id' => $h->id, 'date' => $d->toDateString(), 'from_stage' => $stages[0]->name, 'to_stage' => $stage->name, 'changed_by' => $owner->id, 'auto' => false]);
        }
    }
}
