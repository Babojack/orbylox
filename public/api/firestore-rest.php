<?php
/**
 * Lesender Zugriff auf Firestore aus PHP heraus.
 *
 * Warum das nötig ist: Erinnerungen sollen ankommen, auch wenn niemand die
 * Seite offen hat. Ein Cron-Job läuft auf dem Server — dort gibt es keinen
 * angemeldeten Nutzer, also auch kein ID-Token. Der Zugriff läuft deshalb
 * über ein Dienstkonto (service account).
 *
 * Der Weg dorthin in drei Schritten:
 *   1. Aus dem privaten Schlüssel des Dienstkontos ein JWT bauen und mit
 *      RS256 signieren (openssl, in PHP eingebaut — kein Composer nötig).
 *   2. Dieses JWT bei Google gegen ein Zugriffstoken tauschen.
 *   3. Mit dem Token die Firestore-REST-Schnittstelle abfragen.
 *
 * Das Dienstkonto umgeht die Sicherheitsregeln — deshalb wird hier
 * ausschließlich gelesen, nie geschrieben, und die Schlüsseldatei liegt
 * außerhalb des Webverzeichnisses.
 */

declare(strict_types=1);

class FirestoreRestException extends RuntimeException {}

function fsBase64Url(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

/**
 * Schlüsseldatei des Dienstkontos finden.
 * Bevorzugt außerhalb von public_html — dort ist sie per URL nicht abrufbar.
 */
function fsServiceAccountPath(): ?string
{
    $candidates = [
        dirname(__DIR__, 2) . '/orbylox-data/service-account.json',
        dirname(__DIR__, 2) . '/service-account.json',
        __DIR__ . '/service-account.json',
    ];
    foreach ($candidates as $p) {
        if (is_file($p) && is_readable($p)) return $p;
    }
    return null;
}

function fsServiceAccount(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $path = fsServiceAccountPath();
    if ($path === null) {
        throw new FirestoreRestException(
            'service-account.json nicht gefunden. Erwartet neben dem Datenordner '
            . '(…/orbylox-data/service-account.json).'
        );
    }
    $data = json_decode((string)file_get_contents($path), true);
    if (!is_array($data) || empty($data['client_email']) || empty($data['private_key'])) {
        throw new FirestoreRestException('service-account.json ist unvollständig (client_email/private_key fehlen).');
    }
    $cache = $data;
    return $cache;
}

/**
 * Zugriffstoken holen. Google gibt es für eine Stunde aus; wir merken es uns
 * für 50 Minuten in einer Datei, damit ein Cron-Lauf nicht jedes Mal neu
 * verhandelt.
 */
function fsAccessToken(): string
{
    $sa = fsServiceAccount();
    $cacheFile = sys_get_temp_dir() . '/orbylox-fs-token-' . substr(sha1($sa['client_email']), 0, 12) . '.json';

    if (is_file($cacheFile)) {
        $c = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($c) && !empty($c['token']) && (int)($c['expires'] ?? 0) > time() + 60) {
            return (string)$c['token'];
        }
    }

    $now = time();
    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    $claims = [
        'iss'   => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/datastore',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
    ];
    $unsigned = fsBase64Url((string)json_encode($header)) . '.' . fsBase64Url((string)json_encode($claims));

    $signature = '';
    if (!openssl_sign($unsigned, $signature, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new FirestoreRestException('Signieren fehlgeschlagen — privater Schlüssel unbrauchbar?');
    }
    $jwt = $unsigned . '.' . fsBase64Url($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
    ]);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode((string)$res, true);
    if ($code !== 200 || empty($json['access_token'])) {
        throw new FirestoreRestException('Zugriffstoken abgelehnt (' . $code . '): ' . substr((string)$res, 0, 200));
    }

    @file_put_contents($cacheFile, json_encode([
        'token'   => $json['access_token'],
        'expires' => $now + 3000,
    ]));
    @chmod($cacheFile, 0600);

    return (string)$json['access_token'];
}

/** Firestore-Wert -> normaler PHP-Wert. */
function fsValue(array $v)
{
    if (array_key_exists('stringValue', $v))  return (string)$v['stringValue'];
    if (array_key_exists('integerValue', $v)) return (int)$v['integerValue'];
    if (array_key_exists('doubleValue', $v))  return (float)$v['doubleValue'];
    if (array_key_exists('booleanValue', $v)) return (bool)$v['booleanValue'];
    if (array_key_exists('timestampValue', $v)) return (string)$v['timestampValue'];
    if (array_key_exists('nullValue', $v))    return null;
    if (isset($v['arrayValue'])) {
        $out = [];
        foreach ($v['arrayValue']['values'] ?? [] as $item) $out[] = fsValue($item);
        return $out;
    }
    if (isset($v['mapValue'])) return fsFields($v['mapValue']['fields'] ?? []);
    return null;
}

/** Feldkarte eines Dokuments in ein flaches Array wandeln. */
function fsFields(array $fields): array
{
    $out = [];
    foreach ($fields as $k => $v) $out[$k] = is_array($v) ? fsValue($v) : null;
    return $out;
}

/**
 * Sammlung auslesen (runQuery).
 *
 * $where ist eine Liste aus [feld, operator, wert]; Operatoren wie bei
 * Firestore: EQUAL, NOT_EQUAL, LESS_THAN, GREATER_THAN, ARRAY_CONTAINS …
 */
function fsQuery(string $projectId, string $collection, array $where = [], int $limit = 500): array
{
    $filters = [];
    foreach ($where as [$field, $op, $value]) {
        $filters[] = [
            'fieldFilter' => [
                'field' => ['fieldPath' => $field],
                'op'    => $op,
                'value' => is_bool($value)
                    ? ['booleanValue' => $value]
                    : (is_int($value) ? ['integerValue' => (string)$value] : ['stringValue' => (string)$value]),
            ],
        ];
    }

    $structured = ['from' => [['collectionId' => $collection]], 'limit' => $limit];
    if (count($filters) === 1) $structured['where'] = $filters[0];
    elseif (count($filters) > 1) $structured['where'] = ['compositeFilter' => ['op' => 'AND', 'filters' => $filters]];

    $url = 'https://firestore.googleapis.com/v1/projects/' . rawurlencode($projectId)
         . '/databases/(default)/documents:runQuery';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . fsAccessToken(),
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode(['structuredQuery' => $structured]),
    ]);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200) {
        throw new FirestoreRestException('Firestore-Abfrage fehlgeschlagen (' . $code . '): ' . substr((string)$res, 0, 300));
    }

    $rows = json_decode((string)$res, true);
    $out = [];
    foreach (is_array($rows) ? $rows : [] as $row) {
        if (empty($row['document'])) continue;
        $doc = $row['document'];
        $id = substr((string)$doc['name'], strrpos((string)$doc['name'], '/') + 1);
        $out[] = ['id' => $id] + fsFields($doc['fields'] ?? []);
    }
    return $out;
}

/** Ein einzelnes Dokument lesen; null, wenn es nicht existiert. */
function fsGetDoc(string $projectId, string $path): ?array
{
    $url = 'https://firestore.googleapis.com/v1/projects/' . rawurlencode($projectId)
         . '/databases/(default)/documents/' . $path;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . fsAccessToken()],
    ]);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 404) return null;
    if ($code !== 200) {
        throw new FirestoreRestException('Dokument lesen fehlgeschlagen (' . $code . ')');
    }
    $doc = json_decode((string)$res, true);
    if (!is_array($doc)) return null;
    $id = substr((string)($doc['name'] ?? ''), strrpos((string)($doc['name'] ?? '/'), '/') + 1);
    return ['id' => $id] + fsFields($doc['fields'] ?? []);
}
