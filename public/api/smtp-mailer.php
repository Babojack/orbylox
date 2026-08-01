<?php
declare(strict_types=1);

/**
 * Minimal SMTP client for ORBYLOX — so the invite mail works without Composer.
 *
 * Supports implicit TLS (port 465, ssl://) and STARTTLS (port 587), AUTH LOGIN,
 * and sends a multipart/alternative message (plain text + HTML).
 *
 * Usage:
 *   sendSmtpMail([
 *     'host' => 'smtp.hostinger.com', 'port' => 465,
 *     'user' => 'invite@orbylox.de',  'pass' => '...',
 *     'from_email' => 'invite@orbylox.de', 'from_name' => 'ORBYLOX',
 *     'reply_to' => 'invite@orbylox.de',
 *     'to' => 'someone@example.com',
 *     'subject' => '…', 'text' => '…', 'html' => '…',
 *   ]);
 *
 * Throws RuntimeException with the server's reply when anything goes wrong.
 */

final class SmtpException extends RuntimeException
{
}

function smtpReadReply($socket): array
{
    $lines = [];
    while (($line = fgets($socket, 515)) !== false) {
        $lines[] = rtrim($line, "\r\n");
        // Multi-line replies keep a dash after the code: "250-STARTTLS".
        if (strlen($line) < 4 || $line[3] !== '-') {
            break;
        }
    }
    if (!$lines) {
        throw new SmtpException('SMTP: keine Antwort vom Server.');
    }
    $code = (int)substr($lines[0], 0, 3);
    return [$code, implode("\n", $lines)];
}

function smtpSend($socket, string $command, array $expected, string $what): string
{
    if ($command !== '') {
        fwrite($socket, $command . "\r\n");
    }
    [$code, $reply] = smtpReadReply($socket);
    if (!in_array($code, $expected, true)) {
        throw new SmtpException(sprintf('SMTP %s fehlgeschlagen (%d): %s', $what, $code, $reply));
    }
    return $reply;
}

/** RFC 2047 encoding so umlauts survive in Subject and display names. */
function smtpEncodeHeader(string $value): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $value) === 1) {
        return $value;
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function smtpFormatAddress(string $email, string $name = ''): string
{
    return $name !== '' ? smtpEncodeHeader($name) . ' <' . $email . '>' : $email;
}

function sendSmtpMail(array $options): void
{
    $host = (string)($options['host'] ?? '');
    $port = (int)($options['port'] ?? 465);
    $user = (string)($options['user'] ?? '');
    $pass = (string)($options['pass'] ?? '');
    $to = (string)($options['to'] ?? '');
    $fromEmail = (string)($options['from_email'] ?? $user);
    $fromName = (string)($options['from_name'] ?? '');
    $replyTo = (string)($options['reply_to'] ?? $fromEmail);
    $subject = (string)($options['subject'] ?? '');
    $text = (string)($options['text'] ?? '');
    $html = (string)($options['html'] ?? '');
    $ics = (string)($options['ics'] ?? '');

    if ($host === '' || $user === '' || $pass === '' || $to === '') {
        throw new SmtpException('SMTP: Zugangsdaten oder Empfaenger fehlen.');
    }

    $useImplicitTls = ($port === 465);
    $transport = $useImplicitTls ? 'ssl://' : 'tcp://';

    $context = stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true],
    ]);

    $socket = @stream_socket_client(
        $transport . $host . ':' . $port,
        $errno,
        $errstr,
        20,
        STREAM_CLIENT_CONNECT,
        $context
    );
    if (!$socket) {
        throw new SmtpException(sprintf('SMTP: Verbindung zu %s:%d fehlgeschlagen (%s).', $host, $port, $errstr ?: (string)$errno));
    }
    stream_set_timeout($socket, 20);

    try {
        smtpSend($socket, '', [220], 'Begruessung');

        $clientName = $_SERVER['SERVER_NAME'] ?? 'orbylox.de';
        smtpSend($socket, 'EHLO ' . $clientName, [250], 'EHLO');

        if (!$useImplicitTls) {
            smtpSend($socket, 'STARTTLS', [220], 'STARTTLS');
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new SmtpException('SMTP: TLS-Verschluesselung konnte nicht aktiviert werden.');
            }
            smtpSend($socket, 'EHLO ' . $clientName, [250], 'EHLO nach STARTTLS');
        }

        smtpSend($socket, 'AUTH LOGIN', [334], 'AUTH LOGIN');
        smtpSend($socket, base64_encode($user), [334], 'Benutzername');
        smtpSend($socket, base64_encode($pass), [235], 'Passwort');

        smtpSend($socket, 'MAIL FROM:<' . $fromEmail . '>', [250], 'MAIL FROM');
        smtpSend($socket, 'RCPT TO:<' . $to . '>', [250, 251], 'RCPT TO');
        smtpSend($socket, 'DATA', [354], 'DATA');

        $boundary = 'orbylox-' . bin2hex(random_bytes(12));
        $headers = [
            'Date: ' . date('r'),
            'From: ' . smtpFormatAddress($fromEmail, $fromName),
            'To: ' . $to,
            'Reply-To: ' . $replyTo,
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (explode('@', $fromEmail)[1] ?? 'orbylox.de') . '>',
            'Subject: ' . smtpEncodeHeader($subject),
            'MIME-Version: 1.0',
        ];

        if ($html !== '') {
            $alternative = "--{$boundary}\r\n"
                . "Content-Type: text/plain; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: base64\r\n\r\n"
                . chunk_split(base64_encode($text !== '' ? $text : strip_tags($html)), 76, "\r\n")
                . "\r\n--{$boundary}\r\n"
                . "Content-Type: text/html; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: base64\r\n\r\n"
                . chunk_split(base64_encode($html), 76, "\r\n")
                . "\r\n--{$boundary}--\r\n";

            if ($ics !== '') {
                // Calendar file: wrap the alternative part in multipart/mixed.
                $outer = 'orbylox-mixed-' . bin2hex(random_bytes(10));
                $headers[] = 'Content-Type: multipart/mixed; boundary="' . $outer . '"';
                $body = "--{$outer}\r\n"
                    . "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n"
                    . $alternative
                    . "\r\n--{$outer}\r\n"
                    . "Content-Type: text/calendar; charset=UTF-8; method=REQUEST; name=\"termin.ics\"\r\n"
                    . "Content-Transfer-Encoding: base64\r\n"
                    . "Content-Disposition: attachment; filename=\"termin.ics\"\r\n\r\n"
                    . chunk_split(base64_encode($ics), 76, "\r\n")
                    . "\r\n--{$outer}--\r\n";
            } else {
                $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
                $body = $alternative;
            }
        } else {
            $headers[] = 'Content-Type: text/plain; charset=UTF-8';
            $headers[] = 'Content-Transfer-Encoding: base64';
            $body = chunk_split(base64_encode($text), 76, "\r\n");
        }

        // base64 bodies never start a line with a dot, so no dot-stuffing needed.
        fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n");
        smtpSend($socket, '', [250], 'Nachricht senden');

        @fwrite($socket, "QUIT\r\n");
    } finally {
        @fclose($socket);
    }
}
