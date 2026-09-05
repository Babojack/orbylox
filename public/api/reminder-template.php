<?php
/**
 * Texte und HTML für die automatischen Erinnerungen.
 *
 * Gleicher Aufbau wie invite-template.php: schmale Tabelle, Systemschrift,
 * keine externen Bilder. E-Mail-Programme kennen kein modernes CSS —
 * deshalb Tabellen und Attribute statt Flexbox.
 *
 * Die Auswahl der drei Kontakte steht ebenfalls hier, damit Server und
 * Browser dieselbe Reihenfolge liefern: die Mail am Morgen soll dieselben
 * Namen zeigen wie die Seite.
 */

declare(strict_types=1);

const RM_ORANGE = '#ef5a24';
const RM_INK = '#0a0a0a';

function rmEsc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Gemeinsamer Rahmen um jede Erinnerungsmail. */
function rmLayout(string $title, string $intro, string $body, string $ctaText, string $ctaUrl): string
{
    $t = rmEsc($title);
    $i = rmEsc($intro);
    $c = rmEsc($ctaText);
    $u = rmEsc($ctaUrl);
    $orange = RM_ORANGE;
    $ink = RM_INK;

    return <<<HTML
<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$t}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border:2px solid {$ink};">
    <tr><td style="padding:20px 24px;border-bottom:2px solid {$ink};">
      <span style="display:inline-block;width:22px;height:22px;background:{$orange};border-radius:7px;vertical-align:middle;"></span>
      <span style="font:800 15px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;letter-spacing:.08em;color:{$ink};vertical-align:middle;margin-left:8px;">RBYLOX</span>
    </td></tr>
    <tr><td style="padding:28px 24px 8px;">
      <h1 style="margin:0 0 8px;font:800 22px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:{$ink};">{$t}</h1>
      <p style="margin:0 0 20px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#475569;">{$i}</p>
    </td></tr>
    <tr><td style="padding:0 24px;">{$body}</td></tr>
    <tr><td style="padding:24px;">
      <a href="{$u}" style="display:inline-block;background:{$orange};color:#ffffff;text-decoration:none;padding:13px 22px;font:700 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">{$c}</a>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:2px solid {$ink};font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#94a3b8;">
      Diese Nachricht kommt von ORBYLOX. Erinnerungen lassen sich in den Einstellungen abschalten.
    </td></tr>
  </table>
</td></tr></table>
</body></html>
HTML;
}

/* ------------------------------------------------------------- Deadlines */

function deadlineSubject(string $lang, array $items): string
{
    $overdue = 0;
    foreach ($items as $i) if ((int)$i['daysLeft'] < 0) $overdue++;
    $n = count($items);
    if ($overdue > 0) {
        return $lang === 'en'
            ? "$overdue overdue, $n tasks need your attention"
            : "$overdue überfällig — $n Aufgaben brauchen dich";
    }
    return $lang === 'en' ? "$n tasks due soon" : "$n Aufgaben werden fällig";
}

/** „heute“, „morgen“, „in 3 Tagen“, „seit 2 Tagen überfällig“ */
function deadlineWhen(string $lang, int $daysLeft): string
{
    if ($lang === 'en') {
        if ($daysLeft < -1) return abs($daysLeft) . ' days overdue';
        if ($daysLeft === -1) return '1 day overdue';
        if ($daysLeft === 0) return 'due today';
        if ($daysLeft === 1) return 'due tomorrow';
        return "due in $daysLeft days";
    }
    if ($daysLeft < -1) return 'seit ' . abs($daysLeft) . ' Tagen überfällig';
    if ($daysLeft === -1) return 'seit gestern überfällig';
    if ($daysLeft === 0) return 'heute fällig';
    if ($daysLeft === 1) return 'morgen fällig';
    return "in $daysLeft Tagen fällig";
}

function deadlineHtml(string $lang, array $items, string $appUrl): string
{
    $rows = '';
    foreach ($items as $it) {
        $late = (int)$it['daysLeft'] < 0;
        $colour = $late ? RM_ORANGE : '#475569';
        $title = rmEsc((string)$it['title']);
        $when = rmEsc(deadlineWhen($lang, (int)$it['daysLeft']));
        $rows .= '<tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">'
            . '<div style="font:700 15px/1.4 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:' . RM_INK . ';">' . $title . '</div>'
            . '<div style="font:600 13px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:' . $colour . ';margin-top:2px;">' . $when . '</div>'
            . '</td></tr>';
    }
    $body = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table>';

    return rmLayout(
        $lang === 'en' ? 'Deadlines coming up' : 'Deadlines rücken näher',
        $lang === 'en'
            ? 'These tasks are assigned to you and are due soon or already overdue.'
            : 'Diese Aufgaben sind dir zugewiesen und werden bald fällig oder sind es schon.',
        $body,
        $lang === 'en' ? 'Open board' : 'Zum Board',
        $appUrl . '/ProjectsList'
    );
}

function deadlineText(string $lang, array $items, string $appUrl): string
{
    $lines = [$lang === 'en' ? 'Deadlines coming up:' : 'Deadlines rücken näher:', ''];
    foreach ($items as $it) {
        $lines[] = '- ' . $it['title'] . ' (' . deadlineWhen($lang, (int)$it['daysLeft']) . ')';
    }
    $lines[] = '';
    $lines[] = $appUrl . '/ProjectsList';
    return implode("\n", $lines);
}

/* ---------------------------------------------------------- Kontaktpflege */

/**
 * Dieselbe Auswahl wie im Browser (src/lib/contactSuggestions.js).
 *
 * Bewusst nachgebaut statt geteilt: PHP und JavaScript können sich keinen
 * Code teilen. Damit beide Seiten dieselben Namen zeigen, müssen Formel und
 * Streuwert identisch sein — deshalb hier dieselbe FNV-1a-Variante und
 * derselbe Tagesstempel.
 */
function rmHash(string $str, int $seed): float
{
    $h = (2166136261 ^ $seed) & 0xFFFFFFFF;
    $len = strlen($str);
    for ($i = 0; $i < $len; $i++) {
        $h ^= ord($str[$i]);
        // 32-Bit-Multiplikation wie Math.imul in JavaScript
        $h = ($h * 16777619) & 0xFFFFFFFF;
    }
    return $h / 4294967296;
}

/**
 * Tagesstempel — bewusst in derselben Zeitzone wie der Nutzer.
 * Nimmt man UTC, hat die Mail zwischen Mitternacht und 2 Uhr einen anderen
 * Tag als die Seite im Browser und zeigt andere Namen.
 */
function rmDaySeed(?int $ts = null): int
{
    $tz = new DateTimeZone('Europe/Berlin');
    $d = new DateTimeImmutable('@' . ($ts ?? time()));
    return (int)$d->setTimezone($tz)->format('Ymd');
}

function rmOverdueDays(array $c, int $now): int
{
    $interval = (int)($c['interval_days'] ?? 0);
    $last = (string)($c['last_contacted_at'] ?? '');
    if ($last === '') return 9999;                       // noch nie: sofort faellig
    $lastTs = strtotime($last);
    if ($lastTs === false) return 9999;
    $due = $interval <= 0 ? $lastTs + 365 * 86400 : $lastTs + $interval * 86400;
    return (int)floor(($now - $due) / 86400);
}

function pickContactSuggestions(array $contacts, int $count = 3, ?int $now = null): array
{
    $now = $now ?? time();
    $seed = rmDaySeed($now);
    $scored = [];

    foreach ($contacts as $c) {
        if (!empty($c['paused'])) continue;
        $over = rmOverdueDays($c, $now);
        $urgency = max(-30, min(120, $over));
        $never = empty($c['last_contacted_at']) ? 40 : 0;
        $jitter = rmHash((string)($c['id'] ?? $c['name'] ?? ''), $seed) * 25;
        $scored[] = ['c' => $c, 's' => $urgency + $never + $jitter];
    }
    usort($scored, function ($a, $b) {
        return $b['s'] <=> $a['s'] ?: strcmp((string)($a['c']['id'] ?? ''), (string)($b['c']['id'] ?? ''));
    });
    return array_map(fn ($x) => $x['c'], array_slice($scored, 0, $count));
}

function contactsSubject(string $lang, array $picked): string
{
    $names = array_map(fn ($c) => (string)($c['name'] ?? ''), $picked);
    $names = array_values(array_filter($names));
    $first = $names[0] ?? '';
    if ($lang === 'en') return count($names) . ' people to get in touch with — ' . $first . ' …';
    return count($names) . ' Kontakte für heute — ' . $first . ' …';
}

function contactsHtml(string $lang, array $picked, string $appUrl): string
{
    $rows = '';
    foreach ($picked as $c) {
        $name = rmEsc((string)($c['name'] ?? ''));
        $sub = array_filter([
            (string)($c['company'] ?? ''),
            (string)($c['email'] ?? ''),
            (string)($c['phone'] ?? ''),
        ]);
        $count = (int)($c['contact_count'] ?? 0);
        $meta = $count > 0
            ? ($lang === 'en' ? "reached out {$count}×" : "{$count}× kontaktiert")
            : ($lang === 'en' ? 'never contacted' : 'noch nie kontaktiert');

        $rows .= '<tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">'
            . '<div style="font:700 15px/1.4 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:' . RM_INK . ';">' . $name . '</div>'
            . ($sub ? '<div style="font:400 13px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:#64748b;">' . rmEsc(implode(' · ', $sub)) . '</div>' : '')
            . '<div style="font:600 12px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:' . RM_ORANGE . ';margin-top:2px;">' . rmEsc($meta) . '</div>'
            . '</td></tr>';
    }
    $body = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table>';

    return rmLayout(
        $lang === 'en' ? 'Three people worth a message' : 'Drei Menschen für heute',
        $lang === 'en'
            ? 'Beziehungen leben von Regelmäßigkeit. Tick them off in ORBYLOX once you have written.'
            : 'Beziehungen leben von Regelmäßigkeit. Hake sie in ORBYLOX ab, sobald du geschrieben hast.',
        $body,
        $lang === 'en' ? 'Open contacts' : 'Zu den Kontakten',
        $appUrl . '/Contacts'
    );
}

function contactsText(string $lang, array $picked, string $appUrl): string
{
    $lines = [$lang === 'en' ? 'Three people worth a message:' : 'Drei Menschen für heute:', ''];
    foreach ($picked as $c) {
        $extra = array_filter([(string)($c['company'] ?? ''), (string)($c['email'] ?? '')]);
        $lines[] = '- ' . (string)($c['name'] ?? '') . ($extra ? ' (' . implode(', ', $extra) . ')' : '');
    }
    $lines[] = '';
    $lines[] = $appUrl . '/Contacts';
    return implode("\n", $lines);
}
