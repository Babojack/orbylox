<?php
/**
 * Markdown -> HTML, bewusst klein gehalten.
 *
 * Kein Composer-Paket: Hostinger hat hier keinen Composer, und die Bibliotheken
 * schleppen mehr mit, als ein Blog braucht. Unterstützt wird genau das, was in
 * Fachartikeln vorkommt — Überschriften, Absätze, Listen, Zitate, Tabellen,
 * Code, Links, Bilder, Fett/Kursiv.
 *
 * Sicherheit: der Text wird ZUERST vollständig escaped, HTML entsteht erst
 * danach aus den erkannten Markdown-Zeichen. Dadurch kann kein <script> aus
 * dem Artikeltext in die Seite gelangen, egal was jemand ins Feld schreibt.
 */

declare(strict_types=1);

function blogEsc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Nur http(s) und relative Pfade zulassen — sperrt javascript: und data:. */
function blogSafeUrl(string $url): string
{
    $url = trim($url);
    if ($url === '') return '';
    if (preg_match('#^(https?://|/|\#)#i', $url)) return $url;
    return '';
}

/** Überschrift -> Anker für das Inhaltsverzeichnis. */
function blogHeadingId(string $text): string
{
    require_once __DIR__ . '/blog-store.php';
    $id = blogSlugify(strip_tags($text));
    return $id !== '' ? $id : 'abschnitt';
}

/** Inline-Auszeichnungen auf bereits escaptem Text. */
function blogInline(string $escaped): string
{
    // Bilder vor Links, sonst frisst der Link-Ausdruck die Bilder
    $escaped = preg_replace_callback('/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/', function ($m) {
        $src = blogSafeUrl(html_entity_decode($m[2], ENT_QUOTES, 'UTF-8'));
        if ($src === '') return '';
        $alt = $m[1];
        $title = isset($m[3]) && $m[3] !== '' ? ' title="' . $m[3] . '"' : '';
        return '<img src="' . blogEsc($src) . '" alt="' . $alt . '"' . $title . ' loading="lazy" decoding="async">';
    }, $escaped) ?? $escaped;

    $escaped = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/', function ($m) {
        $href = blogSafeUrl(html_entity_decode($m[2], ENT_QUOTES, 'UTF-8'));
        if ($href === '') return $m[1];
        $extern = (bool)preg_match('#^https?://#i', $href)
            && stripos($href, 'orbylox.de') === false;
        $rel = $extern ? ' target="_blank" rel="noopener noreferrer"' : '';
        return '<a href="' . blogEsc($href) . '"' . $rel . '>' . $m[1] . '</a>';
    }, $escaped) ?? $escaped;

    $escaped = preg_replace('/`([^`]+)`/', '<code>$1</code>', $escaped) ?? $escaped;
    $escaped = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $escaped) ?? $escaped;
    $escaped = preg_replace('/(?<![*\w])\*([^*\n]+)\*(?![*\w])/', '<em>$1</em>', $escaped) ?? $escaped;
    return $escaped;
}

/**
 * Rendert Markdown und liefert zusätzlich das Inhaltsverzeichnis.
 * Rückgabe: ['html' => string, 'toc' => [['level'=>2,'id'=>'…','text'=>'…'], …]]
 */
function blogRenderMarkdown(string $markdown): array
{
    $lines = preg_split('/\r\n|\r|\n/', $markdown) ?: [];
    $html = '';
    $toc = [];
    $inList = null;      // 'ul' | 'ol' | null
    $inCode = false;
    $inQuote = false;
    $para = [];
    $usedIds = [];

    $closeList = function () use (&$html, &$inList) {
        if ($inList) { $html .= "</{$inList}>\n"; $inList = null; }
    };
    $closeQuote = function () use (&$html, &$inQuote) {
        if ($inQuote) { $html .= "</blockquote>\n"; $inQuote = false; }
    };
    $flushPara = function () use (&$html, &$para) {
        if ($para) {
            $html .= '<p>' . blogInline(blogEsc(implode(' ', $para))) . "</p>\n";
            $para = [];
        }
    };

    foreach ($lines as $line) {
        // Codeblock
        if (preg_match('/^```\s*([a-z0-9+-]*)\s*$/i', $line, $m)) {
            $flushPara(); $closeList(); $closeQuote();
            if ($inCode) { $html .= "</code></pre>\n"; $inCode = false; }
            else { $html .= '<pre><code' . ($m[1] ? ' class="language-' . blogEsc($m[1]) . '"' : '') . '>'; $inCode = true; }
            continue;
        }
        if ($inCode) { $html .= blogEsc($line) . "\n"; continue; }

        $trim = trim($line);

        if ($trim === '') { $flushPara(); $closeList(); $closeQuote(); continue; }

        // Überschriften
        if (preg_match('/^(#{1,6})\s+(.*)$/', $trim, $m)) {
            $flushPara(); $closeList(); $closeQuote();
            $level = strlen($m[1]);
            $text = trim($m[2]);
            $id = blogHeadingId($text);
            $base = $id; $n = 2;
            while (isset($usedIds[$id])) { $id = $base . '-' . $n; $n++; }
            $usedIds[$id] = true;
            // H1 bleibt dem Artikeltitel vorbehalten -> im Text ab H2
            $tag = 'h' . min(6, max(2, $level));
            $html .= "<{$tag} id=\"" . blogEsc($id) . "\">" . blogInline(blogEsc($text)) . "</{$tag}>\n";
            if ($level <= 3) $toc[] = ['level' => min(3, max(2, $level)), 'id' => $id, 'text' => $text];
            continue;
        }

        // Trennlinie
        if (preg_match('/^(-{3,}|\*{3,})$/', $trim)) {
            $flushPara(); $closeList(); $closeQuote();
            $html .= "<hr>\n";
            continue;
        }

        // Zitat
        if (preg_match('/^>\s?(.*)$/', $trim, $m)) {
            $flushPara(); $closeList();
            if (!$inQuote) { $html .= "<blockquote>\n"; $inQuote = true; }
            $html .= '<p>' . blogInline(blogEsc($m[1])) . "</p>\n";
            continue;
        }
        $closeQuote();

        // Tabelle
        if (strpos($trim, '|') === 0 && substr($trim, -1) === '|') {
            $flushPara(); $closeList();
            $cells = array_map('trim', explode('|', trim($trim, '|')));
            if (preg_match('/^[\s|:-]+$/', $trim)) continue; // Trennzeile überspringen
            if (strpos($html, '<table>') === false || substr_count($html, '<table>') === substr_count($html, '</table>')) {
                $html .= "<table>\n<tbody>\n";
            }
            $html .= '<tr>' . implode('', array_map(fn ($c) => '<td>' . blogInline(blogEsc($c)) . '</td>', $cells)) . "</tr>\n";
            continue;
        }
        if (substr_count($html, '<table>') > substr_count($html, '</table>')) {
            $html .= "</tbody>\n</table>\n";
        }

        // Listen
        if (preg_match('/^[-*+]\s+(.*)$/', $trim, $m)) {
            $flushPara();
            if ($inList !== 'ul') { $closeList(); $html .= "<ul>\n"; $inList = 'ul'; }
            $html .= '<li>' . blogInline(blogEsc($m[1])) . "</li>\n";
            continue;
        }
        if (preg_match('/^\d+[.)]\s+(.*)$/', $trim, $m)) {
            $flushPara();
            if ($inList !== 'ol') { $closeList(); $html .= "<ol>\n"; $inList = 'ol'; }
            $html .= '<li>' . blogInline(blogEsc($m[1])) . "</li>\n";
            continue;
        }
        $closeList();

        $para[] = $trim;
    }

    $flushPara(); $closeList(); $closeQuote();
    if ($inCode) $html .= "</code></pre>\n";
    if (substr_count($html, '<table>') > substr_count($html, '</table>')) $html .= "</tbody>\n</table>\n";

    return ['html' => $html, 'toc' => $toc];
}
