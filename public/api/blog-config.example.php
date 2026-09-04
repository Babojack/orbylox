<?php
/**
 * Kopiere diese Datei nach blog-config.php und trage deine Werte ein.
 * blog-config.php ist per .gitignore ausgeschlossen und wird nie eingecheckt.
 *
 * Wenn invite-config.php bereits ein firebase_project_id enthaelt, kann diese
 * Datei entfallen — blog-admin.php liest beide.
 */
return [
    // Firebase-Projekt-ID (Firebase Console -> Projekteinstellungen)
    'firebase_project_id' => 'DEINE-FIREBASE-PROJEKT-ID',

    // Wer den Blog bearbeiten darf. Kleinschreibung.
    'admin_emails' => [
        'jey.afandiyev@gmail.com',
        'gudfransen@gmail.com',
    ],
];
