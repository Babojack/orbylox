<?php
/**
 * Automatische Erinnerungen per E-Mail — für den Cron-Job.
 *
 * Zwei Dinge auf einmal, weil beide dieselbe Maschinerie brauchen:
 *   1. Deadline-Erinnerungen: Aufgaben, die in den nächsten Tagen fällig
 *      werden oder es schon sind, an die zuständige Person.
 *   2. Kontaktpflege: drei Vorschläge an alle, die das eingeschaltet haben.
 *
 * Aufruf (Cron):
 *   php /home/…/public_html/api/reminders.php
 * oder über das Netz:
 *   curl "https://orbylox.de/api/reminders.php?token=DEIN_TOKEN"
 *
 * Der Token steht in invite-config.php bzw. blog-config.php als
 * 'cron_token'. Ohne ihn antwortet der Endpunkt mit 403 — sonst könnte jeder
 * beliebig oft Mails auslösen.
 *
 * Doppelversand: jede verschickte Mail wird mit einem Schlüssel aus Empfänger,
 * Anlass und Tag vermerkt. Läuft der Cron aus Versehen stündlich, geht die
 * Mail trotzdem nur einmal am Tag raus.
 */

declare(strict_types=1);

$isCli = (PHP_SAPI === 'cli');
if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
}
ini_set('display_errors', '0');
set_time_limit(300);

require_once __DIR__ . '/blog-store.php';        // blogDataDir()
require_once __DIR__ . '/firestore-rest.php';
require_once __DIR__ . '/smtp-mailer.php';
require_once __DIR__ . '/reminder-template.php';

/* ---------------------------------------------------------- Konfiguration */

$config = [];
foreach ([__DIR__ . '/invite-config.php', __DIR__ . '/blog-config.php'] as $f) {
    if (is_file($f)) {
        $c = require $f;
        if (is_array($c)) $config = array_merge($config, $c);
    }
}

$projectId = (string)($config['firebase_project_id'] ?? '');
$cronToken = (string)($config['cron_token'] ?? '');
$appUrl    = rtrim((string)($config['app_url'] ?? 'https://orbylox.de'), '/');
$dryRun    = false;

function out(array $data, int $code = 200): void
{
    global $isCli;
    if (!$isCli) http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    exit($code === 200 ? 0 : 1);
}

if ($isCli) {
    // Aufrufparameter: --dry-run zeigt nur an, was passieren würde.
    foreach ($argv ?? [] as $arg) {
        if ($arg === '--dry-run') $dryRun = true;
    }
} else {
    if ($cronToken === '') out(['error' => "cron_token fehlt in invite-config.php."], 500);
    $given = (string)($_GET['token'] ?? '');
    // hash_equals: vergleicht in konstanter Zeit, sonst liesse sich der Token erraten
    if (!hash_equals($cronToken, $given)) out(['error' => 'Kein Zugriff.'], 403);
    $dryRun = isset($_GET['dry']) && $_GET['dry'] !== '0';
}

if ($projectId === '') out(['error' => 'firebase_project_id fehlt.'], 500);

/* -------------------------------------------------------- Versandprotokoll */

function sentLogPath(): string { return blogDataDir() . '/reminders-sent.json'; }

function loadSentLog(): array
{
    $p = sentLogPath();
    if (!is_file($p)) return [];
    $d = json_decode((string)@file_get_contents($p), true);
    return is_array($d) ? $d : [];
}

/** Nur die letzten 30 Tage behalten — sonst wächst die Datei ewig. */
function saveSentLog(array $log): void
{
    $cutoff = gmdate('Y-m-d', time() - 30 * 86400);
    $log = array_filter($log, fn ($day) => $day >= $cutoff);
    $p = sentLogPath();
    @file_put_contents($p . '.tmp', json_encode($log, JSON_UNESCAPED_UNICODE));
    @rename($p . '.tmp', $p);
}

/* ------------------------------------------------------------------ Mail */

function smtpOptions(array $config): array
{
    return [
        'host'       => (string)($config['smtp_host'] ?? ''),
        'port'       => (int)($config['smtp_port'] ?? 465),
        'user'       => (string)($config['smtp_user'] ?? ''),
        'pass'       => (string)($config['smtp_pass'] ?? ''),
        'from_email' => (string)($config['from_email'] ?? ($config['smtp_user'] ?? '')),
        'from_name'  => (string)($config['from_name'] ?? 'ORBYLOX'),
        'reply_to'   => (string)($config['reply_to'] ?? ($config['from_email'] ?? '')),
    ];
}

/* --------------------------------------------------------------- Ablauf */

$today = gmdate('Y-m-d');
$log = loadSentLog();
$smtp = smtpOptions($config);
$report = ['date' => $today, 'dry_run' => $dryRun, 'deadlines' => 0, 'contacts' => 0, 'skipped' => 0, 'errors' => []];

/**
 * Verschicken, aber nur einmal je Schlüssel und Tag.
 */
function sendOnce(string $key, array $mail, array $smtp, array &$log, string $today, bool $dryRun, array &$report): void
{
    $hash = substr(sha1($key), 0, 24);
    if (($log[$hash] ?? '') === $today) { $report['skipped']++; return; }
    if ($dryRun) { $report['skipped']++; return; }
    try {
        sendSmtpMail($smtp + $mail);
        $log[$hash] = $today;
    } catch (Throwable $e) {
        $report['errors'][] = substr($e->getMessage(), 0, 200);
    }
}

/* --- 1. Deadline-Erinnerungen ------------------------------------------ */

try {
    // Alles, was nicht erledigt ist. Firestore kann Datumsgrenzen auf
    // Zeichenketten nur eingeschraenkt filtern, deshalb wird hier grob
    // geholt und in PHP genau geprueft.
    $tasks = fsQuery($projectId, 'Task', [['status', 'NOT_EQUAL', 'done']], 1000);

    $byPerson = [];
    foreach ($tasks as $t) {
        $due = (string)($t['due_date'] ?? $t['deadline'] ?? '');
        if ($due === '') continue;
        $ts = strtotime($due);
        if ($ts === false) continue;

        $daysLeft = (int)floor(($ts - time()) / 86400);
        // Erinnert wird 3 Tage vorher, am Tag selbst und wenn überfällig.
        if ($daysLeft > 3) continue;

        $to = strtolower(trim((string)($t['assignee_email'] ?? '')));
        if ($to === '' || !str_contains($to, '@')) continue;

        $byPerson[$to][] = [
            'title'     => (string)($t['title'] ?? ''),
            'due'       => $due,
            'daysLeft'  => $daysLeft,
            'priority'  => (string)($t['priority'] ?? ''),
            'projectId' => (string)($t['project_id'] ?? ''),
        ];
    }

    foreach ($byPerson as $to => $items) {
        usort($items, fn ($a, $b) => $a['daysLeft'] <=> $b['daysLeft']);
        $mail = [
            'to'      => $to,
            'subject' => deadlineSubject('de', $items),
            'html'    => deadlineHtml('de', $items, $appUrl),
            'text'    => deadlineText('de', $items, $appUrl),
        ];
        sendOnce('deadline|' . $to, $mail, $smtp, $log, $today, $dryRun, $report);
        $report['deadlines']++;
    }
} catch (Throwable $e) {
    $report['errors'][] = 'Deadlines: ' . substr($e->getMessage(), 0, 300);
}

/* --- 2. Kontaktpflege --------------------------------------------------- */

try {
    // Wer hat die Kontaktpflege eingeschaltet?
    $prefs = fsQuery($projectId, 'UserProjectListPrefs', [], 1000);

    foreach ($prefs as $p) {
        $care = $p['contact_care'] ?? null;
        if (!is_array($care) || empty($care['enabled'])) continue;

        $uid = (string)($p['userId'] ?? $p['id'] ?? '');
        $to = strtolower(trim((string)($care['email'] ?? $p['email'] ?? '')));
        if ($to === '' || !str_contains($to, '@')) continue;

        $contacts = fsQuery($projectId, 'Contact', [['userId', 'EQUAL', $uid]], 1000);
        if (!$contacts) continue;

        $picked = pickContactSuggestions($contacts, 3);
        if (!$picked) continue;

        $mail = [
            'to'      => $to,
            'subject' => contactsSubject('de', $picked),
            'html'    => contactsHtml('de', $picked, $appUrl),
            'text'    => contactsText('de', $picked, $appUrl),
        ];
        sendOnce('contacts|' . $to, $mail, $smtp, $log, $today, $dryRun, $report);
        $report['contacts']++;
    }
} catch (Throwable $e) {
    $report['errors'][] = 'Kontakte: ' . substr($e->getMessage(), 0, 300);
}

if (!$dryRun) saveSentLog($log);

out($report);
