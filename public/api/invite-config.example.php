<?php
/**
 * Copy this file to invite-config.php on the server and fill in secrets.
 * Never commit invite-config.php (it is in .gitignore).
 */
return [
    // Must match VITE_INVITE_API_KEY in your frontend .env (build-time).
    'api_key' => 'generate-a-long-random-string',

    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_user' => 'invite@orbylox.de',
    'smtp_pass' => 'YOUR_MAILBOX_PASSWORD',

    'from_email' => 'invite@orbylox.de',
    'from_name' => 'ORBYLOX',
    'reply_to' => 'invite@orbylox.de',

    // Optional: restrict CORS (empty = reflect request Origin if HTTPS).
    'allowed_origins' => [
        'https://orbylox.de',
        'https://www.orbylox.de',
    ],
];
