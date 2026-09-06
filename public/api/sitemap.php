<?php
/**
 * sitemap.xml — wird bei jedem Abruf aus den veröffentlichten Beiträgen gebaut.
 *
 * Dadurch steht ein neuer Artikel sofort nach dem Veröffentlichen in der
 * Sitemap; es muss nichts neu gebaut oder hochgeladen werden. Entwürfe und
 * geplante Beiträge, deren Zeitpunkt noch nicht erreicht ist, fehlen hier
 * bewusst — sie sind auch nicht abrufbar.
 */

declare(strict_types=1);

require_once __DIR__ . '/blog-store.php';

header('Content-Type: application/xml; charset=utf-8');
header('X-Robots-Tag: noindex');           // die Sitemap selbst gehört nicht in den Index
blogSendCacheHeaders();

$SITE = 'https://orbylox.de';

function xmlEsc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function w3c(string $iso): string
{
    $ts = strtotime($iso);
    return date('c', $ts !== false ? $ts : time());
}

const SITEMAP_PER_PAGE = 9;   // muss zu BLOG_PER_PAGE in blog.php passen

$urls = [];

/** Wegmarken je Sprache: /blog/kategorie/… gegenueber /en/blog/category/… */
function hubBase(string $loc): string
{
    global $SITE;
    return $SITE . ($loc === 'en' ? '/en/blog' : '/blog');
}
function catWord(string $loc): string { return $loc === 'en' ? 'category' : 'kategorie'; }
function pageWord(string $loc): string { return $loc === 'en' ? 'page' : 'seite'; }

// Die beiden Uebersichten verweisen wechselseitig aufeinander. x-default zeigt
// auf die deutsche Fassung — sie ist die aeltere und vollstaendigere.
$hubAlternates = [
    'de' => hubBase('de'),
    'en' => hubBase('en'),
    'x-default' => hubBase('de'),
];

// Feste Seiten
$urls[] = ['loc' => $SITE . '/',           'changefreq' => 'weekly',  'priority' => '1.0'];
$urls[] = ['loc' => $SITE . '/blog',       'changefreq' => 'daily',   'priority' => '0.9', 'alternates' => $hubAlternates];
$urls[] = ['loc' => $SITE . '/en/blog',    'changefreq' => 'daily',   'priority' => '0.9', 'alternates' => $hubAlternates];
$urls[] = ['loc' => $SITE . '/About',      'changefreq' => 'monthly', 'priority' => '0.5'];
$urls[] = ['loc' => $SITE . '/Impressum',  'changefreq' => 'yearly',  'priority' => '0.2'];

// Beiträge — beide Sprachen, jeder Beitrag behaelt seine Adresse unter /blog/
$posts = blogPublished();
foreach ($posts as $p) {
    $entry = [
        'loc' => $SITE . '/blog/' . (string)$p['slug'],
        'lastmod' => w3c((string)($p['updated_at'] ?: $p['published_at'])),
        'changefreq' => 'monthly',
        'priority' => '0.8',
    ];
    if (($p['featured_image'] ?? '') !== '') {
        $img = (string)$p['featured_image'];
        $entry['image'] = preg_match('#^https?://#i', $img) ? $img : $SITE . '/' . ltrim($img, '/');
        $entry['image_title'] = (string)$p['title'];
    }
    // Übersetzung als hreflang-Alternative
    $twin = ($p['translation_of'] ?? '') !== '' ? blogFindBySlug((string)$p['translation_of']) : null;
    if ($twin) {
        $selfLoc = (string)($p['locale'] ?? 'de');
        $twinLoc = (string)($twin['locale'] ?? 'en');
        $selfUrl = $SITE . '/blog/' . (string)$p['slug'];
        $twinUrl = $SITE . '/blog/' . (string)$twin['slug'];
        $entry['alternates'] = [
            $selfLoc => $selfUrl,
            $twinLoc => $twinUrl,
            'x-default' => $selfLoc === 'de' ? $selfUrl : $twinUrl,
        ];
    }
    $urls[] = $entry;
}

// Kategorien und Seitenblätterung — je Sprache getrennt, denn die Uebersicht
// zeigt jetzt nur noch Beitraege der jeweiligen Sprache.
foreach (['de', 'en'] as $loc) {
    $base = hubBase($loc);

    foreach (array_keys(blogCategories($loc)) as $cat) {
        $urls[] = [
            'loc' => $base . '/' . catWord($loc) . '/' . blogSlugify((string)$cat),
            'changefreq' => 'weekly',
            'priority' => '0.6',
        ];
    }

    $pages = (int)ceil(count(blogPublished($loc)) / SITEMAP_PER_PAGE);
    for ($i = 2; $i <= $pages; $i++) {
        $urls[] = ['loc' => $base . '/' . pageWord($loc) . '/' . $i, 'changefreq' => 'weekly', 'priority' => '0.4'];
    }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n";
echo '        xmlns:xhtml="http://www.w3.org/1999/xhtml"' . "\n";
echo '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

foreach ($urls as $u) {
    echo "  <url>\n";
    echo '    <loc>' . xmlEsc((string)$u['loc']) . "</loc>\n";
    if (isset($u['lastmod'])) echo '    <lastmod>' . xmlEsc((string)$u['lastmod']) . "</lastmod>\n";
    if (isset($u['changefreq'])) echo '    <changefreq>' . xmlEsc((string)$u['changefreq']) . "</changefreq>\n";
    if (isset($u['priority'])) echo '    <priority>' . xmlEsc((string)$u['priority']) . "</priority>\n";
    if (isset($u['alternates'])) {
        foreach ($u['alternates'] as $lang => $href) {
            echo '    <xhtml:link rel="alternate" hreflang="' . xmlEsc((string)$lang)
                . '" href="' . xmlEsc((string)$href) . '"/>' . "\n";
        }
    }
    if (isset($u['image'])) {
        echo "    <image:image>\n";
        echo '      <image:loc>' . xmlEsc((string)$u['image']) . "</image:loc>\n";
        echo '      <image:title>' . xmlEsc((string)$u['image_title']) . "</image:title>\n";
        echo "    </image:image>\n";
    }
    echo "  </url>\n";
}
echo "</urlset>\n";
