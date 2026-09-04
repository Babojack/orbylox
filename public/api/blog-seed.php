<?php
/**
 * Startartikel einmalig einspielen.
 *
 * Aufruf im Browser (angemeldet als Admin ist hier nicht möglich, deshalb per
 * Token aus der Redaktion) ODER direkt auf dem Server:
 *   php blog-seed.php
 *
 * Spielt nur ein, wenn noch keine Beiträge vorhanden sind — ein zweiter Aufruf
 * überschreibt nichts.
 */

declare(strict_types=1);
require_once __DIR__ . '/blog-store.php';

$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');

    // Im Web nur mit gültigem Admin-Token
    $projectId = blogFirebaseProjectId();
    $admins = blogAdminEmails();
    if ($projectId === '') { http_response_code(500); exit("firebase_project_id fehlt.\n"); }
    require_once __DIR__ . '/firebase-auth.php';
    $user = requireFirebaseUser($projectId);
    if (!in_array(strtolower((string)($user['email'] ?? '')), $admins, true)) {
        http_response_code(403); exit("Kein Administratorzugang.\n");
    }
}

$seedFile = __DIR__ . '/blog-posts.seed.json';
if (!is_file($seedFile)) { echo "blog-posts.seed.json fehlt.\n"; exit(1); }

$seed = json_decode((string)file_get_contents($seedFile), true);
if (!is_array($seed)) { echo "Startdatei ist kein gültiges JSON.\n"; exit(1); }

/**
 * Zusammenführen statt überschreiben.
 *
 * Ein bereits vorhandener Beitrag wird NIE angefasst — sonst würde ein
 * zweiter Aufruf eigene Änderungen am Text wieder platt machen. Es kommen
 * nur Beiträge dazu, deren URL-Kennung noch nicht existiert. Damit lässt
 * sich das Skript gefahrlos beliebig oft laufen lassen.
 */
$existing = blogLoadAll();
$known = [];
foreach ($existing as $p) { $known[(string)($p['slug'] ?? '')] = true; }

$added = [];
$skipped = [];
foreach ($seed as $p) {
    $slug = (string)($p['slug'] ?? '');
    if ($slug === '') continue;
    if (isset($known[$slug])) { $skipped[] = $slug; continue; }
    $existing[] = $p;
    $known[$slug] = true;
    $added[] = $slug;
}

if (!$added) {
    echo "Nichts hinzuzufügen — alle " . count($seed) . " Beiträge sind bereits vorhanden.\n";
    echo 'Datenordner: ' . blogDataDir() . "\n";
    exit;
}

if (!blogSaveAll($existing)) {
    echo "Schreiben fehlgeschlagen. Datenordner: " . blogDataDir() . "\n";
    echo "Rechte prüfen: chmod 750 " . blogDataDir() . "\n";
    exit(1);
}

echo count($added) . " Beiträge hinzugefügt";
if ($skipped) echo ', ' . count($skipped) . ' bereits vorhanden (unverändert)';
echo ".\n";
echo 'Bestand jetzt: ' . count($existing) . " Beiträge, davon " . count(blogPublished()) . " veröffentlicht.\n";
echo 'Datenordner: ' . blogDataDir() . "\n\n";
foreach ($added as $slug) {
    echo '  neu:  https://orbylox.de/blog/' . $slug . "\n";
}
