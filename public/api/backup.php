<?php
declare(strict_types=1);

/**
 * Full project backups for ORBYLOX: one ZIP per backup containing
 *   data.json          – every Firestore collection of the project
 *   files/<uid>/<name> – the actual uploaded files, with their original paths
 *
 * Because the paths are preserved, a restore puts every file back where its
 * stored URL already points — the project comes back 1:1, links included.
 *
 * Actions (query parameter `action`):
 *   POST create   { project_id, name, data, files: [url, ...] }  -> backup meta
 *   GET  list     ?project_id=...                                -> [meta, ...]
 *   GET  download ?id=...                                        -> ZIP stream
 *   GET  restore  ?id=...                                        -> { data, restored_files, missing_files }
 *   POST delete   ?id=...                                        -> { status: "ok" }
 *
 * Every request needs: Authorization: Bearer <Firebase ID token>
 */

$isDownload = (($_GET['action'] ?? '') === 'download');
if (!$isDownload) {
    header('Content-Type: application/json; charset=utf-8');
}
header('X-Content-Type-Options: nosniff');

$defaults = [
    'firebase_project_id' => 'orbylox',
    'allowed_origins' => [
        'https://orbylox.de',
        'https://www.orbylox.de',
        'http://localhost:5173',
        'http://localhost:4173',
    ],
    'upload_dir' => dirname(__DIR__) . '/uploads',
    'public_base_url' => 'https://orbylox.de/uploads',
    // Kept outside the document root when possible, so backups are never web-readable.
    'backup_dir' => dirname(dirname(__DIR__)) . '/orbylox-backups',
    'max_backup_bytes' => 2 * 1024 * 1024 * 1024,
];

foreach (['upload-config.php', 'backup-config.php'] as $configName) {
    $configPath = __DIR__ . '/' . $configName;
    if (is_file($configPath)) {
        $override = require $configPath;
        if (is_array($override)) {
            $defaults = array_merge($defaults, $override);
        }
    }
}
$config = $defaults;

require_once __DIR__ . '/firebase-auth.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, (array)$config['allowed_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

if (!class_exists('ZipArchive')) {
    orbyloxJsonFail(500, 'PHP-Erweiterung zip fehlt auf dem Server.');
}

$user = requireFirebaseUser((string)$config['firebase_project_id']);
$action = (string)($_GET['action'] ?? '');

$backupRoot = rtrim((string)$config['backup_dir'], '/');
if (!is_dir($backupRoot) && !@mkdir($backupRoot, 0700, true) && !is_dir($backupRoot)) {
    // Fall back inside the document root, but block web access to it.
    $backupRoot = rtrim((string)$config['upload_dir'], '/') . '/../orbylox-backups';
    if (!is_dir($backupRoot) && !mkdir($backupRoot, 0700, true) && !is_dir($backupRoot)) {
        orbyloxJsonFail(500, 'Backup-Ordner konnte nicht angelegt werden.');
    }
    @file_put_contents($backupRoot . '/.htaccess', "Require all denied\nDeny from all\n");
}

function safeId(string $value): string
{
    return preg_replace('/[^A-Za-z0-9_-]/', '', $value) ?? '';
}

function projectBackupDir(string $root, string $projectId): string
{
    return $root . '/' . safeId($projectId);
}

function readBackupMeta(string $zipPath): ?array
{
    $metaPath = preg_replace('/\.zip$/', '.json', $zipPath);
    if ($metaPath && is_file($metaPath)) {
        $meta = json_decode((string)file_get_contents($metaPath), true);
        if (is_array($meta)) {
            $meta['size'] = (int)@filesize($zipPath);
            return $meta;
        }
    }
    return [
        'id' => basename($zipPath, '.zip'),
        'name' => basename($zipPath, '.zip'),
        'created_date' => date('c', (int)@filemtime($zipPath)),
        'size' => (int)@filesize($zipPath),
    ];
}

/** Maps a stored file URL back to its path inside the uploads folder. */
function localPathForUrl(string $url, array $config): ?string
{
    $base = rtrim((string)$config['public_base_url'], '/');
    if (strpos($url, $base . '/') !== 0) {
        return null; // external (Cloudinary, data: URL, …) — recorded in data.json only
    }
    $relative = rawurldecode(substr($url, strlen($base) + 1));
    if ($relative === '' || strpos($relative, '..') !== false) {
        return null;
    }
    $path = rtrim((string)$config['upload_dir'], '/') . '/' . $relative;
    return is_file($path) ? $path : null;
}

/* ------------------------------------------------------------------ create */

if ($action === 'create') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        orbyloxJsonFail(405, 'Method not allowed');
    }
    $payload = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        orbyloxJsonFail(400, 'Invalid JSON body');
    }

    $projectId = safeId((string)($payload['project_id'] ?? ''));
    if ($projectId === '') {
        orbyloxJsonFail(400, 'Missing project_id');
    }
    if (!orbyloxCanAccessProject($user['token'], (string)$config['firebase_project_id'], $projectId)) {
        orbyloxJsonFail(403, 'Kein Zugriff auf dieses Projekt.');
    }

    $dir = projectBackupDir($backupRoot, $projectId);
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        orbyloxJsonFail(500, 'Backup-Ordner konnte nicht angelegt werden.');
    }

    $id = date('Ymd-His') . '-' . bin2hex(random_bytes(4));
    $zipPath = $dir . '/' . $id . '.zip';

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        orbyloxJsonFail(500, 'ZIP konnte nicht erstellt werden.');
    }

    $zip->addFromString('data.json', json_encode([
        'version' => 1,
        'project_id' => $projectId,
        'created_date' => date('c'),
        'created_by' => $user['email'],
        'data' => $payload['data'] ?? new stdClass(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    $included = 0;
    $external = [];
    $missing = [];
    foreach ((array)($payload['files'] ?? []) as $url) {
        $url = (string)$url;
        if ($url === '' || strpos($url, 'data:') === 0) {
            continue;
        }
        $path = localPathForUrl($url, $config);
        if ($path === null) {
            if (strpos($url, rtrim((string)$config['public_base_url'], '/')) === 0) {
                $missing[] = $url; // ours, but gone from disk
            } else {
                $external[] = $url; // hosted elsewhere
            }
            continue;
        }
        $relative = substr($path, strlen(rtrim((string)$config['upload_dir'], '/')) + 1);
        $zip->addFile($path, 'files/' . $relative);
        $included++;
    }

    $zip->addFromString('manifest.json', json_encode([
        'included_files' => $included,
        'external_files' => $external,
        'missing_files' => $missing,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    $zip->close();

    $meta = [
        'id' => $id,
        'project_id' => $projectId,
        'name' => trim((string)($payload['name'] ?? '')) !== ''
            ? (string)$payload['name']
            : 'Backup ' . date('d.m.Y H:i'),
        'backup_type' => (string)($payload['backup_type'] ?? 'manual'),
        'created_date' => date('c'),
        'created_by' => $user['email'],
        'included_files' => $included,
        'external_files' => count($external),
        'missing_files' => count($missing),
        'size' => (int)@filesize($zipPath),
    ];
    file_put_contents($dir . '/' . $id . '.json', json_encode($meta, JSON_UNESCAPED_UNICODE));

    echo json_encode($meta, JSON_UNESCAPED_UNICODE);
    exit;
}

/* -------------------------------------------------------------------- list */

if ($action === 'list') {
    $projectId = safeId((string)($_GET['project_id'] ?? ''));
    if ($projectId === '') {
        orbyloxJsonFail(400, 'Missing project_id');
    }
    if (!orbyloxCanAccessProject($user['token'], (string)$config['firebase_project_id'], $projectId)) {
        orbyloxJsonFail(403, 'Kein Zugriff auf dieses Projekt.');
    }

    $dir = projectBackupDir($backupRoot, $projectId);
    $out = [];
    foreach (glob($dir . '/*.zip') ?: [] as $zipPath) {
        $meta = readBackupMeta($zipPath);
        if ($meta) {
            $out[] = $meta;
        }
    }
    usort($out, static fn ($a, $b) => strcmp((string)$b['created_date'], (string)$a['created_date']));
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
}

/* --------------------------------------------------- download / restore / delete */

$id = safeId((string)($_GET['id'] ?? ''));
$projectId = safeId((string)($_GET['project_id'] ?? ''));
if ($action !== '' && $id === '') {
    orbyloxJsonFail(400, 'Missing id');
}
if ($id !== '' && $projectId === '') {
    orbyloxJsonFail(400, 'Missing project_id');
}
if ($id !== '' && !orbyloxCanAccessProject($user['token'], (string)$config['firebase_project_id'], $projectId)) {
    orbyloxJsonFail(403, 'Kein Zugriff auf dieses Projekt.');
}

$zipPath = projectBackupDir($backupRoot, $projectId) . '/' . $id . '.zip';
if ($action !== '' && !is_file($zipPath)) {
    orbyloxJsonFail(404, 'Backup nicht gefunden.');
}

if ($action === 'download') {
    header('Content-Type: application/zip');
    header('Content-Length: ' . (int)filesize($zipPath));
    header('Content-Disposition: attachment; filename="orbylox-backup-' . $id . '.zip"');
    readfile($zipPath);
    exit;
}

if ($action === 'restore') {
    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) {
        orbyloxJsonFail(500, 'Backup konnte nicht geoeffnet werden.');
    }

    $dataRaw = $zip->getFromName('data.json');
    if ($dataRaw === false) {
        $zip->close();
        orbyloxJsonFail(500, 'Backup enthaelt keine data.json.');
    }

    $uploadRoot = rtrim((string)$config['upload_dir'], '/');
    $restored = 0;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = (string)$zip->getNameIndex($i);
        if (strpos($name, 'files/') !== 0 || substr($name, -1) === '/') {
            continue;
        }
        $relative = substr($name, strlen('files/'));
        if ($relative === '' || strpos($relative, '..') !== false) {
            continue;
        }
        $target = $uploadRoot . '/' . $relative;
        $targetDir = dirname($target);
        if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
            continue;
        }
        $stream = $zip->getStream($name);
        if (!$stream) {
            continue;
        }
        $out = fopen($target, 'wb');
        if ($out) {
            stream_copy_to_stream($stream, $out);
            fclose($out);
            @chmod($target, 0644);
            $restored++;
        }
        fclose($stream);
    }

    $manifestRaw = $zip->getFromName('manifest.json');
    $zip->close();

    echo json_encode([
        'data' => json_decode((string)$dataRaw, true),
        'restored_files' => $restored,
        'manifest' => $manifestRaw === false ? null : json_decode((string)$manifestRaw, true),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'delete') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        orbyloxJsonFail(405, 'Method not allowed');
    }
    @unlink($zipPath);
    @unlink(preg_replace('/\.zip$/', '.json', $zipPath) ?? '');
    echo json_encode(['status' => 'ok']);
    exit;
}

orbyloxJsonFail(400, 'Unbekannte Aktion.');
