<?php
/**
 * Inhalte der Seite "Über uns".
 *
 * Lesen darf jeder (die Seite ist öffentlich), schreiben nur die Redaktion —
 * geprüft über dasselbe Firebase-Token und dieselbe Admin-Liste wie beim Blog.
 *
 * Warum eine eigene kleine Datei und nicht Firestore: der Text wird selten
 * geändert und bei jedem Aufruf gebraucht. Eine JSON-Datei neben den
 * Blogartikeln ist in unter einer Millisekunde gelesen, kostet kein
 * Kontingent und braucht keine zusätzlichen Zugriffsregeln.
 *
 *   GET  /api/about.php            -> { content: {...} }
 *   POST /api/about.php            -> speichert (Authorization: Bearer <ID-Token>)
 */

declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/blog-store.php';

function aboutFilePath(): string
{
    return blogDataDir() . '/about.json';
}

/** Startinhalt, damit die Seite auch ohne gespeicherte Daten etwas zeigt. */
function aboutDefault(): array
{
    return [
        'hero_image' => '',
        'hero_alt' => '',
        'de' => [
            'headline' => 'Über uns',
            'intro' => 'ORBYLOX ist Projektmanagement, das nichts kostet und trotzdem alles kann, was kleine Teams wirklich brauchen.',
            'story' => "Wir haben ORBYLOX gebaut, weil gute Werkzeuge nicht am Preis scheitern sollten.\n\nVereine, Gründerinnen, Studierende und kleine Teams arbeiten oft mit Zetteln und Tabellen — nicht aus Überzeugung, sondern weil ordentliche Software pro Kopf und Monat abgerechnet wird. Genau diese Hürde wollten wir wegnehmen.",
            'mission_title' => 'Wofür wir stehen',
            'mission' => 'Alles an einem Ort, verständlich ohne Schulung, und kostenlos für alle.',
            'team_title' => 'Das Team',
            'team_intro' => 'Die Menschen hinter ORBYLOX.',
        ],
        'en' => [
            'headline' => 'About us',
            'intro' => 'ORBYLOX is project management that costs nothing and still does everything small teams actually need.',
            'story' => "We built ORBYLOX because good tools should not fail on price.\n\nClubs, founders, students and small teams often work with notes and spreadsheets — not by choice, but because proper software is billed per person per month. That is the barrier we wanted to remove.",
            'mission_title' => 'What we stand for',
            'mission' => 'Everything in one place, understandable without training, and free for everyone.',
            'team_title' => 'The team',
            'team_intro' => 'The people behind ORBYLOX.',
        ],
        'team' => [],
        'updated_at' => '',
    ];
}

function aboutLoad(): array
{
    $path = aboutFilePath();
    if (!is_file($path)) return aboutDefault();
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') return aboutDefault();
    $data = json_decode($raw, true);
    if (!is_array($data)) return aboutDefault();
    // Fehlende Felder auffüllen — so bricht die Seite nicht, wenn später
    // ein Feld dazukommt und die gespeicherte Datei es noch nicht kennt.
    $out = aboutDefault();
    foreach (['hero_image', 'hero_alt', 'updated_at'] as $k) {
        if (isset($data[$k]) && is_string($data[$k])) $out[$k] = $data[$k];
    }
    foreach (['de', 'en'] as $lang) {
        if (isset($data[$lang]) && is_array($data[$lang])) {
            foreach ($out[$lang] as $k => $_) {
                if (isset($data[$lang][$k]) && is_string($data[$lang][$k])) {
                    $out[$lang][$k] = $data[$lang][$k];
                }
            }
        }
    }
    if (isset($data['team']) && is_array($data['team'])) $out['team'] = array_values($data['team']);
    return $out;
}

function aboutSave(array $content): bool
{
    $path = aboutFilePath();
    $tmp = $path . '.tmp';
    $json = json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;
    $fp = @fopen($tmp, 'wb');
    if (!$fp) return false;
    if (flock($fp, LOCK_EX)) {
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return @rename($tmp, $path);
}

// ---------------------------------------------------------------- Anfrage

$allowedOrigins = ['https://orbylox.de', 'https://www.orbylox.de', 'http://localhost:5173', 'http://localhost:4173'];
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function aboutFail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    // Öffentlich lesbar. Kurz zwischenspeichern lassen — der Text ändert sich
    // selten, das spart bei vielen Aufrufen Rechenzeit.
    header('Cache-Control: public, max-age=300');
    echo json_encode(['content' => aboutLoad()], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Ab hier: schreiben, nur für Administratoren ---
header('X-Robots-Tag: noindex, nofollow');

$firebaseProjectId = blogFirebaseProjectId();
$adminEmails = blogAdminEmails();
if ($firebaseProjectId === '') {
    aboutFail(500, 'firebase_project_id fehlt in blog-config.php / invite-config.php');
}

require_once __DIR__ . '/firebase-auth.php';
$user = requireFirebaseUser($firebaseProjectId);
$email = strtolower((string)($user['email'] ?? ''));
if ($email === '' || !in_array($email, $adminEmails, true)) {
    aboutFail(403, 'Kein Administratorzugang.');
}

$raw = file_get_contents('php://input') ?: '';
$in = json_decode($raw, true);
if (!is_array($in)) aboutFail(400, 'Kein gültiges JSON.');

/** Text kürzen und von Steuerzeichen befreien. */
function aboutText($v, int $max): string
{
    if (!is_string($v)) return '';
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

/**
 * Bild-Adressen begrenzen: nur eigene Pfade und https. Damit lässt sich über
 * das Feld kein javascript: oder data: einschleusen.
 */
function aboutUrl($v): string
{
    $v = is_string($v) ? trim($v) : '';
    if ($v === '') return '';
    if (str_starts_with($v, '/')) return mb_substr($v, 0, 500);
    if (preg_match('#^https?://#i', $v)) return mb_substr($v, 0, 500);
    return '';
}

$content = aboutDefault();
$content['hero_image'] = aboutUrl($in['hero_image'] ?? '');
$content['hero_alt'] = aboutText($in['hero_alt'] ?? '', 200);

foreach (['de', 'en'] as $lang) {
    $src = is_array($in[$lang] ?? null) ? $in[$lang] : [];
    $content[$lang] = [
        'headline' => aboutText($src['headline'] ?? '', 120) ?: $content[$lang]['headline'],
        'intro' => aboutText($src['intro'] ?? '', 600),
        'story' => aboutText($src['story'] ?? '', 12000),
        'mission_title' => aboutText($src['mission_title'] ?? '', 120),
        'mission' => aboutText($src['mission'] ?? '', 2000),
        'team_title' => aboutText($src['team_title'] ?? '', 120),
        'team_intro' => aboutText($src['team_intro'] ?? '', 600),
    ];
}

$team = [];
foreach ((array)($in['team'] ?? []) as $m) {
    if (!is_array($m)) continue;
    $name = aboutText($m['name'] ?? '', 120);
    if ($name === '') continue; // ohne Namen kein Eintrag
    $team[] = [
        'id' => aboutText($m['id'] ?? '', 40) ?: bin2hex(random_bytes(8)),
        'name' => $name,
        'photo' => aboutUrl($m['photo'] ?? ''),
        'role_de' => aboutText($m['role_de'] ?? '', 120),
        'role_en' => aboutText($m['role_en'] ?? '', 120),
        'bio_de' => aboutText($m['bio_de'] ?? '', 1500),
        'bio_en' => aboutText($m['bio_en'] ?? '', 1500),
        'email' => aboutText($m['email'] ?? '', 160),
        'link' => aboutUrl($m['link'] ?? ''),
    ];
    if (count($team) >= 40) break;
}
$content['team'] = $team;
$content['updated_at'] = gmdate('c');

if (!aboutSave($content)) {
    aboutFail(500, 'Schreiben fehlgeschlagen. Datenordner: ' . blogDataDir() . ' — Schreibrechte prüfen (chmod 750).');
}

echo json_encode(['content' => $content, 'message' => 'Gespeichert.'], JSON_UNESCAPED_UNICODE);
