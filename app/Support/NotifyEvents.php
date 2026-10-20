<?php

namespace App\Support;

use App\Models\User;
use Throwable;

/** 저장된 내용 → 누구에게 어떤 알림을 보낼지 (받는 사람의 설정은 Notify::emit 이 본다) */
class NotifyEvents
{
    private static function name(?string $uid): string
    {
        static $c = [];
        if (! $uid) {
            return '';
        }

        return $c[$uid] ??= (User::find($uid)?->name() ?? '');
    }

    private static function md(string $d): string
    {
        return preg_match('/^\d{4}-(\d{2})-(\d{2})$/', $d, $m) ? ((int) $m[1]).'/'.((int) $m[2]) : $d;
    }

    private static function cut(string $s, int $n = 80): string
    {
        $s = trim(preg_replace('/\s+/u', ' ', $s));

        return mb_strlen($s) > $n ? mb_substr($s, 0, $n).'…' : $s;
    }

    public static function dispatch(User $me, array $events): void
    {
        try {
            $assigned = [];
            foreach ($events as $e) {
                $kind = $e[0];
                if ($kind === 'hospital') {
                    self::hospital($me, $e[1], $e[2], $assigned);

                    continue;
                }
                $x = $e[1];
                switch ($kind) {
                    case 'report_submitted':
                        $who = self::name($x['authorId'] ?? '');
                        $mg = Notify::managersOf($x['authorId'] ?? '');
                        $url = '/report?rep='.$x['id'];
                        $visits = (int) ($x['stats']['visits'] ?? 0);
                        Notify::emit('report_submitted', $mg, "📝 {$who} 보고서 제출", self::md($x['date'] ?? '').' 보고서'.($visits ? " · 방문 {$visits}곳" : '').' · 검토해 주세요', $url, 'rep-'.$x['id'], $me->id);
                        $iss = array_values(array_filter((array) ($x['issues'] ?? []), fn ($i) => trim((string) ($i['text'] ?? '')) !== ''));
                        if ($iss) {
                            $urgent = count(array_filter($iss, fn ($i) => ($i['urgency'] ?? '') === '긴급'));
                            Notify::emit('support_request', $mg, ($urgent ? '🚨 긴급 ' : '🙋 ')."지원 요청 · {$who}", self::cut(($iss[0]['type'] ?? '').': '.($iss[0]['text'] ?? '')).(count($iss) > 1 ? ' 외 '.(count($iss) - 1).'건' : ''), $url, 'sup-'.$x['id'], $me->id);
                        }
                        $comp = array_values(array_filter((array) ($x['comp'] ?? []), fn ($c) => trim((string) ($c['name'] ?? '')) !== ''));
                        if ($comp) {
                            Notify::emit('comp_info', $mg, "🔎 경쟁사 정보 · {$who}", self::cut(($comp[0]['name'] ?? '').': '.($comp[0]['text'] ?? '')).(count($comp) > 1 ? ' 외 '.(count($comp) - 1).'건' : ''), $url, 'comp-'.$x['id'], $me->id);
                        }
                        break;
                    case 'report_returned':
                        Notify::emit('report_returned', [$x['authorId'] ?? ''], '↩️ 보고서 반려 · '.self::md($x['date'] ?? ''), self::cut((string) ($x['reviewComment'] ?? '')) ?: $me->name().'님이 보완을 요청했습니다', '/report?rep='.$x['id'], 'rep-'.$x['id'], $me->id);
                        break;
                    case 'report_confirmed':
                        Notify::emit('report_confirmed', [$x['authorId'] ?? ''], '✅ 보고서 확인 · '.self::md($x['date'] ?? ''), self::cut((string) ($x['reviewComment'] ?? '')) ?: $me->name().'님이 확인했습니다', '/report?rep='.$x['id'], 'rep-'.$x['id'], $me->id);
                        break;
                    case 'att_request':
                        $who = self::name($x['userId'] ?? '');
                        Notify::emit('att_request', Notify::attManagers($x['userId'] ?? ''), "🗓 {$who} ".($x['type'] ?? '근태').' 신청', self::md($x['from'] ?? '').(($x['to'] ?? '') !== ($x['from'] ?? '') ? ' ~ '.self::md($x['to'] ?? '') : '').(($x['reason'] ?? '') ? ' · '.self::cut($x['reason'], 50) : ''), '/attend', 'att-'.$x['id'], $me->id);
                        break;
                    case 'att_result':
                        $ok = ($x['status'] ?? '') === 'approved';
                        Notify::emit('att_result', [$x['userId'] ?? ''], '🗓 '.($x['type'] ?? '근태').' '.($ok ? '승인' : '반려'), self::md($x['from'] ?? '').(($x['to'] ?? '') !== ($x['from'] ?? '') ? ' ~ '.self::md($x['to'] ?? '') : '').' · '.$me->name().(($x['comment'] ?? '') ? ' · '.self::cut($x['comment'], 50) : ''), '/attend', 'att-'.$x['id'], $me->id);
                        break;
                    case 'coaching':
                        Notify::emit('coaching', [$x['userId'] ?? ''], '💬 코칭 메모 · '.$me->name(), self::cut((string) ($x['text'] ?? ''), 120), '/today?coach=1', 'coach-'.$x['id'], $me->id);
                        break;
                }
            }
            foreach ($assigned as $uid => $list) {
                self::assigned($me, $uid, $list);
            }
        } catch (Throwable $e) {
            ErrorLog::record('server', '알림 처리 실패: '.$e->getMessage(), $e->getFile().':'.$e->getLine(), 'notify-events');
        }
    }

    public static function assigned(User $me, string $uid, array $hospitals): void
    {
        $n = count($hospitals);
        $first = $hospitals[0];
        Notify::emit('assigned', [$uid], '📌 담당 병원 배정'.($n > 1 ? " {$n}곳" : ''), ($first['name'] ?? '').($n > 1 ? ' 외 '.($n - 1).'곳' : '').' · '.$me->name().'님이 배정했습니다',
            $n === 1 ? '/list?h='.$first['id'] : '/list', 'asg-'.$uid, $me->id);
    }

    private static function distTxt($d): string
    {
        return $d === null ? '' : ($d < 1000 ? number_format((int) $d).'m' : number_format($d / 1000, 1).'km');
    }

    /**
     * 방문 체크인: 위치를 넣거나(새 방문 기록·나중에 추가) 지우면(위치만 지우기·체크인한 방문 기록 삭제)
     * 관리자·팀장에게 알림 + 변경 이력에 남긴다. 위치 없이 방문을 기록하면 '방문 위치 이상' 알림.
     */
    private static function checkins(User $me, ?array $old, array $new): void
    {
        $before = [];
        foreach ((array) ($old['activities'] ?? []) as $a) {
            $before[$a['id'] ?? ''] = $a;
        }
        $after = [];
        foreach ((array) ($new['activities'] ?? []) as $a) {
            $after[$a['id'] ?? ''] = $a;
        }
        $hn = (string) ($new['name'] ?? '');
        $hid = (string) ($new['id'] ?? '');
        $log = function (string $field, string $b, string $a, string $summary) use ($me, $hid, $hn) {
            Sync::log($me, ['entity' => 'hospital', 'entityId' => $hid, 'hospitalId' => $hid, 'targetName' => $hn, 'action' => 'update', 'section' => '방문 체크인',
                'changes' => [['field' => $field, 'before' => $b, 'after' => $a]], 'summary' => $summary]);
        };
        // 위치 추가 · 위치 없이 새 방문
        foreach ($after as $id => $a) {
            if (($a['type'] ?? '') !== '방문') {
                continue;
            }
            $prev = $before[$id] ?? null;
            $g = is_array($a['geo'] ?? null) ? $a['geo'] : null;
            $pg = is_array($prev['geo'] ?? null) ? $prev['geo'] : null;
            $author = (string) ($a['authorId'] ?? $me->id);
            $who = self::name($author) ?: $me->name();
            $date = (string) ($a['date'] ?? '');
            $url = '/map?track=1&u='.$author.'&d='.$date;
            $mg = Notify::managersOf($author);
            if ($g && (! $pg || ($pg['at'] ?? '') !== ($g['at'] ?? ''))) {
                $time = self::hm($g['at'] ?? '');
                $dt = self::distTxt($g['dist'] ?? null);
                $log('현재 위치 체크인', $pg ? '현장 확인 · '.self::distTxt($pg['dist'] ?? null) : '', '현장 확인 · '.$dt.($time ? " · {$time}" : ''), self::md($date).' 방문 · '.$who);
                Notify::emit('checkin', $mg, '📍 '.$who.' · '.$hn, '현장 확인 ('.$dt.')'.($time ? " · {$time}" : ''), $url, 'ci-'.$id, $me->id);
            } elseif (! $g && $pg) {
                $log('현재 위치 체크인', '현장 확인 · '.self::distTxt($pg['dist'] ?? null).' · '.self::hm($pg['at'] ?? ''), '지움', self::md($date).' 방문 · '.$who);
                Notify::emit('checkin_issue', $mg, '🗑 '.$who.' · 체크인 위치 지움', $hn.' · '.self::md($date).' 방문 기록의 현재 위치를 지웠습니다', $url, 'ci-'.$id, $me->id);
            } elseif (! $g && $prev === null) {
                Notify::emit('checkin_issue', $mg, '⚠️ '.$who.' · 위치 없이 방문 기록', $hn.' · '.(self::hm($a['ts'] ?? '') ?: self::md($date)).' · 현재 위치로 체크인하지 않았습니다', $url, 'ci-'.$id, $me->id);
            }
        }
        // 체크인한 방문 기록 자체를 삭제
        foreach ($before as $id => $p) {
            if (isset($after[$id]) || ($p['type'] ?? '') !== '방문' || ! is_array($p['geo'] ?? null)) {
                continue;
            }
            $author = (string) ($p['authorId'] ?? $me->id);
            $who = self::name($author) ?: $me->name();
            $log('체크인한 방문 기록', self::md($p['date'] ?? '').' · 현장 확인 · '.self::distTxt($p['geo']['dist'] ?? null).' · '.self::hm($p['geo']['at'] ?? ''), '삭제', '기록한 사람 '.$who);
            Notify::emit('checkin_issue', Notify::managersOf($author), '🗑 '.$me->name().' · 체크인한 방문 기록 삭제', $hn.' · '.self::md($p['date'] ?? '').' '.self::hm($p['geo']['at'] ?? ''), '/map?track=1&u='.$author.'&d='.($p['date'] ?? ''), 'ci-'.$id, $me->id);
        }
    }

    private static function hm(string $iso): string
    {
        if ($iso === '') {
            return '';
        }
        try {
            $t = \Illuminate\Support\Carbon::parse($iso)->setTimezone(Notify::TZ);

            return ($t->hour < 12 ? '오전 ' : '오후 ').(($t->hour % 12) ?: 12).':'.$t->format('i');
        } catch (\Throwable) {
            return '';
        }
    }

    private static function hospital(User $me, ?array $old, array $new, array &$assigned): void
    {
        $owner = (string) ($new['ownerId'] ?? '');
        // 담당 배정 (본인이 자기에게 한 것은 제외)
        if ($owner !== '' && $owner !== ($old['ownerId'] ?? '') && $owner !== $me->id) {
            $assigned[$owner][] = $new;
        }
        self::checkins($me, $old, $new);
        if ($old === null) {
            return;
        }
        $mg = Notify::managersOf($owner ?: $me->id);
        $who = self::name($owner) ?: $me->name();
        $url = '/list?h='.$new['id'];
        $main = array_values(array_map(fn ($s) => $s['name'], array_filter(Store::all('stages'), fn ($s) => ($s['kind'] ?? '') === 'main')));
        $bi = array_search($old['stage'] ?? '', $main, true);
        $ai = array_search($new['stage'] ?? '', $main, true);
        if ($ai !== false && $bi !== false && $ai > $bi) {
            Notify::emit('stage_up', $mg, '📈 '.($new['name'] ?? '').' · '.$new['stage'], ($old['stage'] ?? '').' → '.$new['stage'].' · 담당 '.$who, $url, 'stg-'.$new['id'], $me->id);
        }
        if (empty($old['signupDate']) && ! empty($new['signupDate'])) {
            Notify::emit('conversion', $mg, '🎉 회원가입 · '.($new['name'] ?? ''), self::md($new['signupDate']).' 가입 · 담당 '.$who, $url, 'cv-'.$new['id'], $me->id);
        }
        if ((int) ($old['usageCount'] ?? 0) <= 0 && (int) ($new['usageCount'] ?? 0) > 0) {
            Notify::emit('conversion', $mg, '🎉 VitalVET 사용 시작 · '.($new['name'] ?? ''), '누적 '.number_format((int) $new['usageCount']).'건 · 담당 '.$who, $url, 'use-'.$new['id'], $me->id);
        }
    }
}
