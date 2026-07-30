<?php
declare(strict_types=1);

/**
 * POST JSON: { "to", "projectId", "appUrl", "language", "projectName", "inviterName" }
 * Header:    Authorization: Bearer <Firebase ID token>
 *
 * The caller must be signed in AND able to read the project — checked against the
 * Firestore rules — so this endpoint cannot be abused as an open mail relay.
 * A legacy X-Invite-Api-Key is still accepted when invite-config.php defines one.
 *
 * Requires: composer install in this directory (vendor/autoload.php).
 */

header('Content-Type: application/json; charset=utf-8');

/**
 * The config is looked up outside the deployed folder first: dist/ replaces
 * public_html/api on every deploy, and a config living there gets wiped.
 * Recommended location: one level above public_html.
 */
$configCandidates = [
    dirname(dirname(__DIR__)) . '/invite-config.php', // …/orbylox-config next to public_html
    dirname(__DIR__) . '/invite-config.php',          // public_html/invite-config.php
    __DIR__ . '/invite-config.php',                   // public_html/api/invite-config.php
];

$configPath = null;
foreach ($configCandidates as $candidate) {
    if (is_file($candidate)) {
        $configPath = $candidate;
        break;
    }
}

if ($configPath === null) {
    http_response_code(500);
    echo json_encode([
        'error' => 'invite-config.php nicht gefunden. Erwartet in: ' . implode(' | ', $configCandidates),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/** @var array $config */
$config = require $configPath;

// PHPMailer when it happens to be installed, otherwise the bundled SMTP client —
// no Composer step needed on the server.
$autoload = __DIR__ . '/vendor/autoload.php';
$hasPhpMailer = false;
if (is_file($autoload)) {
    require $autoload;
    $hasPhpMailer = class_exists(\PHPMailer\PHPMailer\PHPMailer::class);
}
if (!$hasPhpMailer) {
    require_once __DIR__ . '/smtp-mailer.php';
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = $config['allowed_origins'] ?? [];

function corsHeaders(string $origin, array $allowed): void
{
    if ($allowed) {
        if ($origin !== '' && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
        return;
    }
    if ($origin !== '' && strpos($origin, 'https://') === 0) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    corsHeaders($origin, $allowed);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Invite-Api-Key');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

corsHeaders($origin, $allowed);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Invite-Api-Key');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/firebase-auth.php';

$firebaseProjectId = (string)($config['firebase_project_id'] ?? 'orbylox');
$legacyKey = $_SERVER['HTTP_X_INVITE_API_KEY'] ?? '';
$configuredKey = (string)($config['api_key'] ?? '');
$authorized = false;

if ($legacyKey !== '' && $configuredKey !== '' && hash_equals($configuredKey, $legacyKey)) {
    $authorized = true; // legacy path, kept so older builds keep working
} else {
    $inviter = requireFirebaseUser($firebaseProjectId);
    $authorized = true;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$to = trim((string)($data['to'] ?? ''));
$projectId = trim((string)($data['projectId'] ?? ''));
$appUrl = trim((string)($data['appUrl'] ?? 'https://orbylox.de'));
$subject = trim((string)($data['subject'] ?? ''));
$bodyText = trim((string)($data['bodyText'] ?? ''));
$language = strtolower(trim((string)($data['language'] ?? 'de'))) === 'en' ? 'en' : 'de';
$projectName = trim((string)($data['projectName'] ?? ''));
$inviterName = trim((string)($data['inviterName'] ?? ''));

if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid recipient']);
    exit;
}
if ($projectId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing projectId']);
    exit;
}
if (isset($inviter) && !orbyloxCanAccessProject($inviter['token'], $firebaseProjectId, $projectId)) {
    http_response_code(403);
    echo json_encode(['error' => 'Kein Zugriff auf dieses Projekt.']);
    exit;
}
if ($inviterName === '' && isset($inviter['email']) && $inviter['email']) {
    $inviterName = (string)$inviter['email'];
}

require_once __DIR__ . '/invite-template.php';

$base = rtrim($appUrl, '/');
$inviteLink = $base . '/login?project=' . rawurlencode($projectId);

if ($subject === '') {
    $subject = inviteSubject($language, $projectName);
}
$bodyHtml = inviteHtml($language, $inviteLink, $projectName, $inviterName, $base);
if ($bodyText === '') {
    $bodyText = inviteText($language, $inviteLink, $projectName, $inviterName);
}

$smtpHost = (string)($config['smtp_host'] ?? 'smtp.hostinger.com');
$smtpPort = (int)($config['smtp_port'] ?? 465);
$smtpUser = (string)($config['smtp_user'] ?? '');
$smtpPass = (string)($config['smtp_pass'] ?? '');
$fromEmail = (string)($config['from_email'] ?? $smtpUser);
$fromName = (string)($config['from_name'] ?? 'ORBYLOX');
$replyTo = (string)($config['reply_to'] ?? $fromEmail);

if ($smtpUser === '' || $smtpPass === '') {
    http_response_code(500);
    echo json_encode(['error' => 'SMTP not configured in invite-config.php']);
    exit;
}

try {
    if ($hasPhpMailer) {
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->SMTPSecure = $smtpPort === 465
            ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
            : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $smtpPort;
        $mail->CharSet = 'UTF-8';

        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($to);
        $mail->addReplyTo($replyTo);

        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body = $bodyHtml;
        // Plain-text twin for clients that block HTML — and it keeps spam scores down.
        $mail->AltBody = $bodyText;

        $mail->send();
    } else {
        sendSmtpMail([
            'host' => $smtpHost,
            'port' => $smtpPort,
            'user' => $smtpUser,
            'pass' => $smtpPass,
            'from_email' => $fromEmail,
            'from_name' => $fromName,
            'reply_to' => $replyTo,
            'to' => $to,
            'subject' => $subject,
            'text' => $bodyText,
            'html' => $bodyHtml,
        ]);
    }

    echo json_encode(['status' => 'ok', 'mailer' => $hasPhpMailer ? 'phpmailer' : 'builtin']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
