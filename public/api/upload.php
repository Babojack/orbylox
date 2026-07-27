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

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = $config['allowed_origins'] ?? [];

function sendCors(string $origin, array $allowed): void
{
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
}

function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'Method not allowed');
}

/* ------------------------------------------------------------------ auth */

function base64UrlDecode(string $input): string
{
    $remainder = strlen($input) % 4;
    if ($remainder) {
        $input .= str_repeat('=', 4 - $remainder);
    }
    return (string)base64_decode(strtr($input, '-_', '+/'), true);
}

function httpGet(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($body !== false && $status === 200) ? (string)$body : null;
    }
    $body = @file_get_contents($url);
    return $body === false ? null : $body;
}

/** Google's public signing certificates, cached on disk for their max-age. */
function googleSigningCerts(): array
{
    $cacheFile = sys_get_temp_dir() . '/orbylox_firebase_certs.json';
    if (is_file($cacheFile) && (time() - (int)filemtime($cacheFile)) < 3600) {
        $cached = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($cached) && $cached) {
            return $cached;
        }
    }
    $body = httpGet('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if ($body === null) {
        return [];
    }
    $certs = json_decode($body, true);
    if (!is_array($certs) || !$certs) {
        return [];
    }
    @file_put_contents($cacheFile, $body);
    return $certs;
}

/** @return array{uid:string,email:?string} */
function verifyFirebaseIdToken(string $jwt, string $projectId): array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        fail(401, 'Malformed token');
    }
    [$headerB64, $payloadB64, $signatureB64] = $parts;

    $header = json_decode(base64UrlDecode($headerB64), true);
    $claims = json_decode(base64UrlDecode($payloadB64), true);
    if (!is_array($header) || !is_array($claims)) {
        fail(401, 'Malformed token');
    }
    if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
        fail(401, 'Unexpected token algorithm');
    }

    $certs = googleSigningCerts();
    $cert = $certs[$header['kid']] ?? null;
    if (!$cert) {
        fail(401, 'Unknown signing key');
    }

    $signature = base64UrlDecode($signatureB64);
    $verified = openssl_verify($headerB64 . '.' . $payloadB64, $signature, $cert, OPENSSL_ALGO_SHA256);
    if ($verified !== 1) {
        fail(401, 'Invalid token signature');
    }

    $now = time();
    $leeway = 60;
    if (($claims['aud'] ?? '') !== $projectId) {
        fail(401, 'Token audience mismatch');
    }
    if (($claims['iss'] ?? '') !== 'https://securetoken.google.com/' . $projectId) {
        fail(401, 'Token issuer mismatch');
    }
    if ((int)($claims['exp'] ?? 0) < $now - $leeway) {
        fail(401, 'Token expired');
    }
    if ((int)($claims['iat'] ?? 0) > $now + $leeway) {
        fail(401, 'Token issued in the future');
    }
    $uid = (string)($claims['sub'] ?? '');
    if ($uid === '') {
        fail(401, 'Token without subject');
    }

    return ['uid' => $uid, 'email' => isset($claims['email']) ? (string)$claims['email'] : null];
}

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($authHeader === '' && function_exists('apache_request_headers')) {
    $headers = array_change_key_case((array)apache_request_headers(), CASE_LOWER);
    $authHeader = (string)($headers['authorization'] ?? '');
}
if (stripos($authHeader, 'Bearer ') !== 0) {
    fail(401, 'Missing Authorization header');
}
$user = verifyFirebaseIdToken(trim(substr($authHeader, 7)), (string)$config['firebase_project_id']);

/* ---------------------------------------------------------------- upload */

$file = $_FILES['file'] ?? null;
if (!is_array($file) || !isset($file['tmp_name'])) {
    fail(400, 'No file received');
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
    fail(400, $phpLimits[(int)$file['error']] ?? 'Upload failed');
}
if (!is_uploaded_file((string)$file['tmp_name'])) {
    fail(400, 'Invalid upload');
}

$size = (int)$file['size'];
$maxBytes = (int)$config['max_bytes'];
if ($size <= 0) {
    fail(400, 'Empty file');
}
if ($size > $maxBytes) {
    fail(413, 'File too large (max ' . (int)round($maxBytes / 1048576) . ' MB)');
}

$originalName = (string)($file['name'] ?? 'datei');
$extension = strtolower((string)pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExtensions = array_map('strtolower', (array)$config['allowed_extensions']);
if ($extension === '' || !in_array($extension, $allowedExtensions, true)) {
    fail(415, 'File type not allowed: .' . ($extension !== '' ? $extension : 'unknown'));
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
    fail(401, 'Invalid user id');
}

$targetDir = rtrim((string)$config['upload_dir'], '/') . '/' . $uid;
if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
    fail(500, 'Could not create upload directory');
}

// Never let anything in the upload tree be executed by the web server.
$guard = rtrim((string)$config['upload_dir'], '/') . '/.htaccess';
if (!is_file($guard)) {
    @file_put_contents(
        $guard,
        "php_flag engine off\n"
        . "AddType text/plain .php .phtml .php3 .php4 .php5 .php7 .phar .cgi .pl .py .sh\n"
        . "<IfModule mod_rewrite.c>\n  RewriteEngine Off\n</IfModule>\n"
    );
}

$token = bin2hex(random_bytes(8));
$fileName = $token . '_' . safeFileName($originalName) . '.' . $extension;
$targetPath = $targetDir . '/' . $fileName;

if (!move_uploaded_file((string)$file['tmp_name'], $targetPath)) {
    fail(500, 'Could not store the file');
}
@chmod($targetPath, 0644);

$fileUrl = rtrim((string)$config['public_base_url'], '/') . '/' . rawurlencode($uid) . '/' . rawurlencode($fileName);

echo json_encode([
    'file_url' => $fileUrl,
    'name' => $originalName,
    'size' => $size,
], JSON_UNESCAPED_UNICODE);
