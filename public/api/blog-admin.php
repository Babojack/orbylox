<?php
/**
 * Schreibzugriff auf den Blog — nur für Administratoren.
 *
 * Sicherheitskette:
 *   1. Firebase-ID-Token im Authorization-Header (RS256 gegen Googles
 *      Zertifikate geprüft — dieselbe Funktion wie beim Einladungsversand).
 *   2. E-Mail muss in der Admin-Liste stehen.
 *   3. Jedes Feld wird serverseitig geprüft und begrenzt; der Artikeltext wird
 *      als Markdown gespeichert und erst beim Rendern in HTML gewandelt —
 *      dabei vollständig escaped (siehe blog-markdown.php).
 *
 * Passwörter gibt es hier bewusst keine: die Anmeldung läuft über Firebase
 * (Google oder E-Mail+Passwort). Firebase hasht und verwahrt die Zugangsdaten,
 * wir speichern nie ein Passwort. Das ist sicherer als eine eigene Lösung.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/blog-store.php';

// --- Konfiguration (Firebase-Projekt + Admin-Adressen) ---
$config = ['firebase_project_id' => '', 'admin_emails' => []];
foreach ([__DIR__ . '/blog-config.php', __DIR__ . '/invite-config.php'] as $file) {
    if (is_file($file)) {
        $loaded = require $file;
        if (is_array($loaded)) $config = array_merge($config, $loaded);
    }
}
$firebaseProjectId = (string)($config['firebase_project_id'] ?? '');
$adminEmails = array_map(
    'strtolower',
    (array)($config['admin_emails'] ?? ['gudfransen@gmail.com', 'jey.afandiyev@gmail.com'])
);

// --- CORS: nur die eigene Domain ---
$allowedOrigins = ['https://orbylox.de', 'https://www.orbylox.de', 'http://localhost:5173', 'http://localhost:4173'];
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function fail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($firebaseProjectId === '') {
    fail(500, 'firebase_project_id fehlt in blog-config.php / invite-config.php');
}

require_once __DIR__ . '/firebase-auth.php';
$user = requireFirebaseUser($firebaseProjectId);
$email = strtolower((string)($user['email'] ?? ''));
if ($email === '' || !in_array($email, $adminEmails, true)) {
    fail(403, 'Kein Administratorzugang.');
}

// --- Eingabe ---
$raw = file_get_contents('php://input') ?: '';
$in = json_decode($raw, true);
if (!is_array($in)) $in = [];
$action = (string)($in['action'] ?? ($_GET['action'] ?? 'list'));

/** Text säubern und begrenzen. */
function s(array $in, string $key, int $max, string $default = ''): string
{
    $v = $in[$key] ?? $default;
    if (!is_string($v)) $v = $default;
    $v = str_replace(["\0", "\r"], ['', ''], $v);
    $v = trim($v);
    return mb_substr($v, 0, $max, 'UTF-8');
}

function strList(array $in, string $key, int $maxItems, int $maxLen): array
{
    $v = $in[$key] ?? [];
    if (is_string($v)) $v = preg_split('/[,;]/', $v) ?: [];
    if (!is_array($v)) return [];
    $out = [];
    foreach ($v as $item) {
        if (!is_string($item)) continue;
        $item = trim($item);
        if ($item === '') continue;
        $out[] = mb_substr($item, 0, $maxLen, 'UTF-8');
        if (count($out) >= $maxItems) break;
    }
    return array_values(array_unique($out));
}

/** Aus der Eingabe einen vollständigen, geprüften Beitrag bauen. */
function blogBuildPost(array $in, ?array $existing, string $authorEmail): array
{
    $now = gmdate('c');
    $id = $existing['id'] ?? bin2hex(random_bytes(8));

    $title = s($in, 'title', 200);
    if ($title === '') fail(400, 'Titel fehlt.');

    $content = $in['content'] ?? ($existing['content'] ?? '');
    if (!is_string($content)) $content = '';
    $content = mb_substr(str_replace("\0", '', $content), 0, 200000, 'UTF-8');
    if (trim($content) === '') fail(400, 'Inhalt fehlt.');

    $status = s($in, 'status', 20, $existing['status'] ?? BLOG_STATUS_DRAFT);
    if (!in_array($status, [BLOG_STATUS_DRAFT, BLOG_STATUS_SCHEDULED, BLOG_STATUS_PUBLISHED], true)) {
        $status = BLOG_STATUS_DRAFT;
    }

    $slugInput = s($in, 'slug', 200);
    $slug = blogSlugify($slugInput !== '' ? $slugInput : $title);
    $slug = blogUniqueSlug($slug, $existing['id'] ?? null);

    $locale = s($in, 'locale', 5, $existing['locale'] ?? 'de');
    if (!in_array($locale, ['de', 'en'], true)) $locale = 'de';

    $publishedAt = s($in, 'published_at', 40, $existing['published_at'] ?? '');
    if ($status !== BLOG_STATUS_DRAFT && $publishedAt === '') $publishedAt = $now;
    if ($publishedAt !== '' && strtotime($publishedAt) === false) $publishedAt = $now;

    // Zukunft + veröffentlicht -> geplant
    if ($status === BLOG_STATUS_PUBLISHED && $publishedAt !== '' && strtotime($publishedAt) > time()) {
        $status = BLOG_STATUS_SCHEDULED;
    }

    $excerpt = s($in, 'excerpt', 400);
    if ($excerpt === '') {
        $plain = trim(preg_replace('/\s+/', ' ', strip_tags($content)) ?? '');
        $excerpt = mb_substr($plain, 0, 180, 'UTF-8');
        if (mb_strlen($plain, 'UTF-8') > 180) $excerpt .= '…';
    }

    $image = s($in, 'featured_image', 500);
    if ($image !== '' && !preg_match('#^(https?://|/)#i', $image)) $image = '';

    $ogImage = s($in, 'og_image', 500);
    if ($ogImage !== '' && !preg_match('#^(https?://|/)#i', $ogImage)) $ogImage = '';

    $canonical = s($in, 'canonical_url', 500);
    if ($canonical !== '' && !preg_match('#^https?://#i', $canonical)) $canonical = '';

    $metaDescription = s($in, 'meta_description', 320);
    if ($metaDescription === '') $metaDescription = mb_substr($excerpt, 0, 160, 'UTF-8');

    return [
        'id'               => (string)$id,
        'title'            => $title,
        'slug'             => $slug,
        'locale'           => $locale,
        'excerpt'          => $excerpt,
        'featured_image'   => $image,
        'featured_alt'     => s($in, 'featured_alt', 200) ?: $title,
        'content'          => $content,
        'category'         => s($in, 'category', 80),
        'tags'             => strList($in, 'tags', 12, 40),
        'author'           => s($in, 'author', 120, $existing['author'] ?? 'ORBYLOX'),
        'author_email'     => $existing['author_email'] ?? $authorEmail,
        'published_at'     => $publishedAt,
        'updated_at'       => $now,
        'created_at'       => $existing['created_at'] ?? $now,
        'seo_title'        => s($in, 'seo_title', 200) ?: $title,
        'meta_description' => $metaDescription,
        'og_image'         => $ogImage ?: $image,
        'canonical_url'    => $canonical,
        'status'           => $status,
        'related_slugs'    => strList($in, 'related_slugs', 6, 200),
        'translation_of'   => s($in, 'translation_of', 200, $existing['translation_of'] ?? ''),
    ];
}

// --- Aktionen ---
switch ($action) {
    case 'list': {
        $posts = blogLoadAll();
        usort($posts, fn ($a, $b) =>
            strtotime((string)($b['updated_at'] ?? '1970-01-01')) <=> strtotime((string)($a['updated_at'] ?? '1970-01-01')));
        echo json_encode(['posts' => $posts], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'get': {
        $id = s($in, 'id', 64) ?: (string)($_GET['id'] ?? '');
        foreach (blogLoadAll() as $p) {
            if ((string)$p['id'] === $id) { echo json_encode(['post' => $p], JSON_UNESCAPED_UNICODE); exit; }
        }
        fail(404, 'Beitrag nicht gefunden.');
        break;
    }

    case 'save': {
        $id = s($in, 'id', 64);
        $all = blogLoadAll();
        $existing = null;
        foreach ($all as $p) { if ((string)$p['id'] === $id) { $existing = $p; break; } }

        $post = blogBuildPost($in, $existing, $email);

        if ($existing) {
            foreach ($all as $i => $p) { if ((string)$p['id'] === $post['id']) { $all[$i] = $post; break; } }
        } else {
            $all[] = $post;
        }
        if (!blogSaveAll($all)) fail(500, 'Speichern fehlgeschlagen (Schreibrechte im Datenordner?).');
        echo json_encode(['post' => $post], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'delete': {
        $id = s($in, 'id', 64);
        $all = blogLoadAll();
        $before = count($all);
        $all = array_values(array_filter($all, fn ($p) => (string)$p['id'] !== $id));
        if (count($all) === $before) fail(404, 'Beitrag nicht gefunden.');
        if (!blogSaveAll($all)) fail(500, 'Löschen fehlgeschlagen.');
        echo json_encode(['ok' => true]);
        break;
    }

    case 'diag': {
        echo json_encode([
            'ok' => true,
            'admin' => $email,
            'data_dir' => blogDataDir(),
            'data_writable' => is_writable(blogDataDir()),
            'posts' => count(blogLoadAll()),
            'published' => count(blogPublished()),
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    default:
        fail(400, 'Unbekannte Aktion: ' . $action);
}
