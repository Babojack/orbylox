<?php
/**
 * Serverseitiges Rendern der Blogseiten.
 *
 * WARUM ES DAS GIBT
 * Die App ist ein React-Einzelseiten-Programm. Was ein Crawler ohne
 * JavaScript sieht, ist heute genau das: <div id="root"></div>. Für einen Blog,
 * der ranken soll, ist das wertlos. Dieser Renderer liefert stattdessen
 * fertiges HTML — Titel, Text, Überschriftenstruktur, Meta-Angaben,
 * Open Graph, JSON-LD — ohne dass eine Zeile JavaScript laufen muss.
 *
 * Der Besucher bekommt dieselbe Seite und kann sie sofort lesen; die React-App
 * wird nicht geladen. Das hält die Seite leicht (kein 2-MB-Bundle für einen
 * Artikel) und die Core Web Vitals gut.
 *
 * Aufgerufen über .htaccess:
 *   /blog                  -> Übersicht
 *   /blog/seite/2          -> Übersicht, Seite 2
 *   /blog/kategorie/xyz    -> Kategorie
 *   /blog/tag/xyz          -> Schlagwort
 *   /blog/<slug>           -> Artikel
 */

declare(strict_types=1);

require_once __DIR__ . '/blog-store.php';
require_once __DIR__ . '/blog-markdown.php';

const BLOG_PER_PAGE = 9;

$SITE = 'https://orbylox.de';
$BRAND = 'ORBYLOX';

/* ------------------------------------------------------------------ Route */

$path = (string)($_GET['p'] ?? '');
$path = trim(parse_url($path, PHP_URL_PATH) ?? '', '/');
$parts = $path === '' ? [] : explode('/', $path);
if (($parts[0] ?? '') === 'blog') array_shift($parts);

$route = ['type' => 'index', 'page' => 1, 'value' => ''];
if (count($parts) === 0) {
    $route['type'] = 'index';
} elseif ($parts[0] === 'seite' || $parts[0] === 'page') {
    $route = ['type' => 'index', 'page' => max(1, (int)($parts[1] ?? 1)), 'value' => ''];
} elseif (($parts[0] === 'kategorie' || $parts[0] === 'category') && isset($parts[1])) {
    $route = ['type' => 'category', 'page' => max(1, (int)($parts[3] ?? 1)), 'value' => urldecode($parts[1])];
} elseif ($parts[0] === 'tag' && isset($parts[1])) {
    $route = ['type' => 'tag', 'page' => max(1, (int)($parts[3] ?? 1)), 'value' => urldecode($parts[1])];
} else {
    $route = ['type' => 'post', 'page' => 1, 'value' => $parts[0]];
}

/* ----------------------------------------------------------------- Helfer */

function e(string $s): string { return blogEsc($s); }

function blogUrl(string $suffix = ''): string
{
    global $SITE;
    return $SITE . '/blog' . ($suffix !== '' ? '/' . ltrim($suffix, '/') : '');
}

function fmtDate(string $iso, string $locale = 'de'): string
{
    $ts = strtotime($iso);
    if ($ts === false) return '';
    if ($locale === 'en') return date('M j, Y', $ts);
    $months = [1=>'Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    return date('j.', $ts) . ' ' . $months[(int)date('n', $ts)] . ' ' . date('Y', $ts);
}

function absUrl(string $url): string
{
    global $SITE;
    if ($url === '') return '';
    if (preg_match('#^https?://#i', $url)) return $url;
    return $SITE . '/' . ltrim($url, '/');
}

/**
 * Der Rahmen jeder Seite. Enthält das komplette Design inline —
 * kein Stylesheet-Abruf, keine Web-Schriften, kein JavaScript.
 * Das ist der schnellste mögliche Weg zum ersten sichtbaren Inhalt.
 */
function blogLayout(array $head, string $body): string
{
    global $SITE, $BRAND;
    $lang = $head['lang'] ?? 'de';
    $title = e((string)$head['title']);
    $desc = e((string)($head['description'] ?? ''));
    $canonical = e((string)($head['canonical'] ?? $SITE . '/blog'));
    $image = e(absUrl((string)($head['image'] ?? '/screens/hero-devices.webp')));
    $type = (string)($head['ogType'] ?? 'website');
    $robots = (string)($head['robots'] ?? 'index, follow, max-image-preview:large, max-snippet:-1');
    $jsonld = (string)($head['jsonld'] ?? '');
    $alternate = (string)($head['alternate'] ?? '');
    $prev = (string)($head['prev'] ?? '');
    $next = (string)($head['next'] ?? '');

    $css = <<<CSS
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#fff;color:#0a0a0a;
 font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
 font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
a{color:#0a0a0a}
img{max-width:100%;height:auto;display:block}
.wrap{max-width:1152px;margin:0 auto;padding:0 16px}
header.top{border-bottom:2px solid #0a0a0a}
header.top .wrap{height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:8px;text-decoration:none}
.brand svg{width:32px;height:32px;flex:0 0 auto}
.brand b{font-size:16px;font-weight:800;letter-spacing:-.02em}
.nav{display:flex;gap:8px;align-items:center}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border:2px solid #0a0a0a;background:#fff;
 color:#0a0a0a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;
 transition:background-color .26s cubic-bezier(.22,.61,.36,1),color .26s cubic-bezier(.22,.61,.36,1),box-shadow .26s,transform .26s}
.btn:hover{background:#0a0a0a;color:#fff;transform:translate(-3px,-3px);box-shadow:6px 6px 0 0 rgba(10,10,10,.88)}
.btn.solid{background:#ef5a24;border-color:#ef5a24;color:#fff}
.btn.solid:hover{background:#0a0a0a;border-color:#0a0a0a}
.crumbs{font-size:12px;color:#5f5e5a;padding:16px 0}
.crumbs a{color:#5f5e5a;text-decoration:none}
.crumbs a:hover{color:#ef5a24}
.hero{border-bottom:2px solid #0a0a0a;padding:56px 0 48px}
.hero h1{font-size:clamp(30px,5vw,52px);line-height:1.05;letter-spacing:-.03em;font-weight:800;margin:0 0 14px}
.hero p{font-size:18px;color:#5f5e5a;margin:0;max-width:56ch}
.kicker{display:inline-block;background:#0a0a0a;color:#fff;font-size:11px;font-weight:700;
 text-transform:uppercase;letter-spacing:.08em;padding:5px 10px;margin-bottom:16px}
.section{padding:44px 0;border-bottom:2px solid #0a0a0a}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.card{border:2px solid #0a0a0a;background:#fff;display:flex;flex-direction:column;text-decoration:none;color:inherit;
 transition:box-shadow .26s cubic-bezier(.22,.61,.36,1),transform .26s cubic-bezier(.22,.61,.36,1)}
.card:hover{transform:translate(-3px,-3px);box-shadow:6px 6px 0 0 rgba(10,10,10,.88)}
.card .thumb{aspect-ratio:16/10;background:#f0efec;overflow:hidden}
.card .thumb img{width:100%;height:100%;object-fit:cover}
.card .body{padding:16px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h2,.card h3{margin:0;font-size:18px;line-height:1.3;letter-spacing:-.01em}
.card p{margin:0;font-size:14px;color:#5f5e5a}
.meta{font-size:12px;color:#888780;display:flex;gap:10px;flex-wrap:wrap;margin-top:auto;padding-top:8px}
.cat{display:inline-block;background:#ef5a24;color:#fff;font-size:10px;font-weight:700;
 text-transform:uppercase;letter-spacing:.06em;padding:3px 7px;text-decoration:none}
.feature{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:center}
.feature .thumb{border:2px solid #0a0a0a;aspect-ratio:16/10;overflow:hidden;background:#f0efec}
.feature h2{font-size:clamp(24px,3vw,34px);line-height:1.15;letter-spacing:-.02em;margin:10px 0}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-block;border:2px solid #0a0a0a;padding:7px 12px;font-size:11px;font-weight:700;
 text-transform:uppercase;letter-spacing:.05em;text-decoration:none;color:#0a0a0a;background:#fff}
.chip:hover,.chip[aria-current="page"]{background:#ef5a24;border-color:#ef5a24;color:#fff}
.pager{display:flex;gap:10px;justify-content:center;align-items:center;padding:32px 0;flex-wrap:wrap}
.pager span[aria-current]{background:#0a0a0a;color:#fff;padding:10px 16px;font-size:12px;font-weight:700}
article.post{padding:0 0 48px}
article.post h1{font-size:clamp(28px,4.4vw,46px);line-height:1.1;letter-spacing:-.03em;margin:0 0 16px;font-weight:800}
.post-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#5f5e5a;
 padding-bottom:20px;border-bottom:2px solid #0a0a0a;margin-bottom:24px}
.cover{border:2px solid #0a0a0a;margin:0 0 28px}
.layout{display:grid;grid-template-columns:220px 1fr;gap:40px;align-items:start}
.toc{position:sticky;top:24px;border-left:2px solid #0a0a0a;padding-left:14px}
.toc p{margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888780}
.toc a{display:block;font-size:13px;color:#5f5e5a;text-decoration:none;padding:3px 0;line-height:1.4}
.toc a:hover{color:#ef5a24}
.toc a.l3{padding-left:12px;font-size:12px}
.prose{max-width:72ch;font-size:17px}
.prose h2{font-size:26px;line-height:1.25;letter-spacing:-.02em;margin:38px 0 12px;font-weight:800}
.prose h3{font-size:20px;line-height:1.3;margin:28px 0 10px;font-weight:700}
.prose p{margin:0 0 18px}
.prose ul,.prose ol{margin:0 0 18px;padding-left:22px}
.prose li{margin:0 0 7px}
.prose blockquote{margin:22px 0;padding:12px 18px;border-left:3px solid #ef5a24;background:#fdf1ec;color:#5f5e5a}
.prose blockquote p{margin:0}
.prose code{background:#f0efec;padding:2px 5px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.prose pre{background:#0a0a0a;color:#f5f5f5;padding:16px;overflow-x:auto;margin:0 0 20px}
.prose pre code{background:none;color:inherit;padding:0}
.prose table{width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px}
.prose td{border:1px solid #e5e5e5;padding:8px 10px}
.prose img{border:2px solid #0a0a0a;margin:22px 0}
.prose hr{border:none;border-top:2px solid #0a0a0a;margin:32px 0}
.prose a{color:#ef5a24;text-underline-offset:2px}
.share{display:flex;gap:8px;flex-wrap:wrap;padding:24px 0;border-top:2px solid #0a0a0a;margin-top:36px}
.share a{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
 border:2px solid #0a0a0a;padding:8px 12px;text-decoration:none;color:#0a0a0a}
.share a:hover{background:#0a0a0a;color:#fff}
.cta{background:#0a0a0a;color:#fff;padding:44px 0;text-align:center}
.cta h2{font-size:clamp(22px,3vw,32px);margin:0 0 10px;letter-spacing:-.02em}
.cta p{color:#c9c7c2;margin:0 0 22px}
footer.bot{padding:28px 0;font-size:13px;color:#888780}
footer.bot a{color:#888780;text-decoration:none;margin-right:14px}
footer.bot a:hover{color:#ef5a24}
.notfound{padding:80px 0;text-align:center}
.notfound h1{font-size:64px;margin:0 0 8px;letter-spacing:-.04em}
@media(max-width:900px){.layout{grid-template-columns:1fr}.toc{position:static;border-left:none;border-top:2px solid #0a0a0a;padding:14px 0 0}
 .grid{grid-template-columns:repeat(2,1fr)}.feature{grid-template-columns:1fr}}
@media(max-width:640px){.grid{grid-template-columns:1fr}.hero{padding:36px 0 30px}.section{padding:32px 0}
 .prose{font-size:16px}.nav .hide-sm{display:none}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}.card:hover,.btn:hover{transform:none}}
CSS;

    $mark = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="19" fill="#ef5a24"/><circle cx="32" cy="32" r="13" fill="none" stroke="#fff" stroke-width="8"/></svg>';

    $altTag = $alternate !== '' ? $alternate : '';
    $prevTag = $prev !== '' ? '<link rel="prev" href="' . e($prev) . '">' : '';
    $nextTag = $next !== '' ? '<link rel="next" href="' . e($next) . '">' : '';
    $jsonldTag = $jsonld !== '' ? '<script type="application/ld+json">' . $jsonld . '</script>' : '';

    return <<<HTML
<!doctype html>
<html lang="{$lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title}</title>
<meta name="description" content="{$desc}">
<link rel="canonical" href="{$canonical}">
<meta name="robots" content="{$robots}">
{$altTag}{$prevTag}{$nextTag}
<meta property="og:type" content="{$type}">
<meta property="og:site_name" content="{$BRAND}">
<meta property="og:title" content="{$title}">
<meta property="og:description" content="{$desc}">
<meta property="og:url" content="{$canonical}">
<meta property="og:image" content="{$image}">
<meta property="og:locale" content="{$lang}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{$title}">
<meta name="twitter:description" content="{$desc}">
<meta name="twitter:image" content="{$image}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#ef5a24">
<style>{$css}</style>
{$jsonldTag}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="{$SITE}/">{$mark}<b>RBYLOX</b></a>
  <nav class="nav">
    <a class="btn hide-sm" href="{$SITE}/blog">Blog</a>
    <a class="btn solid" href="{$SITE}/login">Kostenlos starten</a>
  </nav>
</div></header>
{$body}
<footer class="bot"><div class="wrap">
  <a href="{$SITE}/">Startseite</a><a href="{$SITE}/blog">Blog</a><a href="{$SITE}/About">&Uuml;ber uns</a><a href="{$SITE}/Impressum">Impressum</a>
  <span>© 2026 {$BRAND}</span>
</div></footer>
</body>
</html>
HTML;
}

/** Karte für die Übersicht. */
function blogCard(array $p, string $heading = 'h3'): string
{
    $url = blogUrl($p['slug']);
    $img = (string)($p['featured_image'] ?? '');
    $thumb = $img !== ''
        ? '<div class="thumb"><img src="' . e($img) . '" alt="' . e((string)($p['featured_alt'] ?? $p['title'])) . '" loading="lazy" decoding="async" width="640" height="400"></div>'
        : '';
    $cat = (string)($p['category'] ?? '');
    $catHtml = $cat !== '' ? '<span class="cat">' . e($cat) . '</span>' : '';
    $mins = blogReadingMinutes((string)($p['content'] ?? ''));
    $date = fmtDate((string)($p['published_at'] ?? ''), (string)($p['locale'] ?? 'de'));

    return '<a class="card" href="' . e($url) . '">' . $thumb
        . '<div class="body">' . $catHtml
        . "<{$heading}>" . e((string)$p['title']) . "</{$heading}>"
        . '<p>' . e((string)($p['excerpt'] ?? '')) . '</p>'
        . '<div class="meta"><span>' . e($date) . '</span><span>' . $mins . ' Min.</span></div>'
        . '</div></a>';
}

function crumbs(array $items): string
{
    $parts = [];
    foreach ($items as $i => $it) {
        $last = $i === count($items) - 1;
        $parts[] = $last
            ? '<span aria-current="page">' . e($it['name']) . '</span>'
            : '<a href="' . e($it['url']) . '">' . e($it['name']) . '</a>';
    }
    return '<nav class="crumbs" aria-label="Breadcrumb"><div class="wrap">' . implode(' › ', $parts) . '</div></nav>';
}

function crumbsJsonLd(array $items): array
{
    $list = [];
    foreach ($items as $i => $it) {
        $list[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $it['name'], 'item' => $it['url']];
    }
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $list];
}

/* --------------------------------------------------------------- Rendering */

$jsonFlags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP;

if ($route['type'] === 'post') {
    $post = blogFindBySlug((string)$route['value']);
    if (!$post) {
        http_response_code(404);
        $body = '<main class="wrap notfound"><h1>404</h1><p>Diesen Beitrag gibt es nicht (mehr).</p>'
              . '<p style="margin-top:24px"><a class="btn solid" href="' . $SITE . '/blog">Zur Blog-Übersicht</a></p></main>';
        echo blogLayout([
            'title' => 'Nicht gefunden — ' . $BRAND,
            'description' => 'Diese Seite existiert nicht.',
            'canonical' => blogUrl(),
            'robots' => 'noindex, follow',
        ], $body);
        exit;
    }

    $locale = (string)($post['locale'] ?? 'de');
    $rendered = blogRenderMarkdown((string)$post['content']);
    $url = ($post['canonical_url'] ?? '') !== '' ? (string)$post['canonical_url'] : blogUrl($post['slug']);
    $mins = blogReadingMinutes((string)$post['content']);
    $related = blogRelated($post, 3);

    $crumbItems = [
        ['name' => 'Startseite', 'url' => $SITE . '/'],
        ['name' => 'Blog', 'url' => blogUrl()],
    ];
    if (($post['category'] ?? '') !== '') {
        $crumbItems[] = ['name' => (string)$post['category'], 'url' => blogUrl('kategorie/' . blogSlugify((string)$post['category']))];
    }
    $crumbItems[] = ['name' => (string)$post['title'], 'url' => $url];

    $article = [
        '@context' => 'https://schema.org',
        '@type' => 'BlogPosting',
        'headline' => mb_substr((string)$post['title'], 0, 110, 'UTF-8'),
        'description' => (string)$post['meta_description'],
        'inLanguage' => $locale,
        'datePublished' => (string)$post['published_at'],
        'dateModified' => (string)($post['updated_at'] ?: $post['published_at']),
        'author' => ['@type' => 'Person', 'name' => (string)$post['author']],
        'publisher' => [
            '@type' => 'Organization',
            'name' => $BRAND,
            'logo' => ['@type' => 'ImageObject', 'url' => $SITE . '/favicon.svg'],
        ],
        'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
        'wordCount' => str_word_count(strip_tags((string)$post['content'])),
        'timeRequired' => 'PT' . $mins . 'M',
    ];
    if (($post['featured_image'] ?? '') !== '') $article['image'] = [absUrl((string)$post['featured_image'])];
    if (!empty($post['tags'])) $article['keywords'] = implode(', ', (array)$post['tags']);
    if (($post['category'] ?? '') !== '') $article['articleSection'] = (string)$post['category'];

    $jsonld = json_encode([$article, crumbsJsonLd($crumbItems)], $jsonFlags);

    // Übersetzung verlinken, falls vorhanden
    $alternate = '';
    $twin = ($post['translation_of'] ?? '') !== '' ? blogFindBySlug((string)$post['translation_of']) : null;
    if ($twin) {
        $other = (string)($twin['locale'] ?? 'en');
        $alternate = '<link rel="alternate" hreflang="' . e($other) . '" href="' . e(blogUrl($twin['slug'])) . '">'
                   . '<link rel="alternate" hreflang="' . e($locale) . '" href="' . e($url) . '">';
    }

    $toc = '';
    if (count($rendered['toc']) >= 3) {
        $links = '';
        foreach ($rendered['toc'] as $h) {
            $cls = $h['level'] === 3 ? ' class="l3"' : '';
            $links .= '<a href="#' . e($h['id']) . '"' . $cls . '>' . e($h['text']) . '</a>';
        }
        $toc = '<aside class="toc"><p>' . ($locale === 'en' ? 'Contents' : 'Inhalt') . '</p>' . $links . '</aside>';
    }

    $cover = ($post['featured_image'] ?? '') !== ''
        ? '<figure class="cover"><img src="' . e((string)$post['featured_image']) . '" alt="'
          . e((string)($post['featured_alt'] ?? $post['title'])) . '" width="1200" height="675" fetchpriority="high" decoding="async"></figure>'
        : '';

    $tagHtml = '';
    foreach ((array)($post['tags'] ?? []) as $tg) {
        $tagHtml .= '<a class="chip" href="' . e(blogUrl('tag/' . blogSlugify((string)$tg))) . '">' . e((string)$tg) . '</a>';
    }

    $shareUrl = rawurlencode($url);
    $shareTitle = rawurlencode((string)$post['title']);
    $share = '<div class="share">'
        . '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' . $shareUrl . '" target="_blank" rel="noopener">LinkedIn</a>'
        . '<a href="https://x.com/intent/tweet?url=' . $shareUrl . '&text=' . $shareTitle . '" target="_blank" rel="noopener">X</a>'
        . '<a href="https://api.whatsapp.com/send?text=' . $shareTitle . '%20' . $shareUrl . '" target="_blank" rel="noopener">WhatsApp</a>'
        . '<a href="mailto:?subject=' . $shareTitle . '&body=' . $shareUrl . '">E-Mail</a>'
        . '</div>';

    $relatedHtml = '';
    if ($related) {
        $cards = '';
        foreach ($related as $r) $cards .= blogCard($r);
        $relatedHtml = '<section class="section"><div class="wrap"><h2 style="margin:0 0 20px;font-size:24px">'
            . ($locale === 'en' ? 'Related articles' : 'Ähnliche Beiträge')
            . '</h2><div class="grid">' . $cards . '</div></div></section>';
    }

    $catLink = ($post['category'] ?? '') !== ''
        ? '<a class="cat" href="' . e(blogUrl('kategorie/' . blogSlugify((string)$post['category']))) . '">' . e((string)$post['category']) . '</a>'
        : '';

    $body = crumbs($crumbItems)
        . '<main class="wrap"><article class="post">'
        . $catLink
        . '<h1>' . e((string)$post['title']) . '</h1>'
        . '<div class="post-meta">'
        . '<span>' . e((string)$post['author']) . '</span>'
        . '<time datetime="' . e((string)$post['published_at']) . '">' . e(fmtDate((string)$post['published_at'], $locale)) . '</time>'
        . '<span>' . $mins . ($locale === 'en' ? ' min read' : ' Min. Lesezeit') . '</span>'
        . '</div>'
        . $cover
        . '<div class="layout">' . $toc . '<div class="prose">' . $rendered['html'] . '</div></div>'
        . ($tagHtml !== '' ? '<div class="chips" style="margin-top:32px">' . $tagHtml . '</div>' : '')
        . $share
        . '</article></main>'
        . $relatedHtml
        . '<section class="cta"><div class="wrap"><h2>'
        . ($locale === 'en' ? 'Run your projects in one place.' : 'Projekte an einem Ort führen.')
        . '</h2><p>'
        . ($locale === 'en' ? 'Tasks, notes, canvas, chat and video — free to start.' : 'Aufgaben, Notizen, Canvas, Chat und Video — kostenlos starten.')
        . '</p><a class="btn solid" href="' . $SITE . '/login">'
        . ($locale === 'en' ? 'Start for free' : 'Kostenlos starten') . '</a></div></section>';

    header('Cache-Control: public, max-age=300, s-maxage=600');
    echo blogLayout([
        'lang' => $locale,
        'title' => (string)($post['seo_title'] ?: $post['title']) . ' — ' . $BRAND,
        'description' => (string)$post['meta_description'],
        'canonical' => $url,
        'image' => (string)($post['og_image'] ?: $post['featured_image']),
        'ogType' => 'article',
        'jsonld' => $jsonld,
        'alternate' => $alternate,
    ], $body);
    exit;
}

/* ---------------------------------------------------- Übersicht / Filter */

$all = blogPublished();
$title = 'Blog';
$intro = 'Praxiswissen zu Projektmanagement, Kanban und Zusammenarbeit — von den Leuten hinter ORBYLOX.';
$crumbItems = [['name' => 'Startseite', 'url' => $SITE . '/'], ['name' => 'Blog', 'url' => blogUrl()]];
$baseUrl = blogUrl();
$robots = 'index, follow, max-image-preview:large';

if ($route['type'] === 'category') {
    $slugWanted = blogSlugify((string)$route['value']);
    $all = array_values(array_filter($all, fn ($p) => blogSlugify((string)($p['category'] ?? '')) === $slugWanted));
    if (!$all) {
        http_response_code(404);
        echo blogLayout(['title' => 'Kategorie nicht gefunden — ' . $BRAND, 'robots' => 'noindex, follow', 'canonical' => blogUrl()],
            '<main class="wrap notfound"><h1>404</h1><p>Diese Kategorie gibt es nicht.</p>'
            . '<p style="margin-top:24px"><a class="btn solid" href="' . $SITE . '/blog">Zur Übersicht</a></p></main>');
        exit;
    }
    $title = (string)($all[0]['category'] ?? $route['value']);
    $intro = 'Alle Beiträge aus der Kategorie „' . $title . '“.';
    $crumbItems[] = ['name' => $title, 'url' => blogUrl('kategorie/' . $slugWanted)];
    $baseUrl = blogUrl('kategorie/' . $slugWanted);
} elseif ($route['type'] === 'tag') {
    $slugWanted = blogSlugify((string)$route['value']);
    $all = array_values(array_filter($all, function ($p) use ($slugWanted) {
        foreach ((array)($p['tags'] ?? []) as $t) if (blogSlugify((string)$t) === $slugWanted) return true;
        return false;
    }));
    if (!$all) {
        http_response_code(404);
        echo blogLayout(['title' => 'Schlagwort nicht gefunden — ' . $BRAND, 'robots' => 'noindex, follow', 'canonical' => blogUrl()],
            '<main class="wrap notfound"><h1>404</h1><p>Zu diesem Schlagwort gibt es keine Beiträge.</p>'
            . '<p style="margin-top:24px"><a class="btn solid" href="' . $SITE . '/blog">Zur Übersicht</a></p></main>');
        exit;
    }
    $title = '#' . $route['value'];
    $intro = 'Beiträge mit dem Schlagwort „' . (string)$route['value'] . '“.';
    $crumbItems[] = ['name' => $title, 'url' => blogUrl('tag/' . $slugWanted)];
    $baseUrl = blogUrl('tag/' . $slugWanted);
}

$total = count($all);
$pages = max(1, (int)ceil($total / BLOG_PER_PAGE));
$page = min(max(1, (int)$route['page']), $pages);
$slice = array_slice($all, ($page - 1) * BLOG_PER_PAGE, BLOG_PER_PAGE);

// Aufmacher nur auf Seite 1 der Übersicht
$featured = null;
if ($route['type'] === 'index' && $page === 1 && $slice) {
    $featured = array_shift($slice);
}

$canonical = $page > 1 ? rtrim($baseUrl, '/') . '/seite/' . $page : $baseUrl;
$prev = $page > 1 ? ($page - 1 === 1 ? $baseUrl : rtrim($baseUrl, '/') . '/seite/' . ($page - 1)) : '';
$next = $page < $pages ? rtrim($baseUrl, '/') . '/seite/' . ($page + 1) : '';

$featuredHtml = '';
if ($featured) {
    $img = (string)($featured['featured_image'] ?? '');
    $thumb = $img !== ''
        ? '<div class="thumb"><img src="' . e($img) . '" alt="' . e((string)($featured['featured_alt'] ?? $featured['title']))
          . '" width="960" height="600" fetchpriority="high" decoding="async" style="width:100%;height:100%;object-fit:cover"></div>'
        : '';
    $featuredHtml = '<section class="section"><div class="wrap"><a class="feature" href="' . e(blogUrl($featured['slug'])) . '" style="text-decoration:none;color:inherit">'
        . $thumb
        . '<div><span class="cat">' . e((string)($featured['category'] ?? 'Neu')) . '</span>'
        . '<h2>' . e((string)$featured['title']) . '</h2>'
        . '<p style="color:#5f5e5a;margin:0 0 14px">' . e((string)($featured['excerpt'] ?? '')) . '</p>'
        . '<div class="meta"><span>' . e(fmtDate((string)$featured['published_at'], (string)($featured['locale'] ?? 'de'))) . '</span>'
        . '<span>' . blogReadingMinutes((string)$featured['content']) . ' Min.</span></div></div></a></div></section>';
}

$cardsHtml = '';
foreach ($slice as $p) $cardsHtml .= blogCard($p, 'h2');
if ($cardsHtml === '' && !$featured) {
    $cardsHtml = '<p style="color:#5f5e5a">Noch keine Beiträge.</p>';
}

$catChips = '';
$cats = blogCategories();
if ($cats) {
    foreach ($cats as $name => $count) {
        $cUrl = blogUrl('kategorie/' . blogSlugify((string)$name));
        $current = ($route['type'] === 'category' && blogSlugify((string)$name) === blogSlugify((string)$route['value']))
            ? ' aria-current="page"' : '';
        $catChips .= '<a class="chip" href="' . e($cUrl) . '"' . $current . '>' . e((string)$name) . ' (' . (int)$count . ')</a>';
    }
    $catChips = '<div class="chips" style="margin-top:22px">'
        . '<a class="chip" href="' . e(blogUrl()) . '"' . ($route['type'] === 'index' ? ' aria-current="page"' : '') . '>Alle</a>'
        . $catChips . '</div>';
}

$pagerHtml = '';
if ($pages > 1) {
    $pagerHtml = '<nav class="pager" aria-label="Seiten">';
    if ($prev !== '') $pagerHtml .= '<a class="btn" href="' . e($prev) . '" rel="prev">Zurück</a>';
    for ($i = 1; $i <= $pages; $i++) {
        $u = $i === 1 ? $baseUrl : rtrim($baseUrl, '/') . '/seite/' . $i;
        $pagerHtml .= $i === $page
            ? '<span aria-current="page">' . $i . '</span>'
            : '<a class="btn" href="' . e($u) . '">' . $i . '</a>';
    }
    if ($next !== '') $pagerHtml .= '<a class="btn" href="' . e($next) . '" rel="next">Weiter</a>';
    $pagerHtml .= '</nav>';
}

$itemList = [];
foreach (array_slice($all, 0, 20) as $i => $p) {
    $itemList[] = ['@type' => 'ListItem', 'position' => $i + 1, 'url' => blogUrl($p['slug']), 'name' => (string)$p['title']];
}
$jsonld = json_encode([
    ['@context' => 'https://schema.org', '@type' => 'Blog', 'name' => $BRAND . ' Blog',
     'url' => blogUrl(), 'description' => $intro,
     'publisher' => ['@type' => 'Organization', 'name' => $BRAND, 'url' => $SITE]],
    ['@context' => 'https://schema.org', '@type' => 'ItemList', 'itemListElement' => $itemList],
    crumbsJsonLd($crumbItems),
], $jsonFlags);

$body = crumbs($crumbItems)
    . '<section class="hero"><div class="wrap"><span class="kicker">Blog</span>'
    . '<h1>' . e($title === 'Blog' ? 'Projekte, die laufen.' : $title) . '</h1>'
    . '<p>' . e($intro) . '</p>' . $catChips . '</div></section>'
    . $featuredHtml
    . '<section class="section"><div class="wrap"><div class="grid">' . $cardsHtml . '</div>' . $pagerHtml . '</div></section>'
    . '<section class="cta"><div class="wrap"><h2>Projekte an einem Ort führen.</h2>'
    . '<p>Aufgaben, Notizen, Canvas, Chat und Video — kostenlos starten.</p>'
    . '<a class="btn solid" href="' . $SITE . '/login">Kostenlos starten</a></div></section>';

header('Cache-Control: public, max-age=300, s-maxage=600');
echo blogLayout([
    'title' => ($page > 1 ? $title . ' — Seite ' . $page : $title) . ' — ' . $BRAND,
    'description' => mb_substr($intro, 0, 160, 'UTF-8'),
    'canonical' => $canonical,
    'jsonld' => $jsonld,
    'robots' => $robots,
    'prev' => $prev,
    'next' => $next,
], $body);
