import { auth as firebaseAuth } from '@/lib/firebase';

/**
 * Anbindung an blog-admin.php.
 *
 * Jeder Aufruf trägt das Firebase-ID-Token im Authorization-Header. Der Server
 * prüft es gegen Googles Zertifikate und danach, ob die E-Mail in der
 * Admin-Liste steht. Der Browser entscheidet also nichts — er zeigt die
 * Oberfläche nur an oder nicht; die eigentliche Sperre sitzt im Server.
 */

const ENDPOINT =
  import.meta.env.VITE_BLOG_ADMIN_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/api/blog-admin.php` : '');

async function call(action, payload = {}) {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Nicht angemeldet.');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Kommt vor, wenn PHP eine Warnung ausgibt oder der Pfad falsch ist —
    // dann steht HTML statt JSON in der Antwort.
    throw new Error(`Unerwartete Antwort vom Server (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

export const blogAdmin = {
  list: () => call('list').then((d) => d.posts || []),
  get: (id) => call('get', { id }).then((d) => d.post),
  save: (post) => call('save', post).then((d) => d.post),
  remove: (id) => call('delete', { id }),
  diag: () => call('diag'),
  /** Startartikel einspielen — fuegt nur hinzu, was fehlt. */
  seed: () => call('seed'),
};

export const EMPTY_POST = {
  id: '',
  title: '',
  slug: '',
  locale: 'de',
  excerpt: '',
  featured_image: '',
  featured_alt: '',
  content: '',
  category: '',
  tags: [],
  author: 'ORBYLOX',
  published_at: '',
  seo_title: '',
  meta_description: '',
  og_image: '',
  canonical_url: '',
  status: 'draft',
  related_slugs: [],
  translation_of: '',
};

/** Gleiche Regel wie im Server, damit die Vorschau der URL stimmt. */
export function slugify(text) {
  return String(text || '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function readingMinutes(markdown) {
  const plain = String(markdown || '').replace(/<[^>]*>/g, ' ').trim();
  const words = plain ? plain.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}
