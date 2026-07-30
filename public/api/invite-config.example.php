<?php
/**
 * Copy this file to invite-config.php on the server and fill in the mailbox password.
 * invite-config.php is gitignored and must never be committed.
 */
return [
    // Firebase project id — the ID token audience is checked against this.
    'firebase_project_id' => 'orbylox',

    // --- SMTP (Hostinger mailbox) ---
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_user' => 'invite@orbylox.de',
    'smtp_pass' => 'HIER_DAS_POSTFACH_PASSWORT',

    'from_email' => 'invite@orbylox.de',
    'from_name' => 'ORBYLOX',
    'reply_to' => 'invite@orbylox.de',

    'allowed_origins' => [
        'https://orbylox.de',
        'https://www.orbylox.de',
        'http://localhost:5173',
        'http://localhost:4173',
    ],

    // Optional legacy shared key. Leave empty — authorisation now runs through the
    // Firebase ID token plus a project access check.
    'api_key' => '',
];
