<?php
/**
 * Datenhaltung für den Blog.
 *
 * Warum eine JSON-Datei und nicht Firestore:
 * Der Renderer (blog.php) läuft bei JEDEM Seitenaufruf. Ein Netzabruf zu
 * Firestore würde jede Seite um 200–400 ms verlangsamen — genau das, was
 * Google bei den Core Web Vitals misst. Die JSON-Datei liegt auf derselben
 * Platte und ist in unter einer Millisekunde gelesen.
 *
 * Geschrieben wird ausschließlich über blog-admin.php (Firebase-Token +
 * Admin-Prüfung). Die Datei liegt außerhalb des öffentlichen Verzeichnisses,
 * damit niemand sie direkt abrufen kann.
 */

declare(strict_types=1);

const BLOG_STATUS_DRAFT = 'draft';
const BLOG_STATUS_SCHEDULED = 'scheduled';
const BLOG_STATUS_PUBLISHED = 'published';

function blogDataDir(): string
{
    // Eine Ebene über dem Web-Wurzelverzeichnis: per URL nicht erreichbar.
    $candidates = [
        dirname(__DIR__, 2) . '/orbylox-data',
        dirname(__DIR__) . '/../orbylox-data',
        sys_get_temp_dir() . '/orbylox-data',
    ];
    foreach ($candidates as $dir) {
        if (is_dir($dir) && is_writable($dir)) return $dir;
        if (!file_exists($dir) && @mkdir($dir, 0750, true)) return $dir;
    }
    return sys_get_temp_dir();
}

function blogFilePath(): string
{
    return blogDataDir() . '/blog-posts.json';
}

/** Alle Beiträge, roh. */
function blogLoadAll(): array
{
    $path = blogFilePath();
    if (!is_file($path)) return [];
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Atomar schreiben: erst in eine Nebendatei, dann umbenennen. Sonst könnte
 * ein Abbruch mitten im Schreiben die Datei zerstören und alle Artikel
 * vernichten.
 */
function blogSaveAll(array $posts): bool
{
    $path = blogFilePath();
    $tmp = $path . '.tmp';
    $json = json_encode(array_values($posts), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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

/** Sichtbar? Veröffentlicht und Zeitpunkt erreicht (geplante Beiträge). */
function blogIsLive(array $post, ?int $now = null): bool
{
    $now = $now ?? time();
    $status = (string)($post['status'] ?? BLOG_STATUS_DRAFT);
    if ($status === BLOG_STATUS_DRAFT) return false;

    $publishedAt = (string)($post['published_at'] ?? '');
    if ($publishedAt === '') return $status === BLOG_STATUS_PUBLISHED;

    $ts = strtotime($publishedAt);
    if ($ts === false) return $status === BLOG_STATUS_PUBLISHED;
    return $ts <= $now;
}

/** Öffentlich sichtbare Beiträge, neueste zuerst. */
function blogPublished(?string $locale = null): array
{
    $posts = array_filter(blogLoadAll(), 'blogIsLive');
    if ($locale !== null && $locale !== '') {
        $posts = array_filter($posts, fn ($p) => ((string)($p['locale'] ?? 'de')) === $locale);
    }
    usort($posts, function ($a, $b) {
        return strtotime((string)($b['published_at'] ?? '1970-01-01'))
             <=> strtotime((string)($a['published_at'] ?? '1970-01-01'));
    });
    return array_values($posts);
}

function blogFindBySlug(string $slug, bool $onlyLive = true): ?array
{
    foreach (blogLoadAll() as $post) {
        if ((string)($post['slug'] ?? '') === $slug) {
            if ($onlyLive && !blogIsLive($post)) return null;
            return $post;
        }
    }
    return null;
}

/** Aus einem Titel eine URL-taugliche Kennung bauen. */
function blogSlugify(string $text): string
{
    $map = ['ä'=>'ae','ö'=>'oe','ü'=>'ue','ß'=>'ss','Ä'=>'ae','Ö'=>'oe','Ü'=>'ue'];
    $text = strtr($text, $map);
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT', $text);
        if ($converted !== false) $text = $converted;
    }
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    return trim($text, '-');
}

/** Kennung eindeutig machen (…-2, …-3) — zwei Titel dürfen gleich heißen. */
function blogUniqueSlug(string $slug, ?string $ignoreId = null): string
{
    $slug = $slug !== '' ? $slug : 'beitrag';
    $taken = [];
    foreach (blogLoadAll() as $p) {
        if ($ignoreId !== null && (string)($p['id'] ?? '') === $ignoreId) continue;
        $taken[(string)($p['slug'] ?? '')] = true;
    }
    if (!isset($taken[$slug])) return $slug;
    $i = 2;
    while (isset($taken[$slug . '-' . $i])) $i++;
    return $slug . '-' . $i;
}

/** Lesezeit in Minuten, 200 Wörter je Minute. */
function blogReadingMinutes(string $markdown): int
{
    $plain = trim(preg_replace('/\s+/', ' ', strip_tags($markdown)) ?? '');
    $words = $plain === '' ? 0 : count(preg_split('/\s+/', $plain) ?: []);
    return max(1, (int)ceil($words / 200));
}

/** Alle vergebenen Kategorien mit Anzahl. */
function blogCategories(?string $locale = null): array
{
    $counts = [];
    foreach (blogPublished($locale) as $p) {
        $c = trim((string)($p['category'] ?? ''));
        if ($c === '') continue;
        $counts[$c] = ($counts[$c] ?? 0) + 1;
    }
    arsort($counts);
    return $counts;
}

/**
 * Ähnliche Beiträge: erst gleiche Kategorie, dann gemeinsame Schlagwörter.
 * Bewusst ohne Zufall — gleiche Eingabe, gleiches Ergebnis, damit Crawler
 * bei jedem Besuch dieselben internen Links sehen.
 */
function blogRelated(array $post, int $limit = 3): array
{
    $slug = (string)($post['slug'] ?? '');
    $locale = (string)($post['locale'] ?? 'de');
    $tags = array_map('strval', (array)($post['tags'] ?? []));
    $explicit = array_map('strval', (array)($post['related_slugs'] ?? []));

    $out = [];
    // 1) Von Hand gesetzte
    foreach ($explicit as $s) {
        $p = blogFindBySlug($s);
        if ($p) $out[$p['slug']] = $p;
    }
    // 2) Nach Punkten
    $scored = [];
    foreach (blogPublished($locale) as $p) {
        if ((string)$p['slug'] === $slug || isset($out[$p['slug']])) continue;
        $score = 0;
        if (($p['category'] ?? null) && $p['category'] === ($post['category'] ?? null)) $score += 3;
        $score += count(array_intersect($tags, array_map('strval', (array)($p['tags'] ?? []))));
        if ($score > 0) $scored[] = ['score' => $score, 'post' => $p];
    }
    usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']
        ?: strcmp((string)$a['post']['slug'], (string)$b['post']['slug']));
    foreach ($scored as $row) {
        if (count($out) >= $limit) break;
        $out[$row['post']['slug']] = $row['post'];
    }
    // 3) Auffüllen mit den neuesten
    if (count($out) < $limit) {
        foreach (blogPublished($locale) as $p) {
            if (count($out) >= $limit) break;
            if ((string)$p['slug'] === $slug || isset($out[$p['slug']])) continue;
            $out[$p['slug']] = $p;
        }
    }
    return array_slice(array_values($out), 0, $limit);
}

/**
 * Admin-Adressen — eine einzige Quelle fuer alle Endpunkte.
 *
 * Frueher stand die Liste dreimal im Code, jeweils als
 * `$config['admin_emails'] ?? [...]`. Das war doppelt fehleranfaellig:
 *
 *  - `??` greift nur bei null. Weil der Schluessel vorher schon auf `[]`
 *    gesetzt wurde, war er nie null — die Ersatzliste wurde nie benutzt und
 *    ohne blog-config.php kam NIEMAND durch, auch der Betreiber nicht.
 *  - Eine Adresse an drei Stellen zu aendern geht irgendwann schief.
 *
 * Deshalb hier: leere Liste zaehlt als "nicht gesetzt", und der Wert steht
 * genau einmal im Projekt.
 */
function blogAdminEmails(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $emails = [];
    foreach ([__DIR__ . '/blog-config.php', __DIR__ . '/invite-config.php'] as $file) {
        if (!is_file($file)) continue;
        $loaded = require $file;
        if (!is_array($loaded) || !isset($loaded['admin_emails'])) continue;
        foreach ((array)$loaded['admin_emails'] as $e) {
            if (!is_string($e)) continue;
            $e = strtolower(trim($e));
            if ($e !== '') $emails[$e] = true;
        }
    }
    if (!$emails) $emails = ['jey.afandiyev@gmail.com' => true];

    $cache = array_keys($emails);
    return $cache;
}

/** Firebase-Projektkennung aus einer der beiden Konfigurationsdateien. */
function blogFirebaseProjectId(): string
{
    foreach ([__DIR__ . '/blog-config.php', __DIR__ . '/invite-config.php'] as $file) {
        if (!is_file($file)) continue;
        $loaded = require $file;
        if (is_array($loaded) && !empty($loaded['firebase_project_id'])) {
            return (string)$loaded['firebase_project_id'];
        }
    }
    return '';
}

/**
 * Zwischenspeicher-Kopfzeilen, die sich am Datenstand orientieren.
 *
 * Vorher stand in blog.php eine feste Dauer: fuenf Minuten im Browser, zehn
 * am Rand des Netzes. Wer einen Artikel veroeffentlicht hatte, sah danach bis
 * zu zehn Minuten lang die alte Seite — und hielt das verstaendlicherweise
 * fuer einen Fehler ("es wird immer leer angezeigt").
 *
 * Jetzt haengt die Kennung am Aenderungszeitpunkt der Artikeldatei:
 *   - nichts geaendert  -> 304, der Server schickt kein Byte Inhalt
 *   - etwas veroeffentlicht -> neue Kennung, alle Ebenen holen frisch
 *
 * Die kurze Frist von 60 Sekunden bleibt als Schutz vor Lastspitzen;
 * stale-while-revalidate laesst den Rand des Netzes im Hintergrund
 * nachladen, ohne den Besucher warten zu lassen.
 */
function blogSendCacheHeaders(): void
{
    $mtime = is_file(blogFilePath()) ? (int)filemtime(blogFilePath()) : 0;
    $etag = '"b' . $mtime . '-' . substr(sha1((string)($_SERVER['REQUEST_URI'] ?? '/')), 0, 12) . '"';

    header('Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=600');
    header('ETag: ' . $etag);
    if ($mtime > 0) {
        header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
    }

    $ifNone = trim((string)($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
    if ($ifNone !== '' && strpos($ifNone, $etag) !== false) {
        http_response_code(304);
        exit;
    }
}
