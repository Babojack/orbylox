<?php
declare(strict_types=1);

/**
 * File upload endpoint for the ORBYLOX FileHub (Hostinger, no Firebase Storage).
 *
 * POST multipart/form-data:
 *   file: <binary>
 * Header:
 *   Authorization: Bearer <Firebase ID token>
 *
 * The uid is taken from the verified token, never from the request body, so a
 * client cannot write into another user's folder.
 *
 * Response: { "file_url": "https://orbylox.de/uploads/<uid>/<id>_<name>", "name": ..., "size": ... }
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$defaults = [
    // Firebase project id — the ID token audience must match this exactly.
    'firebase_project_id' => 'orbylox',
    'allowed_origins' => [
        'https://orbylox.de',
        'https://www.orbylox.de',
        'http://localhost:5173',
        'http://localhost:4173',
    ],
    // Absolute path of the upload folder. Default: public_html/uploads
    'upload_dir' => dirname(__DIR__) . '/uploads',
    // Public base URL matching upload_dir.
    'public_base_url' => 'https://orbylox.de/uploads',
    'max_bytes' => 25 * 1024 * 1024,
    'allowed_extensions' => [
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
        'txt', 'md', 'csv', 'rtf', 'json', 'xml',
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'heic', 'bmp', 'ico',
        'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'mov', 'webm', 'avi', 'mkv',
        'zip', 'rar', '7z', 'tar', 'gz',
    ],
];

$configPath = __DIR__ . '/upload-config.php';
$config = $defaults;
if (is_file($configPath)) {
    $override = require $configPath;
    if (is_array($override)) {
        $config = array_merge($defaults, $override);
    }
}

require_once __DIR__ . '/firebase-auth.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = $config['allowed_origins'] ?? [];

function sendCors(string $origin, array $allowed): void
{
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    sendCors($origin, $allowedOrigins);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

sendCors($origin, $allowedOrigins);

/* ------------------------------------------------------------- Diagnose */
/**
 * Im Browser aufrufbar: /api/upload.php?action=diag
 *
 * Zeigt, ob das Skript ueberhaupt laeuft, wohin es schreiben will und was die
 * PHP-Grenzen hergeben. Antwortet absichtlich VOR der Anmeldepruefung, damit
 * man auch dann etwas sieht, wenn gerade kein Token zur Hand ist — und gibt
 * ausschliesslich Konfiguration heraus, keine Zugangsdaten und keine
 * Dateinamen anderer Nutzer.
 *
 * Der Sinn: Ein 403 stammt nie aus diesem Skript. Wer diese Seite sieht, weiss
 * damit sofort, dass PHP erreichbar ist und der Riegel davor liegt.
 */
if (($_GET['action'] ?? '') === 'diag') {
    $dir = rtrim((string)$config['upload_dir'], '/');
    $guard = $dir . '/.htaccess';
    echo json_encode([
        'ok' => true,
        'note' => 'Diese Seite kommt aus upload.php. Wer sie sieht, hat PHP erreicht — '
                . 'ein 403 auf denselben Pfad kommt dann vom Webserver, nicht von hier.',
        'php_version' => PHP_VERSION,
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? '',
        'upload_dir' => $dir,
        'upload_dir_exists' => is_dir($dir),
        'upload_dir_writable' => is_dir($dir) ? is_writable($dir) : is_writable(dirname($dir)),
        'guard_file_exists' => is_file($guard),
        'guard_file_has_php_flag' => is_file($guard)
            && strpos((string)@file_get_contents($guard), 'php_flag') !== false,
        'public_base_url' => (string)$config['public_base_url'],
        'max_bytes' => (int)$config['max_bytes'],
        'php_upload_max_filesize' => ini_get('upload_max_filesize'),
        'php_post_max_size' => ini_get('post_max_size'),
        'php_file_uploads' => (bool)ini_get('file_uploads'),
        'firebase_project_id' => (string)$config['firebase_project_id'],
        'allowed_origins' => array_values((array)$allowedOrigins),
        'request_origin' => $origin,
        'origin_allowed' => $origin === '' || in_array($origin, (array)$allowedOrigins, true),
        'authorization_header_arrives' => isset($_SERVER['HTTP_AUTHORIZATION'])
            || isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    orbyloxJsonFail(405, 'Method not allowed');
}

/* ------------------------------------------------------------------ auth */

$user = requireFirebaseUser((string)$config['firebase_project_id']);

/* ---------------------------------------------------------------- upload */

$file = $_FILES['file'] ?? null;
if (!is_array($file) || !isset($file['tmp_name'])) {
    orbyloxJsonFail(400, 'No file received');
}
if ((int)$file['error'] !== UPLOAD_ERR_OK) {
    $phpLimits = [
        UPLOAD_ERR_INI_SIZE => 'File exceeds the server limit (upload_max_filesize)',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds the form limit',
        UPLOAD_ERR_PARTIAL => 'Upload was interrupted',
        UPLOAD_ERR_NO_FILE => 'No file received',
        UPLOAD_ERR_NO_TMP_DIR => 'Server has no temp directory',
        UPLOAD_ERR_CANT_WRITE => 'Server could not write the file',
    ];
    orbyloxJsonFail(400, $phpLimits[(int)$file['error']] ?? 'Upload failed');
}
if (!is_uploaded_file((string)$file['tmp_name'])) {
    orbyloxJsonFail(400, 'Invalid upload');
}

$size = (int)$file['size'];
$maxBytes = (int)$config['max_bytes'];
if ($size <= 0) {
    orbyloxJsonFail(400, 'Empty file');
}
if ($size > $maxBytes) {
    orbyloxJsonFail(413, 'File too large (max ' . (int)round($maxBytes / 1048576) . ' MB)');
}

$originalName = (string)($file['name'] ?? 'datei');
$extension = strtolower((string)pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExtensions = array_map('strtolower', (array)$config['allowed_extensions']);
if ($extension === '' || !in_array($extension, $allowedExtensions, true)) {
    orbyloxJsonFail(415, 'File type not allowed: .' . ($extension !== '' ? $extension : 'unknown'));
}

/** Keep umlauts and Cyrillic readable, drop everything that could break a path. */
function safeFileName(string $name): string
{
    $base = (string)pathinfo($name, PATHINFO_FILENAME);
    $base = preg_replace('/[\x00-\x1F\x7F\/\\\\:*?"<>|]+/u', '', $base) ?? '';
    $base = preg_replace('/\s+/u', ' ', $base) ?? '';
    $base = trim($base, " .-");
    if (function_exists('mb_substr')) {
        $base = mb_substr($base, 0, 80, 'UTF-8');
    } else {
        $base = substr($base, 0, 80);
    }
    return $base !== '' ? $base : 'datei';
}

$uid = preg_replace('/[^A-Za-z0-9_-]/', '', $user['uid']) ?? '';
if ($uid === '') {
    orbyloxJsonFail(401, 'Invalid user id');
}

$targetDir = rtrim((string)$config['upload_dir'], '/') . '/' . $uid;
if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
    orbyloxJsonFail(500, 'Could not create upload directory');
}

/**
 * Nichts im Upload-Verzeichnis darf je vom Webserver ausgefuehrt werden.
 *
 * `php_flag` steht bewusst in einem IfModule-Block: Die Anweisung kennt nur
 * mod_php. Laeuft PHP als FPM oder unter LiteSpeed, ist sie unbekannt — und
 * eine unbekannte Anweisung in .htaccess beantwortet Apache mit 500 fuer das
 * ganze Verzeichnis. Ausgerechnet die Schutzdatei haette dann jede
 * hochgeladene Datei unerreichbar gemacht.
 *
 * Der eigentliche Schutz ist ohnehin `AddType text/plain`: Damit wird jedes
 * Skript als Text ausgeliefert statt ausgefuehrt, und das versteht jeder
 * Webserver.
 */
$guardBody = "AddType text/plain .php .phtml .php3 .php4 .php5 .php7 .phar .cgi .pl .py .sh\n"
    . "<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n"
    . "<IfModule mod_php7.c>\n  php_flag engine off\n</IfModule>\n"
    . "<IfModule mod_php8.c>\n  php_flag engine off\n</IfModule>\n"
    . "<IfModule mod_rewrite.c>\n  RewriteEngine Off\n</IfModule>\n";

$guard = rtrim((string)$config['upload_dir'], '/') . '/.htaccess';
$guardCurrent = is_file($guard) ? (string)@file_get_contents($guard) : null;
// Auch bestehende Anlagen nachziehen: die erste Fassung begann mit einem
// ungeschuetzten php_flag und konnte genau diesen 500er ausloesen.
$guardNeedsFix = $guardCurrent !== null
    && preg_match('/^\s*php_flag/m', $guardCurrent)
    && strpos($guardCurrent, '<IfModule mod_php') === false;
if ($guardCurrent === null || $guardNeedsFix) {
    @file_put_contents($guard, $guardBody);
}

$token = bin2hex(random_bytes(8));
$fileName = $token . '_' . safeFileName($originalName) . '.' . $extension;
$targetPath = $targetDir . '/' . $fileName;

if (!move_uploaded_file((string)$file['tmp_name'], $targetPath)) {
    orbyloxJsonFail(500, 'Could not store the file');
}
@chmod($targetPath, 0644);

$fileUrl = rtrim((string)$config['public_base_url'], '/') . '/' . rawurlencode($uid) . '/' . rawurlencode($fileName);

echo json_encode([
    'file_url' => $fileUrl,
    'name' => $originalName,
    'size' => $size,
], JSON_UNESCAPED_UNICODE);
