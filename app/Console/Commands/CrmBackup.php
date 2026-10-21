<?php

namespace App\Console\Commands;

use App\Support\AccessLog;
use App\Support\Backup;
use Illuminate\Console\Command;

class CrmBackup extends Command
{
    protected $signature = 'crm:backup';

    protected $description = 'CRM 데이터 백업 (storage/app/backups, 7일 보관)';

    public function handle(): int
    {
        $b = Backup::create('auto');
        AccessLog::prune();
        $this->info("백업 완료: {$b['name']} (".round($b['size'] / 1024).' KB) · 병원 '.($b['counts']['hospitals'] ?? 0).'곳');

        return self::SUCCESS;
    }
}
