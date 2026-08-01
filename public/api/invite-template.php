<?php
declare(strict_types=1);

/**
 * Invitation email template for ORBYLOX.
 *
 * Table-based layout with inline styles — that is what Outlook, Gmail and Apple
 * Mail reliably render. Every text is available in German and English, and a
 * plain-text version is generated alongside for clients that block HTML.
 */

function inviteTexts(string $language): array
{
    if ($language === 'en') {
        return [
            'subject' => 'You have been invited to %s on ORBYLOX',
            'subject_generic' => 'You have been invited to a project on ORBYLOX',
            'preheader' => 'Open the project and start collaborating.',
            'greeting' => 'Hello!',
            'intro_named' => '<strong>%s</strong> invited you to the project <strong>%s</strong> on ORBYLOX.',
            'intro_plain' => 'You have been invited to the project <strong>%s</strong> on ORBYLOX.',
            'intro_generic' => 'You have been invited to a project on ORBYLOX.',
            'lead' => 'ORBYLOX keeps tasks, files, boards and team chat in one place.',
            'cta' => 'Open project',
            'fallback' => 'If the button does not work, copy this link into your browser:',
            'features' => ['Tasks and Kanban in real time', 'Visual canvas board', 'Team chat and project feed', 'Files and documents'],
            'signoff' => 'See you in the project',
            'footer_note' => 'You received this email because someone invited you to a project on ORBYLOX. If this was not intended, simply ignore this message.',
        ];
    }

    return [
        'subject' => 'Einladung zum Projekt %s auf ORBYLOX',
        'subject_generic' => 'Einladung zu einem Projekt auf ORBYLOX',
        'preheader' => 'Projekt öffnen und direkt loslegen.',
        'greeting' => 'Hallo!',
        'intro_named' => '<strong>%s</strong> hat dich zum Projekt <strong>%s</strong> auf ORBYLOX eingeladen.',
        'intro_plain' => 'Du wurdest zum Projekt <strong>%s</strong> auf ORBYLOX eingeladen.',
        'intro_generic' => 'Du wurdest zu einem Projekt auf ORBYLOX eingeladen.',
        'lead' => 'In ORBYLOX liegen Aufgaben, Dateien, Boards und Team-Chat an einem Ort.',
        'cta' => 'Projekt öffnen',
        'fallback' => 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
        'features' => ['Aufgaben und Kanban in Echtzeit', 'Visuelles Canvas-Board', 'Team-Chat und Projekt-Feed', 'Dateien und Dokumente'],
        'signoff' => 'Bis gleich im Projekt',
        'footer_note' => 'Du erhältst diese E-Mail, weil dich jemand zu einem Projekt in ORBYLOX eingeladen hat. Falls das ein Versehen war, ignoriere die Nachricht einfach.',
    ];
}

function inviteSubject(string $language, string $projectName): string
{
    $t = inviteTexts($language);
    return $projectName !== '' ? sprintf($t['subject'], $projectName) : $t['subject_generic'];
}

function inviteHtml(string $language, string $inviteLink, string $projectName, string $inviterName, string $appUrl): string
{
    $t = inviteTexts($language);
    $e = static fn (string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    if ($inviterName !== '' && $projectName !== '') {
        $intro = sprintf($t['intro_named'], $e($inviterName), $e($projectName));
    } elseif ($projectName !== '') {
        $intro = sprintf($t['intro_plain'], $e($projectName));
    } else {
        $intro = $t['intro_generic'];
    }

    $features = '';
    foreach ($t['features'] as $feature) {
        $features .= '<tr><td style="padding:4px 0;font:15px/22px Helvetica,Arial,sans-serif;color:#475569;">'
            . '<span style="color:#6366f1;">&#9679;</span>&nbsp;&nbsp;' . $e($feature) . '</td></tr>';
    }

    $link = $e($inviteLink);
    $home = $e($appUrl !== '' ? $appUrl : 'https://orbylox.de');

    return <<<HTML
<!DOCTYPE html>
<html lang="{$language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ORBYLOX</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{$t['preheader']}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">

        <tr>
          <td style="background-color:#4f46e5;background-image:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 32px 28px 32px;">
            <div style="font:700 26px/32px Helvetica,Arial,sans-serif;color:#ffffff;letter-spacing:2px;">ORBYLOX</div>
            <div style="font:400 14px/20px Helvetica,Arial,sans-serif;color:#e0e7ff;margin-top:4px;">Projektmanagement für Teams</div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p style="margin:0 0 12px 0;font:600 20px/28px Helvetica,Arial,sans-serif;color:#0f172a;">{$t['greeting']}</p>
            <p style="margin:0 0 16px 0;font:400 16px/24px Helvetica,Arial,sans-serif;color:#334155;">{$intro}</p>
            <p style="margin:0;font:400 15px/23px Helvetica,Arial,sans-serif;color:#64748b;">{$t['lead']}</p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:28px 32px 8px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border-radius:10px;background-color:#4f46e5;">
                  <a href="{$link}" style="display:inline-block;padding:15px 38px;font:600 16px/20px Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">{$t['cta']}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px 24px 32px;">
            <p style="margin:0 0 6px 0;font:400 13px/19px Helvetica,Arial,sans-serif;color:#94a3b8;">{$t['fallback']}</p>
            <p style="margin:0;font:400 13px/19px Helvetica,Arial,sans-serif;word-break:break-all;">
              <a href="{$link}" style="color:#4f46e5;text-decoration:underline;">{$link}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;padding:18px 20px;">
              {$features}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <p style="margin:0;font:400 15px/23px Helvetica,Arial,sans-serif;color:#334155;">{$t['signoff']}<br><strong>ORBYLOX</strong></p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 6px 0;font:400 12px/18px Helvetica,Arial,sans-serif;color:#94a3b8;">{$t['footer_note']}</p>
            <p style="margin:0;font:400 12px/18px Helvetica,Arial,sans-serif;color:#94a3b8;">
              <a href="{$home}" style="color:#64748b;text-decoration:none;">orbylox.de</a>
              &nbsp;·&nbsp;
              <a href="{$home}/impressum" style="color:#64748b;text-decoration:none;">Impressum</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
HTML;
}

/* ------------------------------------------------------------- event invites */

function eventTexts(string $language): array
{
    if ($language === 'en') {
        return [
            'subject' => 'Invitation: %s',
            'heading' => 'You have been invited to a meeting',
            'when' => 'When',
            'organiser' => 'Organiser',
            'project' => 'Project',
            'join' => 'Join video meeting',
            'open_calendar' => 'Open calendar',
            'no_video' => 'No video meeting for this appointment.',
            'fallback' => 'If the button does not work, copy this link into your browser:',
            'footer_note' => 'This invitation was sent from ORBYLOX. The attached file adds the appointment to your calendar.',
        ];
    }
    return [
        'subject' => 'Termin: %s',
        'heading' => 'Du bist zu einem Termin eingeladen',
        'when' => 'Wann',
        'organiser' => 'Organisiert von',
        'project' => 'Projekt',
        'join' => 'Videokonferenz beitreten',
        'open_calendar' => 'Kalender öffnen',
        'no_video' => 'Zu diesem Termin gibt es keine Videokonferenz.',
        'fallback' => 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
        'footer_note' => 'Diese Einladung kommt aus ORBYLOX. Die angehängte Datei trägt den Termin in deinen Kalender ein.',
    ];
}

function formatEventWhen(string $language, string $startIso, string $endIso, bool $allDay): string
{
    try {
        $tz = new DateTimeZone(date_default_timezone_get() ?: 'Europe/Berlin');
        $start = new DateTime($startIso, $tz);
        $end = $endIso !== '' ? new DateTime($endIso, $tz) : null;
    } catch (Exception $e) {
        return $startIso;
    }

    if ($language === 'en') {
        $date = $start->format('D, d M Y');
        if ($allDay) return $date . ' (all day)';
        return $date . ', ' . $start->format('H:i') . ($end ? '–' . $end->format('H:i') : '');
    }

    $days = ['Mon' => 'Mo', 'Tue' => 'Di', 'Wed' => 'Mi', 'Thu' => 'Do', 'Fri' => 'Fr', 'Sat' => 'Sa', 'Sun' => 'So'];
    $date = ($days[$start->format('D')] ?? '') . ', ' . $start->format('d.m.Y');
    if ($allDay) return $date . ' (ganztägig)';
    return $date . ', ' . $start->format('H:i') . ($end ? '–' . $end->format('H:i') : '') . ' Uhr';
}

function eventSubject(string $language, string $title): string
{
    $t = eventTexts($language);
    return sprintf($t['subject'], $title !== '' ? $title : 'ORBYLOX');
}

function eventHtml(string $language, array $event, string $appUrl): string
{
    $t = eventTexts($language);
    $e = static fn (string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $when = formatEventWhen($language, (string)$event['start'], (string)$event['end'], (bool)$event['all_day']);
    $video = (string)$event['video_url'];
    $calendarLink = rtrim($appUrl, '/') . '/Calendar' . ($event['project_id'] ? '?project=' . rawurlencode((string)$event['project_id']) : '');

    $rows = '';
    $addRow = static function (string $label, string $value) use (&$rows, $e): void {
        if ($value === '') return;
        $rows .= '<tr>'
            . '<td style="padding:6px 12px 6px 0;font:600 13px/20px Helvetica,Arial,sans-serif;color:#64748b;white-space:nowrap;vertical-align:top;">' . $e($label) . '</td>'
            . '<td style="padding:6px 0;font:400 15px/22px Helvetica,Arial,sans-serif;color:#0f172a;">' . $e($value) . '</td>'
            . '</tr>';
    };
    $addRow($t['when'], $when);
    $addRow($t['project'], (string)$event['project_name']);
    $addRow($t['organiser'], (string)$event['organiser']);

    $description = trim((string)$event['description']) !== ''
        ? '<p style="margin:16px 0 0 0;font:400 15px/23px Helvetica,Arial,sans-serif;color:#334155;white-space:pre-wrap;">' . $e((string)$event['description']) . '</p>'
        : '';

    $videoBlock = $video !== ''
        ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px 0;"><tr>'
            . '<td align="center" style="border-radius:10px;background-color:#4f46e5;">'
            . '<a href="' . $e($video) . '" style="display:inline-block;padding:15px 34px;font:600 16px/20px Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">' . $t['join'] . '</a>'
            . '</td></tr></table>'
            . '<p style="margin:0 0 4px 0;font:400 13px/19px Helvetica,Arial,sans-serif;color:#94a3b8;">' . $t['fallback'] . '</p>'
            . '<p style="margin:0;font:400 13px/19px Helvetica,Arial,sans-serif;word-break:break-all;"><a href="' . $e($video) . '" style="color:#4f46e5;">' . $e($video) . '</a></p>'
        : '<p style="margin:20px 0 0 0;font:400 14px/21px Helvetica,Arial,sans-serif;color:#94a3b8;">' . $t['no_video'] . '</p>';

    $title = $e((string)$event['title']);
    $cal = $e($calendarLink);

    return <<<HTML
<!DOCTYPE html>
<html lang="{$language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ORBYLOX</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
      <tr>
        <td style="background-color:#4f46e5;background-image:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;">
          <div style="font:700 22px/28px Helvetica,Arial,sans-serif;color:#ffffff;letter-spacing:2px;">ORBYLOX</div>
          <div style="font:400 14px/20px Helvetica,Arial,sans-serif;color:#e0e7ff;margin-top:4px;">{$t['heading']}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 8px 32px;">
          <p style="margin:0 0 16px 0;font:700 22px/29px Helvetica,Arial,sans-serif;color:#0f172a;">{$title}</p>
          <table role="presentation" cellpadding="0" cellspacing="0">{$rows}</table>
          {$description}
          {$videoBlock}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 28px 32px;">
          <a href="{$cal}" style="font:600 14px/20px Helvetica,Arial,sans-serif;color:#4f46e5;text-decoration:none;">{$t['open_calendar']} →</a>
        </td>
      </tr>
      <tr>
        <td style="background-color:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font:400 12px/18px Helvetica,Arial,sans-serif;color:#94a3b8;">{$t['footer_note']}</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>
HTML;
}

function eventText(string $language, array $event, string $appUrl): string
{
    $t = eventTexts($language);
    $when = formatEventWhen($language, (string)$event['start'], (string)$event['end'], (bool)$event['all_day']);
    $lines = [
        (string)$event['title'],
        '',
        $t['when'] . ': ' . $when,
    ];
    if ((string)$event['project_name'] !== '') $lines[] = $t['project'] . ': ' . $event['project_name'];
    if ((string)$event['organiser'] !== '') $lines[] = $t['organiser'] . ': ' . $event['organiser'];
    if (trim((string)$event['description']) !== '') {
        $lines[] = '';
        $lines[] = (string)$event['description'];
    }
    $lines[] = '';
    $lines[] = (string)$event['video_url'] !== ''
        ? $t['join'] . ': ' . $event['video_url']
        : $t['no_video'];
    $lines[] = '';
    $lines[] = $t['open_calendar'] . ': ' . rtrim($appUrl, '/') . '/Calendar';
    return implode("\n", $lines);
}

/** Minimal but valid iCalendar entry so the appointment can be added with one click. */
function eventIcs(array $event, string $organiserEmail): string
{
    $tzName = date_default_timezone_get() ?: 'Europe/Berlin';
    try {
        $tz = new DateTimeZone($tzName);
        $start = new DateTime((string)$event['start'], $tz);
        $end = (string)$event['end'] !== '' ? new DateTime((string)$event['end'], $tz) : (clone $start)->modify('+1 hour');
    } catch (Exception $e) {
        return '';
    }
    $utc = new DateTimeZone('UTC');
    $start->setTimezone($utc);
    $end->setTimezone($utc);

    $escape = static fn (string $v): string => str_replace(
        ["\\", "\n", ",", ";"],
        ["\\\\", "\\n", "\\,", "\\;"],
        $v
    );

    $description = (string)$event['description'];
    if ((string)$event['video_url'] !== '') {
        $description = trim($description . "\n\n" . $event['video_url']);
    }

    $lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ORBYLOX//Kalender//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        'UID:' . bin2hex(random_bytes(8)) . '@orbylox.de',
        'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        'DTSTART:' . $start->format('Ymd\THis\Z'),
        'DTEND:' . $end->format('Ymd\THis\Z'),
        'SUMMARY:' . $escape((string)$event['title']),
        'DESCRIPTION:' . $escape($description),
    ];
    if ((string)$event['video_url'] !== '') {
        $lines[] = 'LOCATION:' . $escape((string)$event['video_url']);
        $lines[] = 'URL:' . $escape((string)$event['video_url']);
    }
    if ($organiserEmail !== '') {
        $lines[] = 'ORGANIZER:mailto:' . $organiserEmail;
    }
    $lines[] = 'END:VEVENT';
    $lines[] = 'END:VCALENDAR';

    return implode("\r\n", $lines) . "\r\n";
}

function inviteText(string $language, string $inviteLink, string $projectName, string $inviterName): string
{
    $t = inviteTexts($language);
    $strip = static fn (string $v): string => strip_tags($v);

    if ($inviterName !== '' && $projectName !== '') {
        $intro = $strip(sprintf($t['intro_named'], $inviterName, $projectName));
    } elseif ($projectName !== '') {
        $intro = $strip(sprintf($t['intro_plain'], $projectName));
    } else {
        $intro = $strip($t['intro_generic']);
    }

    $lines = [
        $t['greeting'],
        '',
        $intro,
        $t['lead'],
        '',
        $t['cta'] . ': ' . $inviteLink,
        '',
    ];
    foreach ($t['features'] as $feature) {
        $lines[] = '- ' . $feature;
    }
    $lines[] = '';
    $lines[] = $t['signoff'];
    $lines[] = 'ORBYLOX';

    return implode("\n", $lines);
}
