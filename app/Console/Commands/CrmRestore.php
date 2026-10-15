<?php

namespace App\Console\Commands;

use App\Support\Backup;
use Illuminate\Console\Command;

class CrmRestore extends Command
{
    protected $signature = 'crm:restore {file : 백업 파일 이름 (설정 › 백업 목록의 이름)} {--force : 확인 없이 실행}';

    protected $description = '백업 파일로 CRM 데이터 되돌리기 (되돌리기 전 지금 상태를 먼저 백업)';

    public function handle(): int
    {
        $file = basename((string) $this->argument('file'));
        if (! Backup::valid($file)) {
            $this->error('백업 파일을 찾을 수 없습니다: '.$file);
            foreach (array_slice(Backup::list(), 0, 10) as $b) {
                $this->line('  '.$b['name']);
            }

            return self::FAILURE;
        }
        if (! $this->option('force') && ! $this->confirm("지금 데이터를 모두 지우고 {$file} 내용으로 되돌립니다. 계속할까요?")) {
            return self::FAILURE;
        }
        $safe = Backup::create('prerestore');
        $this->info('되돌리기 전 지금 상태 백업: '.$safe['name']);
        $counts = Backup::restore($file);
        $this->info('되돌리기 완료: '.collect($counts)->map(fn ($n, $t) => "$t $n")->join(', '));

        return self::SUCCESS;
    }
}
