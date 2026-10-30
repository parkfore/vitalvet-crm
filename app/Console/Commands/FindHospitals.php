<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Store;
use Illuminate\Console\Command;

/**
 * 읽기 전용: 병원명(+원장명) 목록으로 CRM 병원 후보를 찾아 한 줄씩 JSON 으로 보여 준다. 데이터는 바꾸지 않는다.
 * 사용: php artisan crm:find-hospitals --b64=<base64 JSON [{"k":"행번호","n":"병원명","d":"원장명","p":"연락처"}]>
 */
class FindHospitals extends Command
{
    protected $signature = 'crm:find-hospitals {--b64= : 찾을 목록 (base64 JSON)}';

    protected $description = '병원명·원장명으로 CRM 병원 후보 찾기 (읽기 전용)';

    private static function norm(string $s): string
    {
        return mb_strtolower(preg_replace('/[\s()\[\]·.,\-_]/u', '', $s));
    }

    private static function core(string $s): string
    {
        return preg_replace('/(24시|동물병원|동물의료센터|동물메디컬센터|동물종합병원|동물암센터|동물병원의원|종합|메디컬센터|의료센터|센터|병원)/u', '', self::norm($s));
    }

    public function handle(): int
    {
        $q = json_decode((string) base64_decode((string) $this->option('b64')), true);
        if (! is_array($q)) {
            $this->error('목록을 읽지 못했습니다');

            return self::FAILURE;
        }
        $names = User::all()->mapWithKeys(fn ($u) => [$u->id => $u->name()]);
        $H = array_values(array_filter(Store::all('hospitals'), fn ($h) => empty($h['deletedAt'])));
        $this->line('TOTAL '.count($H));
        foreach ($q as $row) {
            $n = self::norm((string) ($row['n'] ?? ''));
            $c = self::core((string) ($row['n'] ?? ''));
            $d = self::norm((string) ($row['d'] ?? ''));
            $p = preg_replace('/\D/', '', (string) ($row['p'] ?? ''));
            $cands = [];
            foreach ($H as $h) {
                $hn = self::norm((string) ($h['name'] ?? ''));
                $hc = self::core((string) ($h['name'] ?? ''));
                $hp = preg_replace('/\D/', '', (string) ($h['directorPhone'] ?? ''));
                $why = [];
                if ($hn === $n) {
                    $why[] = 'name';
                } elseif ($c !== '' && mb_strlen($c) >= 2 && ($hc === $c || str_contains($hn, $c))) {
                    $why[] = 'core';
                }
                if ($p !== '' && $hp === $p) {
                    $why[] = 'phone';
                }
                if (! $why) {
                    continue;
                }
                if ($d !== '' && self::norm((string) ($h['director'] ?? '')) !== '' && str_contains(self::norm((string) ($h['director'] ?? '')), $d)) {
                    $why[] = 'dir';
                }
                $cands[] = ['id' => $h['id'], 'nm' => $h['name'] ?? '', 'ad' => mb_substr(trim(($h['address'] ?? '').' '.($h['addressDetail'] ?? '')), 0, 60), 'jb' => mb_substr((string) ($h['jibun'] ?? ''), 0, 40),
                    'dr' => $h['director'] ?? '', 'dp' => $h['directorPhone'] ?? '', 'ph' => $h['phone'] ?? '', 'ow' => $names[$h['ownerId'] ?? ''] ?? '', 'st' => $h['stage'] ?? '',
                    'sd' => $h['signupDate'] ?? '', 'w' => implode('+', $why)];
            }
            usort($cands, fn ($a, $b) => strlen($b['w']) <=> strlen($a['w']));
            $this->line('R '.json_encode(['k' => $row['k'] ?? '', 'c' => array_slice($cands, 0, 5), 'more' => max(0, count($cands) - 5)], JSON_UNESCAPED_UNICODE));
        }

        return self::SUCCESS;
    }
}
