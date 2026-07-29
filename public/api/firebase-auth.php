<?php
declare(strict_types=1);

/**
 * Shared Firebase ID token verification for the ORBYLOX PHP endpoints.
 *
 * Verifies the RS256 signature against Google's published certificates and checks
 * issuer, audience and expiry. Include this file, then call requireFirebaseUser().
 */

if (!function_exists('orbyloxJsonFail')) {
    function orbyloxJsonFail(int $status, string $message): void
    {
        http_response_code($status);
        echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function orbyloxBase64UrlDecode(string $input): string
{
    $remainder = strlen($input) % 4;
    if ($remainder) {
        $input .= str_repeat('=', 4 - $remainder);
    }
    return (string)base64_decode(strtr($input, '-_', '+/'), true);
}

function orbyloxHttpGet(string $url, array $headers = []): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => $headers,
        ]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($body !== false && $status >= 200 && $status < 300) ? (string)$body : null;
    }
    $context = stream_context_create([
        'http' => ['header' => implode("\r\n", $headers), 'timeout' => 15],
    ]);
    $body = @file_get_contents($url, false, $context);
    return $body === false ? null : $body;
}

/** Google's public signing certificates, cached on disk for an hour. */
function orbyloxGoogleSigningCerts(): array
{
    $cacheFile = sys_get_temp_dir() . '/orbylox_firebase_certs.json';
    if (is_file($cacheFile) && (time() - (int)filemtime($cacheFile)) < 3600) {
        $cached = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($cached) && $cached) {
            return $cached;
        }
    }
    $body = orbyloxHttpGet('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
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

/** @return array{uid:string,email:?string,token:string} */
function orbyloxVerifyIdToken(string $jwt, string $projectId): array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        orbyloxJsonFail(401, 'Malformed token');
    }
    [$headerB64, $payloadB64, $signatureB64] = $parts;

    $header = json_decode(orbyloxBase64UrlDecode($headerB64), true);
    $claims = json_decode(orbyloxBase64UrlDecode($payloadB64), true);
    if (!is_array($header) || !is_array($claims)) {
        orbyloxJsonFail(401, 'Malformed token');
    }
    if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
        orbyloxJsonFail(401, 'Unexpected token algorithm');
    }

    $certs = orbyloxGoogleSigningCerts();
    $cert = $certs[$header['kid']] ?? null;
    if (!$cert) {
        orbyloxJsonFail(401, 'Unknown signing key');
    }

    $signature = orbyloxBase64UrlDecode($signatureB64);
    if (openssl_verify($headerB64 . '.' . $payloadB64, $signature, $cert, OPENSSL_ALGO_SHA256) !== 1) {
        orbyloxJsonFail(401, 'Invalid token signature');
    }

    $now = time();
    $leeway = 60;
    if (($claims['aud'] ?? '') !== $projectId) {
        orbyloxJsonFail(401, 'Token audience mismatch');
    }
    if (($claims['iss'] ?? '') !== 'https://securetoken.google.com/' . $projectId) {
        orbyloxJsonFail(401, 'Token issuer mismatch');
    }
    if ((int)($claims['exp'] ?? 0) < $now - $leeway) {
        orbyloxJsonFail(401, 'Token expired');
    }
    if ((int)($claims['iat'] ?? 0) > $now + $leeway) {
        orbyloxJsonFail(401, 'Token issued in the future');
    }
    $uid = (string)($claims['sub'] ?? '');
    if ($uid === '') {
        orbyloxJsonFail(401, 'Token without subject');
    }

    return [
        'uid' => $uid,
        'email' => isset($claims['email']) ? (string)$claims['email'] : null,
        'token' => $jwt,
    ];
}

function orbyloxBearerToken(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = array_change_key_case((array)apache_request_headers(), CASE_LOWER);
        $header = (string)($headers['authorization'] ?? '');
    }
    if (stripos($header, 'Bearer ') !== 0) {
        orbyloxJsonFail(401, 'Missing Authorization header');
    }
    return trim(substr($header, 7));
}

/** @return array{uid:string,email:?string,token:string} */
function requireFirebaseUser(string $firebaseProjectId): array
{
    return orbyloxVerifyIdToken(orbyloxBearerToken(), $firebaseProjectId);
}

/**
 * Authorization without a service account: ask Firestore with the caller's own
 * token. If the security rules let them read the Project document, they are a
 * member — no separate permission model to keep in sync.
 */
function orbyloxCanAccessProject(string $idToken, string $firebaseProjectId, string $projectDocId): bool
{
    if ($projectDocId === '') {
        return false;
    }
    $url = sprintf(
        'https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/Project/%s',
        rawurlencode($firebaseProjectId),
        rawurlencode($projectDocId)
    );
    $body = orbyloxHttpGet($url, ['Authorization: Bearer ' . $idToken]);
    return $body !== null;
}
