import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Trash2, Save, ExternalLink, Eye, ArrowLeft, AlertCircle, Loader2, Image as ImageIcon,
  Download, Stethoscope,
} from 'lucide-react';
import { api } from '@/api/apiClient';
import { blogAdmin, EMPTY_POST, slugify, readingMinutes } from '@/api/blogAdmin';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import OrbyloxMark from '@/components/OrbyloxMark';
import { ListSkeleton } from '@/components/motion/Skeletons';
import { Reveal } from '@/components/motion/Reveal';

/**
 * Redaktion für den Blog.
 *
 * Die Seite ist doppelt geschützt: hier wird sie nur gezeigt, wenn die
 * Anmeldung stimmt — und jeder Schreibvorgang wird zusätzlich im Server
 * geprüft (Firebase-Token + Admin-Liste). Selbst wer diese Oberfläche
 * nachbaut, kann nichts veröffentlichen.
 *
 * Der Text wird als Markdown geschrieben. Bewusst kein Rich-Text-Editor:
 * Markdown lässt sich versionieren, enthält kein fremdes HTML (und damit
 * keine Skripte) und ergibt beim Rendern eine saubere Überschriftenstruktur —
 * genau das, was für die Suchmaschine zählt.
 */

const STATUS = [
  { value: 'draft', de: 'Entwurf', en: 'Draft' },
  { value: 'scheduled', de: 'Geplant', en: 'Scheduled' },
  { value: 'published', de: 'Veröffentlicht', en: 'Published' },
];

function StatusBadge({ status }) {
  const map = {
    draft: 'bg-slate-200 text-slate-700',
    scheduled: 'bg-amber-500 text-white',
    published: 'bg-green-600 text-white',
  };
  const label = STATUS.find((s) => s.value === status)?.de || status;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 ${map[status] || map.draft}`}>
      {label}
    </span>
  );
}

/** Live-Vorschau: dieselbe Markdown-Teilmenge wie der Server. */
function previewHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) =>
    s
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<em>$1</em>');

  const out = [];
  let list = null;
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(esc(para.join(' ')))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  for (const raw of String(md || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); closeList(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); closeList(); const lv = Math.min(6, Math.max(2, h[1].length)); out.push(`<h${lv}>${inline(esc(h[2]))}</h${lv}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flush(); closeList(); out.push('<hr>'); continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flush(); closeList(); out.push(`<blockquote><p>${inline(esc(q[1]))}</p></blockquote>`); continue; }
    const ul = line.match(/^[-*+]\s+(.*)$/);
    if (ul) { flush(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(esc(ul[1]))}</li>`); continue; }
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) { flush(); if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(esc(ol[1]))}</li>`); continue; }
    closeList();
    para.push(line);
  }
  flush(); closeList();
  return out.join('\n');
}

function Field({ label, hint, children, counter }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</Label>
        {counter != null && (
          <span className={`text-[11px] ${counter.over ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
            {counter.text}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function BlogAdmin() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [diag, setDiag] = useState(null);

  // Kein Index für die Redaktion — zusätzlich zum Header aus .htaccess
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    document.head.appendChild(tag);
    const prevTitle = document.title;
    document.title = 'Redaktion — ORBYLOX';
    return () => { document.head.removeChild(tag); document.title = prevTitle; };
  }, []);

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false,
  });
  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['isAdmin'],
    queryFn: () => api.auth.isAdmin(),
    enabled: !!currentUser,
  });

  const { data: posts = [], isLoading, isError, error: loadError } = useQuery({
    queryKey: ['blogPosts'],
    queryFn: blogAdmin.list,
    enabled: !!isAdmin,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: blogAdmin.save,
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      setEditing(saved);
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  /** Startartikel aus blog-posts.seed.json nachziehen. */
  const seedMutation = useMutation({
    mutationFn: blogAdmin.seed,
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      setNotice(r.message + (r.published ? ` ${r.published} veröffentlicht.` : ''));
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  const diagMutation = useMutation({
    mutationFn: blogAdmin.diag,
    onSuccess: (d) => { setDiag(d); setError(null); },
    onError: (e) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: blogAdmin.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      setEditing(null);
    },
    onError: (e) => setError(e.message),
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (!q) return true;
      return [p.title, p.slug, p.category, ...(p.tags || [])]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [posts, search, filter]);

  const set = (patch) => setEditing((prev) => ({ ...prev, ...patch }));

  const uploadCover = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      set({ featured_image: file_url, featured_alt: editing.featured_alt || editing.title });
    } catch (e) {
      setError(`Bild-Upload fehlgeschlagen: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (userLoading || adminLoading) {
    return <div className="p-8"><ListSkeleton count={4} /></div>;
  }

  if (!currentUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="border-2 border-black bg-white p-8 max-w-sm text-center">
          <OrbyloxMark className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Redaktion</h1>
          <p className="text-sm text-slate-600 mb-5">Bitte melde dich an.</p>
          <button
            type="button"
            onClick={() => api.auth.redirectToLogin('/admin')}
            className="h-11 px-5 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase"
          >
            Anmelden
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="border-2 border-black bg-white p-8 max-w-md text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-4 text-[#ef5a24]" />
          <h1 className="text-xl font-bold mb-2">Kein Zugriff</h1>
          <p className="text-sm text-slate-600">
            Dieser Bereich ist der Redaktion vorbehalten. Angemeldet als {currentUser.email}.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- Editor */
  if (editing) {
    const slugPreview = editing.slug || slugify(editing.title);
    const seoTitle = editing.seo_title || editing.title;
    const metaLen = (editing.meta_description || '').length;

    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex items-center gap-2 h-10 px-3 border-2 border-black bg-white text-xs font-bold uppercase"
          >
            <ArrowLeft className="w-4 h-4" /> Liste
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-2 h-10 px-3 border-2 border-black bg-white text-xs font-bold uppercase"
            >
              <Eye className="w-4 h-4" /> {showPreview ? 'Bearbeiten' : 'Vorschau'}
            </button>
            {editing.status === 'published' && editing.slug && (
              <a
                href={`/blog/${editing.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 h-10 px-3 border-2 border-black bg-white text-xs font-bold uppercase"
              >
                <ExternalLink className="w-4 h-4" /> Ansehen
              </a>
            )}
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(editing)}
              className="inline-flex items-center gap-2 h-10 px-4 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase disabled:opacity-60"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 border-2 border-red-500 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>
        )}

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Inhalt */}
          <div>
            <Field label="Titel">
              <Input
                value={editing.title}
                onChange={(e) => set({ title: e.target.value })}
                className="h-12 text-lg font-bold border-2"
                placeholder="Worum geht es?"
              />
            </Field>

            <Field label="URL" hint={`orbylox.de/blog/${slugPreview || '…'}`}>
              <Input
                value={editing.slug}
                onChange={(e) => set({ slug: slugify(e.target.value) })}
                onBlur={() => !editing.slug && set({ slug: slugify(editing.title) })}
                className="h-10 border-2 font-mono text-sm"
                placeholder="wird-aus-dem-titel-gebildet"
              />
            </Field>

            <Field label="Anrisstext" hint="Steht in der Übersicht und als Rückfallwert für die Beschreibung.">
              <Textarea
                value={editing.excerpt}
                onChange={(e) => set({ excerpt: e.target.value })}
                rows={2}
                className="border-2"
              />
            </Field>

            <Field
              label="Inhalt (Markdown)"
              hint="## für Zwischenüberschriften, - für Listen, [Text](URL) für Links."
              counter={{ text: `${readingMinutes(editing.content)} Min. Lesezeit` }}
            >
              {showPreview ? (
                <div
                  className="border-2 border-black p-5 prose-preview bg-white min-h-[400px] max-w-none
                             [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:mt-7 [&_h2]:mb-3
                             [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2
                             [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4
                             [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1
                             [&_a]:text-[#ef5a24] [&_a]:underline
                             [&_blockquote]:border-l-4 [&_blockquote]:border-[#ef5a24] [&_blockquote]:pl-4 [&_blockquote]:text-slate-600
                             [&_code]:bg-slate-100 [&_code]:px-1"
                  dangerouslySetInnerHTML={{ __html: previewHtml(editing.content) }}
                />
              ) : (
                <Textarea
                  value={editing.content}
                  onChange={(e) => set({ content: e.target.value })}
                  rows={22}
                  className="border-2 font-mono text-sm leading-relaxed"
                  placeholder={'## Einleitung\n\nText…\n\n- Punkt eins\n- Punkt zwei'}
                />
              )}
            </Field>
          </div>

          {/* Einstellungen */}
          <aside className="lg:sticky lg:top-4 lg:self-start space-y-1">
            <div className="border-2 border-black p-4 mb-4">
              <Field label="Status">
                <select
                  value={editing.status}
                  onChange={(e) => set({ status: e.target.value })}
                  className="w-full h-10 border-2 border-black px-2 text-sm bg-white"
                >
                  {STATUS.map((s) => <option key={s.value} value={s.value}>{s.de}</option>)}
                </select>
              </Field>
              <Field label="Veröffentlichen am" hint="Zukünftiges Datum = geplant.">
                <Input
                  type="datetime-local"
                  value={(editing.published_at || '').slice(0, 16)}
                  onChange={(e) => set({ published_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                  className="h-10 border-2"
                />
              </Field>
              <Field label="Sprache">
                <select
                  value={editing.locale}
                  onChange={(e) => set({ locale: e.target.value })}
                  className="w-full h-10 border-2 border-black px-2 text-sm bg-white"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Übersetzung von" hint="URL-Kennung der anderen Sprachfassung — erzeugt hreflang.">
                <Input value={editing.translation_of} onChange={(e) => set({ translation_of: e.target.value })} className="h-10 border-2 font-mono text-xs" />
              </Field>
            </div>

            <div className="border-2 border-black p-4 mb-4">
              <Field label="Titelbild">
                {editing.featured_image ? (
                  <div className="border-2 border-black mb-2">
                    <img src={editing.featured_image} alt="" className="w-full aspect-[16/10] object-cover" />
                  </div>
                ) : null}
                <label className="inline-flex items-center gap-2 h-10 px-3 border-2 border-black bg-white text-xs font-bold uppercase cursor-pointer">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  Bild wählen
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCover(e.target.files?.[0])} />
                </label>
              </Field>
              <Field label="Bildbeschreibung (alt)" hint="Für Suchmaschinen und Screenreader.">
                <Input value={editing.featured_alt} onChange={(e) => set({ featured_alt: e.target.value })} className="h-10 border-2" />
              </Field>
            </div>

            <div className="border-2 border-black p-4 mb-4">
              <Field label="Kategorie">
                <Input value={editing.category} onChange={(e) => set({ category: e.target.value })} className="h-10 border-2" placeholder="z. B. Projektmanagement" />
              </Field>
              <Field label="Schlagwörter" hint="Mit Komma trennen.">
                <Input
                  value={(editing.tags || []).join(', ')}
                  onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  className="h-10 border-2"
                />
              </Field>
              <Field label="Autor">
                <Input value={editing.author} onChange={(e) => set({ author: e.target.value })} className="h-10 border-2" />
              </Field>
              <Field label="Ähnliche Beiträge" hint="URL-Kennungen, mit Komma getrennt. Leer = automatisch.">
                <Input
                  value={(editing.related_slugs || []).join(', ')}
                  onChange={(e) => set({ related_slugs: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  className="h-10 border-2 font-mono text-xs"
                />
              </Field>
            </div>

            <div className="border-2 border-[#ef5a24] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#ef5a24] mb-3">Suchmaschine</p>
              <Field
                label="SEO-Titel"
                hint="Was in der Trefferliste steht."
                counter={{ text: `${seoTitle.length}/60`, over: seoTitle.length > 60 }}
              >
                <Input value={editing.seo_title} onChange={(e) => set({ seo_title: e.target.value })} className="h-10 border-2" placeholder={editing.title} />
              </Field>
              <Field
                label="Beschreibung"
                counter={{ text: `${metaLen}/160`, over: metaLen > 160 }}
              >
                <Textarea value={editing.meta_description} onChange={(e) => set({ meta_description: e.target.value })} rows={3} className="border-2" />
              </Field>
              <Field label="Kanonische URL" hint="Nur setzen, wenn der Text anderswo zuerst erschien.">
                <Input value={editing.canonical_url} onChange={(e) => set({ canonical_url: e.target.value })} className="h-10 border-2 font-mono text-xs" />
              </Field>

              {/* So sieht es in der Trefferliste aus */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Vorschau bei Google</p>
                <p className="text-[13px] text-slate-500 leading-tight">orbylox.de › blog › {slugPreview || '…'}</p>
                <p className="text-[#1a0dab] text-[17px] leading-snug truncate">{seoTitle || 'Titel'}</p>
                <p className="text-[13px] text-slate-600 leading-snug line-clamp-2">
                  {editing.meta_description || editing.excerpt || 'Beschreibung…'}
                </p>
              </div>
            </div>

            {editing.id && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`„${editing.title}“ endgültig löschen?`)) deleteMutation.mutate(editing.id);
                }}
                className="w-full h-10 border-2 border-red-500 text-red-600 text-xs font-bold uppercase inline-flex items-center justify-center gap-2 mt-4"
              >
                <Trash2 className="w-4 h-4" /> Löschen
              </button>
            )}
          </aside>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- Liste */
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <OrbyloxMark className="w-9 h-9 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-none">Redaktion</h1>
            <p className="text-xs text-slate-500 mt-1">
              {posts.length} Beiträge · {posts.filter((p) => p.status === 'published').length} veröffentlicht
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/blog" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-10 px-3 border-2 border-black bg-white text-xs font-bold uppercase">
            <ExternalLink className="w-4 h-4" /> Blog
          </a>
          <button
            type="button"
            onClick={() => diagMutation.mutate()}
            title="Datenordner und Startdatei prüfen"
            className="inline-flex items-center gap-2 h-10 px-3 border-2 border-black bg-white text-xs font-bold uppercase"
          >
            {diagMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
            Prüfen
          </button>
          <button
            type="button"
            onClick={() => { setEditing({ ...EMPTY_POST, author: currentUser?.full_name || 'ORBYLOX' }); setShowPreview(false); }}
            className="inline-flex items-center gap-2 h-10 px-4 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase"
          >
            <Plus className="w-4 h-4" /> Neuer Beitrag
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen…" className="h-10 pl-9 border-2" />
        </div>
        {['all', ...STATUS.map((s) => s.value)].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            className={`h-10 px-3 border-2 text-xs font-bold uppercase ${
              filter === v ? 'bg-black border-black text-white' : 'bg-white border-black text-black'
            }`}
          >
            {v === 'all' ? 'Alle' : STATUS.find((s) => s.value === v)?.de}
          </button>
        ))}
      </div>

      {notice && (
        <div className="border-2 border-green-600 bg-green-50 text-green-900 px-4 py-3 text-sm mb-4">{notice}</div>
      )}

      {diag && (
        <div className="border-2 border-black bg-[#f5f5f5] px-4 py-3 text-xs font-mono mb-4 space-y-1">
          <p><b>Datenordner:</b> {diag.data_dir} {diag.data_writable ? '(beschreibbar)' : '— NICHT BESCHREIBBAR'}</p>
          <p><b>Datei:</b> {diag.data_file} {diag.data_file_exists ? '(vorhanden)' : '(noch nicht angelegt)'}</p>
          <p><b>Startdatei:</b> {diag.seed_file_present ? `vorhanden, ${diag.seed_count} Artikel` : 'FEHLT in /api/'}</p>
          <p><b>Bestand:</b> {diag.posts} Beiträge, davon {diag.published} veröffentlicht</p>
          <button type="button" onClick={() => setDiag(null)} className="underline mt-1">schließen</button>
        </div>
      )}

      {/* Erstbefuellung: nur zeigen, wenn noch nichts da ist */}
      {!isLoading && !isError && posts.length === 0 && (
        <div className="border-2 border-[#ef5a24] bg-[#ef5a24]/8 p-5 mb-5">
          <p className="font-bold text-black mb-1">Noch keine Beiträge</p>
          <p className="text-sm text-slate-600 mb-4">
            Es liegen 10 fertige Artikel bereit (5 Themen, deutsch und englisch).
            Ein Klick spielt sie ein — vorhandene Beiträge werden dabei nie überschrieben.
          </p>
          <button
            type="button"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
            className="inline-flex items-center gap-2 h-11 px-5 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase disabled:opacity-60"
          >
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Startartikel einspielen
          </button>
        </div>
      )}

      {/* Spaeter: nachziehen, falls die Startdatei mehr enthaelt als der Bestand */}
      {!isLoading && !isError && posts.length > 0 && posts.length < 10 && (
        <div className="border-2 border-slate-200 p-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-600">
            In der Startdatei liegen weitere Artikel bereit, die noch nicht eingespielt sind.
          </p>
          <button
            type="button"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
            className="inline-flex items-center gap-2 h-10 px-4 border-2 border-black bg-white text-xs font-bold uppercase disabled:opacity-60"
          >
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Fehlende nachziehen
          </button>
        </div>
      )}

      {isError && (
        <div className="border-2 border-red-500 bg-red-50 text-red-800 px-4 py-3 text-sm mb-4">
          <p className="font-bold mb-1">Beiträge konnten nicht geladen werden.</p>
          <p>{loadError?.message}</p>
          <p className="mt-2 text-xs">
            Prüfe, ob <code>/api/blog-admin.php</code> auf dem Server liegt und der Datenordner beschreibbar ist
            (<code>/api/blog-admin.php</code> mit <code>action=diag</code>).
          </p>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton count={5} />
      ) : visible.length === 0 ? (
        <div className="border-2 border-slate-200 p-10 text-center">
          <p className="text-slate-500">{posts.length === 0 ? 'Noch keine Beiträge.' : 'Nichts gefunden.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p, i) => (
            <Reveal key={p.id} index={i}>
              <button
                type="button"
                onClick={() => { setEditing({ ...EMPTY_POST, ...p }); setShowPreview(false); }}
                className="w-full text-left border-2 border-slate-200 bg-white hover:border-black p-3 flex items-center gap-3"
              >
                <div className="w-16 h-12 shrink-0 bg-[#f5f5f5] overflow-hidden">
                  {p.featured_image && <img src={p.featured_image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge status={p.status} />
                    {p.category && <span className="text-[10px] uppercase tracking-wide text-slate-400">{p.category}</span>}
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">{p.locale}</span>
                  </div>
                  <p className="font-semibold text-slate-900 truncate">{p.title}</p>
                  <p className="text-xs text-slate-400 truncate font-mono">/blog/{p.slug}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString('de-DE') : '—'}
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
