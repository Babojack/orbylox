<?php
declare(strict_types=1);

/**
 * Projekt-Assistent — Vermittler zwischen der Anwendung und OpenAI.
 *
 * WARUM DAS SERVERSEITIG LIEGT
 * Ein API-Schluessel im Frontend-Bundle ist oeffentlich. Vite backt jede
 * VITE_-Variable in die ausgelieferte JavaScript-Datei; jeder Besucher koennte
 * sie auslesen und den Schluessel auf fremde Rechnung verbrauchen. Deshalb
 * liegt er hier, in derselben Datei wie die SMTP-Zugangsdaten, und der Browser
 * spricht nur mit diesem Endpunkt.
 *
 * WAS DER ASSISTENT DARF
 * Nichts. Er antwortet mit Text und mit Vorschlaegen; angelegt wird
 * ausschliesslich in der Anwendung, nach ausdruecklicher Bestaetigung. Dieser
 * Endpunkt schreibt in keine Datenbank — er kann es gar nicht.
 *
 * POST JSON:
 *   { message, history: [{role, content}], context: {project, tasks, members} }
 * Kopfzeile:
 *   Authorization: Bearer <Firebase ID token>
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

$defaults = [
    'firebase_project_id' => 'orbylox',
    'openai_api_key' => '',
    'openai_model' => 'gpt-4o-mini',
    'allowed_origins' => [
        'https://orbylox.de',
        'https://www.orbylox.de',
        'http://localhost:5173',
        'http://localhost:4173',
    ],
    // Obergrenzen. Der Schluessel gehoert dem Betreiber; eine offene
    // Weiterleitung waere eine Einladung, ihn leerzuschreiben.
    'max_message_chars' => 4000,
    'max_context_tasks' => 120,
    'max_history' => 12,
];

$config = $defaults;
/**
 * Konfiguration an denselben drei Orten suchen wie send-invite.php.
 *
 * Vorher stand hier nur __DIR__: In der Anleitung zu send-invite.php wird
 * empfohlen, die Datei EINE EBENE UEBER public_html zu legen, weil ein Deploy
 * public_html/api ersetzt und eine Konfiguration darin mitloescht. Wer dieser
 * Empfehlung folgt, haette hier auf einmal keine Einstellungen mehr — ohne
 * dass irgendetwas darauf hindeutet. Drei Endpunkte duerfen nicht an drei
 * verschiedenen Orten suchen.
 */
$configCandidates = [
    dirname(dirname(__DIR__)) . '/invite-config.php',
    dirname(__DIR__) . '/invite-config.php',
    __DIR__ . '/invite-config.php',
    __DIR__ . '/blog-config.php',
];
foreach ($configCandidates as $f) {
    if (is_file($f)) {
        $c = require $f;
        if (is_array($c)) $config = array_merge($config, $c);
    }
}

require_once __DIR__ . '/firebase-auth.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = (array)($config['allowed_origins'] ?? []);
if ($origin !== '' && in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

/* ------------------------------------------------------------- Diagnose */
if (($_GET['action'] ?? '') === 'diag') {
    $key = (string)$config['openai_api_key'];
    echo json_encode([
        'ok' => true,
        'note' => 'Diese Seite kommt aus assistant.php. Sie zeigt nie den Schluessel, nur ob einer da ist.',
        'php_version' => PHP_VERSION,
        'key_configured' => $key !== '',
        'key_length' => strlen($key),
        'key_looks_like_openai' => $key !== '' && str_starts_with($key, 'sk-'),
        'model' => (string)$config['openai_model'],
        'firebase_project_id' => (string)$config['firebase_project_id'],
        'curl_available' => function_exists('curl_init'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    orbyloxJsonFail(405, 'Method not allowed');
}

$apiKey = (string)$config['openai_api_key'];
if ($apiKey === '') {
    orbyloxJsonFail(503, 'Der Assistent ist noch nicht eingerichtet: In api/invite-config.php fehlt der Eintrag "openai_api_key".');
}

// Erst anmelden, dann rechnen — sonst zahlt der Betreiber fuer Fremde.
$user = requireFirebaseUser((string)$config['firebase_project_id']);

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) orbyloxJsonFail(400, 'Invalid JSON');

$message = trim((string)($data['message'] ?? ''));
if ($message === '') orbyloxJsonFail(400, 'Leere Nachricht.');
if (mb_strlen($message) > (int)$config['max_message_chars']) {
    orbyloxJsonFail(413, 'Nachricht zu lang.');
}

/* ------------------------------------------------------- Projektkontext */

$ctx = is_array($data['context'] ?? null) ? $data['context'] : [];
$project = is_array($ctx['project'] ?? null) ? $ctx['project'] : [];
$tasks = is_array($ctx['tasks'] ?? null) ? $ctx['tasks'] : [];
$members = is_array($ctx['members'] ?? null) ? $ctx['members'] : [];

$tasks = array_slice($tasks, 0, (int)$config['max_context_tasks']);

$lines = [];
foreach ($tasks as $t) {
    if (!is_array($t)) continue;
    $bits = [
        'id: ' . substr((string)($t['id'] ?? ''), 0, 40),
        'titel: ' . mb_substr((string)($t['title'] ?? ''), 0, 120),
        'status: ' . (string)($t['status'] ?? ''),
    ];
    if (!empty($t['story_points'])) $bits[] = 'punkte: ' . (int)$t['story_points'];
    if (!empty($t['assignees'])) $bits[] = 'wer: ' . implode('/', array_slice((array)$t['assignees'], 0, 3));
    if (!empty($t['depends_on'])) $bits[] = 'wartet auf: ' . implode('/', array_slice((array)$t['depends_on'], 0, 6));
    $lines[] = '- ' . implode(', ', $bits);
}
$taskBlock = $lines ? implode("\n", $lines) : '(noch keine Tickets)';

$lang = ($data['language'] ?? 'de') === 'en' ? 'en' : 'de';

$system = $lang === 'en'
    ? "You are the project assistant inside ORBYLOX, a project management tool.\n"
      . "You help with planning: breaking work into tickets, assigning them, estimating effort, spotting missing steps and dependencies, and brainstorming.\n\n"
      . "Rules:\n"
      . "- You never change anything yourself. You propose; the user decides. Say so if they expect otherwise.\n"
      . "- Ticket titles are short and concrete: an action, not a topic. 'Set up payment provider', not 'Payments'.\n"
      . "- Story points use the Fibonacci scale 1,2,3,5,8,13,21. Above 8, say the ticket should be split.\n"
      . "- Only assign people from the member list. If unsure, leave it empty rather than guessing.\n"
      . "- Only reference dependencies by the exact ids from the ticket list.\n"
      . "- Be brief. Do not repeat the ticket list back."
    : "Du bist der Projekt-Assistent in ORBYLOX, einem Projektmanagement-Werkzeug.\n"
      . "Du hilfst beim Planen: Arbeit in Tickets zerlegen, zuweisen, Aufwand schaetzen, fehlende Schritte und Abhaengigkeiten erkennen, brainstormen.\n\n"
      . "Regeln:\n"
      . "- Du aenderst nie selbst etwas. Du schlaegst vor, entschieden wird in der Anwendung. Sag das, wenn jemand etwas anderes erwartet.\n"
      . "- Tickettitel sind kurz und konkret: eine Taetigkeit, kein Thema. 'Zahlungsanbieter anbinden', nicht 'Zahlungen'.\n"
      . "- Story Points in Fibonacci: 1,2,3,5,8,13,21. Ueber 8 sagst du dazu, dass das Ticket geteilt gehoert.\n"
      . "- Weise nur Personen aus der Mitgliederliste zu. Im Zweifel niemanden statt geraten.\n"
      . "- Verweise auf Abhaengigkeiten nur mit den genauen ids aus der Ticketliste.\n"
      . "- Fasse dich kurz. Zaehl die Ticketliste nicht zurueck.";

$contextMsg = "PROJEKT: " . mb_substr((string)($project['name'] ?? 'Ohne Namen'), 0, 120) . "\n"
    . "BESCHREIBUNG: " . mb_substr((string)($project['description'] ?? '-'), 0, 600) . "\n"
    . "MITGLIEDER: " . (count($members) ? implode(', ', array_slice($members, 0, 20)) : '(nur du)') . "\n"
    . "TICKETS:\n" . $taskBlock;

$messages = [
    ['role' => 'system', 'content' => $system],
    ['role' => 'system', 'content' => $contextMsg],
];
foreach (array_slice((array)($data['history'] ?? []), -(int)$config['max_history']) as $h) {
    $role = ($h['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
    $content = mb_substr((string)($h['content'] ?? ''), 0, 2000);
    if ($content !== '') $messages[] = ['role' => $role, 'content' => $content];
}
$messages[] = ['role' => 'user', 'content' => $message];

/**
 * Feste Antwortform.
 *
 * Ohne Schema kommt mal Prosa, mal eine Aufzaehlung, mal JSON in einem
 * Codeblock — und die Oberflaeche muesste raten. Mit Schema ist die Antwort
 * immer dieselbe Struktur, und "keine Vorschlaege" ist eine leere Liste
 * statt einer Formulierung, die man erkennen muss.
 */
$schema = [
    'type' => 'object',
    'additionalProperties' => false,
    'required' => ['reply', 'suggestions'],
    'properties' => [
        'reply' => ['type' => 'string', 'description' => 'Kurze Antwort an die Person.'],
        'suggestions' => [
            'type' => 'array',
            'description' => 'Vorgeschlagene neue Tickets. Leer, wenn nichts vorzuschlagen ist.',
            'items' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['title', 'description', 'priority', 'story_points', 'assignee_email', 'depends_on'],
                'properties' => [
                    'title' => ['type' => 'string'],
                    'description' => ['type' => 'string'],
                    'priority' => ['type' => 'string', 'enum' => ['low', 'medium', 'high']],
                    'story_points' => ['type' => 'integer', 'enum' => [0, 1, 2, 3, 5, 8, 13, 21]],
                    'assignee_email' => ['type' => 'string', 'description' => 'Leer lassen, wenn unklar.'],
                    'depends_on' => [
                        'type' => 'array',
                        'description' => 'ids bestehender Tickets aus der Liste.',
                        'items' => ['type' => 'string'],
                    ],
                ],
            ],
        ],
    ],
];

$payload = [
    'model' => (string)$config['openai_model'],
    'messages' => $messages,
    'temperature' => 0.4,
    'response_format' => [
        'type' => 'json_schema',
        'json_schema' => ['name' => 'orbylox_assistant', 'strict' => true, 'schema' => $schema],
    ],
];

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
]);
$res = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($res === false) {
    orbyloxJsonFail(502, 'Keine Verbindung zu OpenAI: ' . substr($curlErr, 0, 200));
}
$json = json_decode((string)$res, true);

if ($code !== 200) {
    // Die Meldung von OpenAI durchreichen — "Fehler 429" allein hilft niemandem
    // beim Unterscheiden von Guthaben leer, Schluessel falsch und zu schnell.
    $why = (string)($json['error']['message'] ?? substr((string)$res, 0, 300));
    orbyloxJsonFail($code === 401 ? 401 : 502, 'OpenAI (' . $code . '): ' . $why);
}

$content = (string)($json['choices'][0]['message']['content'] ?? '');
$parsed = json_decode($content, true);
if (!is_array($parsed)) {
    orbyloxJsonFail(502, 'Unerwartete Antwortform von OpenAI.');
}

echo json_encode([
    'reply' => (string)($parsed['reply'] ?? ''),
    'suggestions' => array_values(array_filter(
        (array)($parsed['suggestions'] ?? []),
        static fn ($s) => is_array($s) && trim((string)($s['title'] ?? '')) !== '',
    )),
    'usage' => [
        'prompt_tokens' => (int)($json['usage']['prompt_tokens'] ?? 0),
        'completion_tokens' => (int)($json['usage']['completion_tokens'] ?? 0),
    ],
], JSON_UNESCAPED_UNICODE);
