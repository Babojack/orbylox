<?php
/**
 * Optional. Copy to upload-config.php on the server only if the defaults in
 * upload.php do not fit your hosting layout. Every key is optional.
 */
return [
    // Must match VITE_FIREBASE_PROJECT_ID in the frontend .env.
    'firebase_project_id' => 'orbylox',

    'allowed_origins' => [
        'https://orbylox.de',
        'https://www.orbylox.de',
        'http://localhost:5173',
        'http://localhost:4173',
    ],

    // Absolute path on the server. Default is public_html/uploads.
    'upload_dir' => dirname(__DIR__) . '/uploads',

    // Public URL that serves upload_dir.
    'public_base_url' => 'https://orbylox.de/uploads',

    // Hard limit per file. Hostinger's php.ini (upload_max_filesize,
    // post_max_size) still applies and may be lower.
    'max_bytes' => 25 * 1024 * 1024,
];
