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
    $config = [];
    foreach ([__DIR__ . '/blog-config.php', __DIR__ . '/invite-config.php'] as $f) {
        if (is_file($f)) { $c = require $f; if (is_array($c)) $config = array_merge($config, $c); }
    }
    $projectId = (string)($config['firebase_project_id'] ?? '');
    $admins = array_map('strtolower', (array)($config['admin_emails'] ?? ['gudfransen@gmail.com', 'jey.afandiyev@gmail.com']));
    if ($projectId === '') { http_response_code(500); exit("firebase_project_id fehlt.\n"); }
    require_once __DIR__ . '/firebase-auth.php';
    $user = requireFirebaseUser($projectId);
    if (!in_array(strtolower((string)($user['email'] ?? '')), $admins, true)) {
        http_response_code(403); exit("Kein Administratorzugang.\n");
    }
}

$existing = blogLoadAll();
if ($existing) {
    echo 'Es sind bereits ' . count($existing) . " Beiträge vorhanden — nichts eingespielt.\n";
    exit;
}

$seedFile = __DIR__ . '/blog-posts.seed.json';
if (!is_file($seedFile)) { echo "blog-posts.seed.json fehlt.\n"; exit(1); }

$posts = json_decode((string)file_get_contents($seedFile), true);
if (!is_array($posts)) { echo "Startdatei ist kein gültiges JSON.\n"; exit(1); }

if (!blogSaveAll($posts)) {
    echo "Schreiben fehlgeschlagen. Datenordner: " . blogDataDir() . "\n";
    exit(1);
}

echo count($posts) . " Beiträge eingespielt.\n";
echo 'Datenordner: ' . blogDataDir() . "\n";
foreach ($posts as $p) {
    echo '  /blog/' . $p['slug'] . "\n";
}
