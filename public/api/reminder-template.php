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

/**
 * Der Zuschlag einer gesetzten Frist — dieselben Zahlen wie im Browser
 * (fristBonus in src/lib/contactSuggestions.js). Groesser als alles andere
 * zusammen: Eine Frist ist eine Zusage mit Datum, kein Vorschlag.
 */
function rmFristBonus(array $c, ?int $now = null): int
{
    $tage = rmFristTage((string)($c['deadline_at'] ?? ''), $now);
    if ($tage === null) return 0;
    if ($tage <= 0) return 500;
    if ($tage <= RM_FRIST_VORWARNUNG) return 250;
    return 0;
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
        // Dieselben Zuschlaege wie fristBonus() im Browser. Ohne sie zeigte
        // die Morgenmail andere drei Namen als die Seite am selben Tag —
        // und der Kontakt mit Frist stuende ausgerechnet dort nicht drin.
        $scored[] = ['c' => $c, 's' => $urgency + $never + $jitter + rmFristBonus($c, $now)];
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
            ? 'Relationships live on regularity. Tick them off in ORBYLOX once you have written.'
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

/* ---------------------------------------------------------------- Fristen */

/**
 * Vorwarnung in Tagen — dieselbe Zahl wie VORWARNUNG_TAGE in
 * src/lib/contactSuggestions.js. Steht sie hier anders, verspricht die Seite
 * etwas anderes, als der Versand tut.
 */
const RM_FRIST_VORWARNUNG = 3;

/**
 * Tage bis zur Frist. Negativ heisst: der Tag ist vorbei.
 *
 * Gerechnet wird in KALENDERTAGEN in Europe/Berlin, nicht in 86400-Sekunden-
 * Schritten ab jetzt. Sonst waere eine Frist um 23:30 noch "morgen" und um
 * 00:30 schon "heute" — je nachdem, wann der Cron laeuft.
 */
function rmFristTage(string $tag, ?int $now = null): ?int
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tag)) return null;
    $tz = new DateTimeZone('Europe/Berlin');
    $ziel = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $tag . ' 00:00:00', $tz);
    if (!$ziel) return null;
    $heute = (new DateTimeImmutable('@' . ($now ?? time())))->setTimezone($tz)->setTime(0, 0, 0);
    return (int)$ziel->diff($heute)->days * ($ziel < $heute ? -1 : 1);
}

/**
 * Wer heute in die Fristen-Mail gehoert.
 *
 * Drei Anlaesse: die Vorwarnung (genau drei Tage vorher), der Fristtag
 * selbst, und jeder Tag danach, solange nicht abgehakt wurde. Der letzte
 * Punkt ist Absicht: Eine verstrichene Frist, die verstummt, ist schlimmer
 * als gar keine. Wer sie loswerden will, hakt ab — dann setzt der Takt die
 * naechste, oder sie faellt weg.
 *
 * Pausierte Kontakte bleiben aussen vor. Wer jemanden ausdruecklich stumm
 * gestellt hat, will auch keine Frist-Mail ueber ihn.
 */
function pickDeadlineContacts(array $contacts, ?int $now = null): array
{
    $raus = [];
    foreach ($contacts as $c) {
        if (!empty($c['paused'])) continue;
        $tage = rmFristTage((string)($c['deadline_at'] ?? ''), $now);
        if ($tage === null) continue;
        if ($tage > RM_FRIST_VORWARNUNG) continue;                 // noch zu frueh
        if ($tage > 0 && $tage !== RM_FRIST_VORWARNUNG) continue;  // dazwischen: still
        $c['_tage'] = $tage;
        $raus[] = $c;
    }
    // Das Dringendste zuerst: abgelaufen vor heute vor Vorwarnung.
    usort($raus, fn ($a, $b) => $a['_tage'] <=> $b['_tage']);
    return $raus;
}

function fristWhen(string $lang, int $tage): string
{
    if ($lang === 'en') {
        if ($tage < -1) return 'deadline passed ' . abs($tage) . ' days ago';
        if ($tage === -1) return 'deadline passed yesterday';
        if ($tage === 0) return 'deadline is today';
        if ($tage === 1) return 'deadline tomorrow';
        return "deadline in $tage days";
    }
    if ($tage < -1) return 'Frist seit ' . abs($tage) . ' Tagen abgelaufen';
    if ($tage === -1) return 'Frist seit gestern abgelaufen';
    if ($tage === 0) return 'Frist läuft heute ab';
    if ($tage === 1) return 'Frist morgen';
    return "Frist in $tage Tagen";
}

/**
 * Der Betreff sagt, was zu tun ist — und wessen Name dranhängt.
 *
 * Ein Name im Betreff ist mehr wert als eine Zahl: "Frist läuft ab: Anna
 * Bauer" erkennt man in der Vorschau, "3 Erinnerungen" nicht. Einzahl und
 * Mehrzahl werden ausgeschrieben; "Frist(en)" liest sich wie ein Formular.
 */
function fristSubject(string $lang, array $items): string
{
    $spaet = 0;
    foreach ($items as $i) if ((int)$i['_tage'] <= 0) $spaet++;
    $n = count($items);
    $erste = (string)($items[0]['name'] ?? '');

    if ($spaet > 0) {
        if ($lang === 'en') {
            return $spaet === 1 && $n === 1
                ? "Deadline is up: $erste"
                : "$spaet deadline" . ($spaet === 1 ? '' : 's') . " up — starting with $erste";
        }
        return $spaet === 1 && $n === 1
            ? "Frist läuft ab: $erste"
            : "$spaet Frist" . ($spaet === 1 ? '' : 'en') . " laufen ab — angefangen bei $erste";
    }

    if ($lang === 'en') {
        return $n === 1 ? "Deadline coming up: $erste" : "$n deadlines coming up — $erste …";
    }
    return $n === 1 ? "Frist rückt näher: $erste" : "$n Fristen rücken näher — $erste …";
}


function fristHtml(string $lang, array $items, string $appUrl): string
{
    $rows = '';
    foreach ($items as $c) {
        $tage = (int)$c['_tage'];
        $farbe = $tage <= 0 ? RM_ORANGE : '#b45309';
        $name = rmEsc((string)($c['name'] ?? ''));
        $sub = array_filter([
            (string)($c['company'] ?? ''),
            (string)($c['email'] ?? ''),
            (string)($c['phone'] ?? ''),
        ]);
        $grund = trim((string)($c['deadline_note'] ?? ''));
        $rows .= '<tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">'
            . '<div style="font:700 15px/1.4 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:' . RM_INK . ';">' . $name . '</div>'
            . ($sub ? '<div style="font:400 13px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:#64748b;">' . rmEsc(implode(' · ', $sub)) . '</div>' : '')
            . ($grund !== '' ? '<div style="font:400 13px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:#334155;margin-top:2px;">' . rmEsc($grund) . '</div>' : '')
            . '<div style="font:700 12px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:' . $farbe . ';margin-top:4px;text-transform:uppercase;letter-spacing:.04em;">' . rmEsc(fristWhen($lang, $tage)) . '</div>'
            . '</td></tr>';
    }
    $body = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table>';

    return rmLayout(
        $lang === 'en' ? 'Deadlines with people' : 'Fristen bei Menschen',
        $lang === 'en'
            ? 'You set a deadline to get in touch with these people. Tick them off in ORBYLOX once you have.'
            : 'Für diese Menschen hast du dir eine Frist gesetzt. Hake sie in ORBYLOX ab, sobald du sie erreicht hast.',
        $body,
        $lang === 'en' ? 'Open contacts' : 'Zu den Kontakten',
        $appUrl . '/Contacts'
    );
}

function fristText(string $lang, array $items, string $appUrl): string
{
    $lines = [$lang === 'en' ? 'Deadlines with people:' : 'Fristen bei Menschen:', ''];
    foreach ($items as $c) {
        $extra = array_filter([(string)($c['company'] ?? ''), (string)($c['email'] ?? '')]);
        $grund = trim((string)($c['deadline_note'] ?? ''));
        $lines[] = '- ' . (string)($c['name'] ?? '')
            . ($extra ? ' (' . implode(', ', $extra) . ')' : '')
            . ' — ' . fristWhen($lang, (int)$c['_tage'])
            . ($grund !== '' ? ' — ' . $grund : '');
    }
    $lines[] = '';
    $lines[] = $appUrl . '/Contacts';
    return implode("\n", $lines);
}
