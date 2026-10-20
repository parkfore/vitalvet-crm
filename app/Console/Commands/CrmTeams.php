<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Perm;
use Illuminate\Console\Command;

/** 소속(팀)·역할별 자료 범위 점검: 사람마다 같은 팀으로 보이는 직원 목록 (데이터는 바꾸지 않는다) */
class CrmTeams extends Command
{
    protected $signature = 'crm:teams';

    protected $description = '소속·자료 범위 점검';

    public function handle(): int
    {
        Perm::forget();
        $users = User::all();
        foreach ($users as $u) {
            $team = (string) ($u->data['team'] ?? '');
            $sees = $users->filter(fn ($o) => $o->id !== $u->id && Perm::sameTeam($u, $o->id))->map(fn ($o) => $o->name())->implode(',');
            $this->line(sprintf('%s | %s | %s | role=%s scope=%s people=%s | team="%s" hex=%s | sees: %s',
                $u->id, $u->username, $u->status, $u->role_id ?? '-', Perm::role($u)['scope'] ?? '-', Perm::role($u)['people'] ?? '(없음)', $team, bin2hex($team), $sees ?: '-'));
        }

        return self::SUCCESS;
    }
}
