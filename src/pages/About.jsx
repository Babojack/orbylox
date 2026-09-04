import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Save, X, Plus, Trash2, Loader2, ImagePlus, Mail, LinkIcon,
} from 'lucide-react';
import { api } from '@/api/apiClient';
import { loadAbout, saveAbout, emptyMember, ABOUT_FALLBACK } from '@/api/about';
import { LanguageProvider, useLanguage } from '@/components/LanguageProvider';
import OrbyloxMark from '@/components/OrbyloxMark';
import { Reveal } from '@/components/motion/Reveal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/**
 * "Über uns" — öffentlich lesbar, im Browser bearbeitbar.
 *
 * Der Inhalt liegt nicht im Quelltext, sondern in about.json auf dem Server.
 * Das ist der ganze Sinn der Seite: Text und Fotos sollen sich ändern lassen,
 * ohne dass jemand die Anwendung neu baut und hochlädt. Wer angemeldet und in
 * der Admin-Liste ist, sieht oben "Bearbeiten" und schreibt direkt in der
 * Seite — was bearbeitet wird, sieht dabei genauso aus wie das Ergebnis.
 */

/**
 * Absätze aus einem Fließtext. Bewusst kein Markdown: hier soll jemand ohne
 * Vorkenntnisse schreiben können. Leerzeile = neuer Absatz, einfacher
 * Zeilenumbruch bleibt ein Umbruch.
 */
function Paragraphs({ text, className = '' }) {
  const parts = String(text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        const lines = p.split('\n');
        return (
          <p key={i} className={className}>
            {lines.map((line, j) => (
              <span key={j}>
                {line}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** Kreisförmiges Foto mit Initialen als Rückfallebene. */
function Portrait({ src, name, className = '' }) {
  const initials = String(name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join('');
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`w-full h-full flex items-center justify-center bg-[#ef5a24]/10 text-[#ef5a24] text-2xl font-black ${className}`}>
      {initials || '?'}
    </div>
  );
}

/** Bild wählen und hochladen — nutzt denselben Endpunkt wie überall sonst. */
function PhotoPicker({ value, onChange, label, round = true }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Bitte eine Bilddatei wählen.'); return; }
    if (file.size > 8 * 1024 * 1024) { setErr('Das Bild ist zu groß (max. 8 MB).'); return; }
    setBusy(true); setErr(null);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } catch (e2) {
      setErr(`Upload fehlgeschlagen: ${e2.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className={`w-16 h-16 shrink-0 overflow-hidden border-2 border-black ${round ? 'rounded-full' : ''}`}>
          <Portrait src={value} name={label} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="inline-flex items-center gap-2 h-9 px-3 border-2 border-black bg-white text-xs font-bold uppercase cursor-pointer">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {value ? 'Foto ersetzen' : 'Foto wählen'}
            <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
          </label>
          {value && (
            <button type="button" onClick={() => onChange('')} className="text-xs text-red-600 underline text-left">
              Foto entfernen
            </button>
          )}
        </div>
      </div>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}

/**
 * Arbeitskopie zum Bearbeiten. Tiefe Kopie, damit ein Verwerfen wirklich
 * verwirft — und mit aufgefuellten Feldern, damit im Formular nirgends
 * "undefined" landet, falls die gespeicherte Datei ein Feld noch nicht kennt.
 */
function draftFrom(content) {
  const c = JSON.parse(JSON.stringify(content || {}));
  return {
    ...ABOUT_FALLBACK,
    ...c,
    hero_image: c.hero_image || '',
    hero_alt: c.hero_alt || '',
    de: { ...ABOUT_FALLBACK.de, ...(c.de || {}) },
    en: { ...ABOUT_FALLBACK.en, ...(c.en || {}) },
    team: (c.team || []).map((m) => ({ ...emptyMember(), ...m })),
  };
}

function AboutContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const de = language === 'de';
  const lang = de ? 'de' : 'en';

  const [editing, setEditing] = useState(null); // null = Ansicht, sonst Entwurf
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const { data: content = ABOUT_FALLBACK, isLoading } = useQuery({
    queryKey: ['aboutContent'],
    queryFn: loadAbout,
    staleTime: 5 * 60 * 1000,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false,
  });
  const { data: isAdmin = false } = useQuery({
    queryKey: ['isAdmin'],
    queryFn: () => api.auth.isAdmin(),
    enabled: !!currentUser,
  });

  useEffect(() => {
    document.title = de ? 'Über uns — ORBYLOX' : 'About us — ORBYLOX';
  }, [de]);

  const save = useMutation({
    mutationFn: saveAbout,
    onSuccess: (fresh) => {
      queryClient.setQueryData(['aboutContent'], fresh);
      setEditing(null);
      setError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    },
    onError: (e) => setError(e.message),
  });

  const view = editing || content;
  const text = view[lang] || ABOUT_FALLBACK[lang];
  const team = view.team || [];

  const patchLang = (patch) =>
    setEditing((prev) => ({ ...prev, [lang]: { ...prev[lang], ...patch } }));
  const patchMember = (id, patch) =>
    setEditing((prev) => ({
      ...prev,
      team: prev.team.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  return (
    <div className="min-h-screen bg-white">
      {/* Kopfzeile */}
      <header className="border-b-2 border-black sticky top-0 bg-white/95 backdrop-blur-sm z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group" title={de ? 'Zur Startseite' : 'To the homepage'}>
            <OrbyloxMark className="w-8 h-8 shrink-0 transition-transform group-hover:-rotate-6" />
            <span className="font-extrabold tracking-tight">RBYLOX</span>
          </Link>

          <div className="flex items-center gap-2">
            {isAdmin && !editing && (
              <button
                type="button"
                onClick={() => { setEditing(draftFrom(content)); setError(null); }}
                className="inline-flex items-center gap-2 h-10 px-4 border-2 border-black bg-white text-xs font-bold uppercase"
              >
                <Pencil className="w-4 h-4" /> {de ? 'Bearbeiten' : 'Edit'}
              </button>
            )}
            {editing && (
              <>
                <button
                  type="button"
                  onClick={() => { setEditing(null); setError(null); }}
                  className="inline-flex items-center gap-2 h-10 px-4 border-2 border-black bg-white text-xs font-bold uppercase"
                >
                  <X className="w-4 h-4" /> {de ? 'Verwerfen' : 'Discard'}
                </button>
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate(editing)}
                  className="inline-flex items-center gap-2 h-10 px-4 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase disabled:opacity-60"
                >
                  {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {de ? 'Speichern' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> {de ? 'Zurück' : 'Back'}
        </button>

        {error && (
          <div className="border-2 border-red-600 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">{error}</div>
        )}
        {saved && (
          <div className="border-2 border-green-600 bg-green-50 text-green-900 px-4 py-3 text-sm mb-6">
            {de ? 'Gespeichert.' : 'Saved.'}
          </div>
        )}
        {editing && (
          <div className="border-2 border-[#ef5a24] bg-[#ef5a24]/8 px-4 py-3 text-sm mb-6">
            {de
              ? 'Bearbeitungsmodus — du änderst gerade die deutsche Fassung. Über den Sprachschalter kommst du zur englischen; Fotos und Namen gelten für beide.'
              : 'Edit mode — you are changing the English version. Use the language switch for the German one; photos and names apply to both.'}
          </div>
        )}

        {isLoading && !editing ? (
          <div className="space-y-4">
            <div className="h-10 w-2/3 bg-slate-100 animate-pulse" />
            <div className="h-4 w-full bg-slate-100 animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-100 animate-pulse" />
            <div className="h-64 w-full bg-slate-100 animate-pulse mt-6" />
          </div>
        ) : (
          <>
            {/* ------------------------------------------------- Kopfbereich */}
            <Reveal>
              {editing ? (
                <div className="space-y-3 mb-8">
                  <div>
                    <Label className="text-xs font-bold uppercase">{de ? 'Überschrift' : 'Headline'}</Label>
                    <Input value={text.headline} onChange={(e) => patchLang({ headline: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase">{de ? 'Kurzer Vorspann' : 'Intro'}</Label>
                    <Textarea rows={3} value={text.intro} onChange={(e) => patchLang({ intro: e.target.value })} />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
                    {text.headline}
                  </h1>
                  {text.intro && (
                    <p className="mt-4 text-lg text-slate-600 leading-relaxed max-w-3xl">{text.intro}</p>
                  )}
                </>
              )}
            </Reveal>

            {/* ------------------------------------------------------ Kopfbild */}
            <Reveal delay={0.05}>
              <div className="mt-8">
                {editing ? (
                  <div className="border-2 border-black p-4 space-y-3">
                    <p className="text-xs font-bold uppercase">{de ? 'Kopfbild' : 'Header image'}</p>
                    <PhotoPicker
                      round={false}
                      label={de ? 'Kopfbild' : 'Header image'}
                      value={editing.hero_image}
                      onChange={(url) => setEditing((p) => ({ ...p, hero_image: url }))}
                    />
                    <div>
                      <Label className="text-xs font-bold uppercase">
                        {de ? 'Bildbeschreibung (für Screenreader)' : 'Image description'}
                      </Label>
                      <Input
                        value={editing.hero_alt}
                        onChange={(e) => setEditing((p) => ({ ...p, hero_alt: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : (
                  view.hero_image && (
                    <img
                      src={view.hero_image}
                      alt={view.hero_alt || text.headline}
                      className="w-full max-h-[420px] object-contain bg-[#f5f5f5]"
                    />
                  )
                )}
              </div>
            </Reveal>

            {/* -------------------------------------------------- Unsere Geschichte */}
            <Reveal delay={0.1}>
              <section className="mt-12">
                {editing ? (
                  <div>
                    <Label className="text-xs font-bold uppercase">{de ? 'Text über uns' : 'About text'}</Label>
                    <Textarea
                      rows={10}
                      value={text.story}
                      onChange={(e) => patchLang({ story: e.target.value })}
                      placeholder={de ? 'Leerzeile = neuer Absatz' : 'Blank line = new paragraph'}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {de ? 'Eine Leerzeile beginnt einen neuen Absatz.' : 'A blank line starts a new paragraph.'}
                    </p>
                  </div>
                ) : (
                  <div className="prose-orbylox max-w-3xl space-y-4">
                    <Paragraphs text={text.story} className="text-slate-700 leading-relaxed" />
                  </div>
                )}
              </section>
            </Reveal>

            {/* --------------------------------------------------------- Mission */}
            <Reveal delay={0.14}>
              <section className="mt-12 border-2 border-black p-6 sm:p-8 bg-[#f5f5f5]">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-bold uppercase">{de ? 'Titel' : 'Title'}</Label>
                      <Input value={text.mission_title} onChange={(e) => patchLang({ mission_title: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase">{de ? 'Text' : 'Text'}</Label>
                      <Textarea rows={4} value={text.mission} onChange={(e) => patchLang({ mission: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  (text.mission_title || text.mission) && (
                    <>
                      {text.mission_title && (
                        <h2 className="text-2xl font-black tracking-tight mb-3">{text.mission_title}</h2>
                      )}
                      <Paragraphs text={text.mission} className="text-slate-700 leading-relaxed" />
                    </>
                  )
                )}
              </section>
            </Reveal>

            {/* ------------------------------------------------------------ Team */}
            <section className="mt-14">
              <Reveal delay={0.18}>
                {editing ? (
                  <div className="space-y-3 mb-6">
                    <div>
                      <Label className="text-xs font-bold uppercase">{de ? 'Überschrift Team' : 'Team headline'}</Label>
                      <Input value={text.team_title} onChange={(e) => patchLang({ team_title: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase">{de ? 'Einleitung Team' : 'Team intro'}</Label>
                      <Input value={text.team_intro} onChange={(e) => patchLang({ team_intro: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  (text.team_title || text.team_intro) && (
                    <div className="mb-8">
                      {text.team_title && (
                        <h2 className="text-3xl font-black tracking-tight">{text.team_title}</h2>
                      )}
                      {text.team_intro && <p className="mt-2 text-slate-600">{text.team_intro}</p>}
                    </div>
                  )
                )}
              </Reveal>

              {!editing && team.length === 0 && (
                <p className="text-slate-500">
                  {de ? 'Noch keine Teammitglieder eingetragen.' : 'No team members yet.'}
                </p>
              )}

              {/* Ansicht */}
              {!editing && team.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {team.map((m, i) => (
                    <Reveal key={m.id} index={i}>
                      <article className="border-2 border-black bg-white p-6 h-full flex flex-col items-center text-center">
                        <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-black mb-4">
                          <Portrait src={m.photo} name={m.name} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900">{m.name}</h3>
                        {(de ? m.role_de : m.role_en) && (
                          <p className="text-xs font-bold uppercase tracking-wide text-[#ef5a24] mt-1">
                            {de ? m.role_de : m.role_en}
                          </p>
                        )}
                        {(de ? m.bio_de : m.bio_en) && (
                          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                            {de ? m.bio_de : m.bio_en}
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-3 text-slate-500">
                          {m.email && (
                            <a href={`mailto:${m.email}`} title={m.email} className="hover:text-[#ef5a24]">
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {m.link && (
                            <a
                              href={m.link}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              title={m.link}
                              className="hover:text-[#ef5a24]"
                            >
                              <LinkIcon className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </article>
                    </Reveal>
                  ))}
                </div>
              )}

              {/* Bearbeiten */}
              {editing && (
                <div className="space-y-6">
                  {editing.team.map((m, i) => (
                    <div key={m.id} className="border-2 border-black p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <span className="text-xs font-bold uppercase text-slate-500">
                          {de ? 'Person' : 'Person'} {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditing((p) => ({ ...p, team: p.team.filter((x) => x.id !== m.id) }))
                          }
                          className="inline-flex items-center gap-1 text-xs text-red-600"
                        >
                          <Trash2 className="w-4 h-4" /> {de ? 'Entfernen' : 'Remove'}
                        </button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <PhotoPicker
                            label={m.name}
                            value={m.photo}
                            onChange={(url) => patchMember(m.id, { photo: url })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase">{de ? 'Name' : 'Name'}</Label>
                          <Input value={m.name} onChange={(e) => patchMember(m.id, { name: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase">
                            {de ? 'Rolle (deutsch)' : 'Role (German)'}
                          </Label>
                          <Input value={m.role_de} onChange={(e) => patchMember(m.id, { role_de: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase">
                            {de ? 'Rolle (englisch)' : 'Role (English)'}
                          </Label>
                          <Input value={m.role_en} onChange={(e) => patchMember(m.id, { role_en: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase">E-Mail</Label>
                          <Input value={m.email} onChange={(e) => patchMember(m.id, { email: e.target.value })} />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs font-bold uppercase">
                            {de ? 'Kurztext (deutsch)' : 'Short text (German)'}
                          </Label>
                          <Textarea rows={3} value={m.bio_de} onChange={(e) => patchMember(m.id, { bio_de: e.target.value })} />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs font-bold uppercase">
                            {de ? 'Kurztext (englisch)' : 'Short text (English)'}
                          </Label>
                          <Textarea rows={3} value={m.bio_en} onChange={(e) => patchMember(m.id, { bio_en: e.target.value })} />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs font-bold uppercase">
                            {de ? 'Link (z. B. LinkedIn)' : 'Link (e.g. LinkedIn)'}
                          </Label>
                          <Input value={m.link} onChange={(e) => patchMember(m.id, { link: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setEditing((p) => ({ ...p, team: [...p.team, emptyMember()] }))}
                    className="inline-flex items-center gap-2 h-11 px-5 border-2 border-black bg-white text-xs font-bold uppercase"
                  >
                    <Plus className="w-4 h-4" /> {de ? 'Person hinzufügen' : 'Add person'}
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        <div className="mt-16 pt-8 border-t-2 border-black flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} ORBYLOX</span>
          <span className="flex gap-4">
            <a href="/blog" className="hover:text-[#ef5a24]">Blog</a>
            <Link to="/Impressum" className="hover:text-[#ef5a24]">
              {de ? 'Impressum' : 'Legal notice'}
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function About() {
  return (
    <LanguageProvider>
      <AboutContent />
    </LanguageProvider>
  );
}
