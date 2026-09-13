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

/**
 * Aktualisieren statt nur ergänzen — aber nur, wenn ausdrücklich verlangt.
 *
 * WARUM ES DIESEN SCHALTER BRAUCHT
 * Die Startdatei liegt im Git-Verlauf, die Beiträge liegen auf dem Server.
 * Ohne diesen Weg gibt es keine Verbindung zwischen beiden: Ein Text, der
 * hier verbessert wird, erreicht die Seite nie — man müsste jede Änderung von
 * Hand in die Redaktion tippen. Genau das ist passiert, als die Ratgeber von
 * 700 auf 1.700 Wörter wuchsen.
 *
 * WARUM ER TROTZDEM AUSGESCHALTET IST
 * Weil er das Gegenteil von harmlos ist: Er überschreibt Texte, die vielleicht
 * in der Redaktion bearbeitet wurden. Deshalb muss man ihn nennen —
 * `?update=1` beziehungsweise `php blog-seed.php --update` — und deshalb sagt
 * die Ausgabe hinterher Beitrag für Beitrag, was ersetzt wurde.
 *
 * WAS ER NICHT ANFASST
 * Beiträge, die es nur auf dem Server gibt (in der Redaktion geschrieben),
 * bleiben unberührt: Aktualisiert wird ausschliesslich, was in der Startdatei
 * steht.
 */
$update = $isCli
    ? in_array('--update', $argv ?? [], true)
    : (($_GET['update'] ?? '') === '1');

$added = [];
$skipped = [];
$updated = [];
foreach ($seed as $p) {
    $slug = (string)($p['slug'] ?? '');
    if ($slug === '') continue;
    if (isset($known[$slug])) {
        if (!$update) { $skipped[] = $slug; continue; }
        foreach ($existing as $i => $vorhanden) {
            if ((string)($vorhanden['slug'] ?? '') !== $slug) continue;
            /* Die Kennung und das Anlagedatum bleiben, alles andere kommt aus
               der Startdatei. Eine neue Kennung würde Verweise zerreissen, ein
               neues Anlagedatum die Reihenfolge im Blog durcheinanderbringen. */
            $p['id'] = $vorhanden['id'] ?? ($p['id'] ?? '');
            $p['created_at'] = $vorhanden['created_at'] ?? ($p['created_at'] ?? '');
            $existing[$i] = $p;
            $updated[] = $slug;
            break;
        }
        continue;
    }
    $existing[] = $p;
    $known[$slug] = true;
    $added[] = $slug;
}

if (!$added && !$updated) {
    echo "Nichts zu tun — alle " . count($seed) . " Beiträge sind bereits vorhanden.\n";
    echo "Zum Überschreiben mit dem Stand aus der Startdatei: --update bzw. ?update=1\n";
    echo 'Datenordner: ' . blogDataDir() . "\n";
    exit;
}

if (!blogSaveAll($existing)) {
    echo "Schreiben fehlgeschlagen. Datenordner: " . blogDataDir() . "\n";
    echo "Rechte prüfen: chmod 750 " . blogDataDir() . "\n";
    exit(1);
}

echo count($added) . " Beiträge hinzugefügt";
if ($updated) echo ', ' . count($updated) . ' aktualisiert';
if ($skipped) echo ', ' . count($skipped) . ' bereits vorhanden (unverändert)';
echo ".\n";
echo 'Bestand jetzt: ' . count($existing) . " Beiträge, davon " . count(blogPublished()) . " veröffentlicht.\n";
echo 'Datenordner: ' . blogDataDir() . "\n\n";
foreach ($added as $slug) {
    echo '  neu:  https://orbylox.de/blog/' . $slug . "\n";
}
foreach ($updated as $slug) {
    echo '  neu geschrieben:  https://orbylox.de/blog/' . $slug . "\n";
}
