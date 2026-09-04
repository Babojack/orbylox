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
