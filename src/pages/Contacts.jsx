import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Upload, Plus, Check, Trash2, Search, Loader2, Pause, Play, Users, Flame, ArrowLeft,
} from 'lucide-react';
import { api } from '@/api/apiClient';
import {
  listContacts, createContact, updateContact, removeContact, createContactsBulk,
} from '@/api/contacts';
import { parseContactsFile, mergeContacts, emptyContact } from '@/lib/contactsImport';
import {
  pickSuggestions, markContacted, overdueDays, countDue, INTERVAL_OPTIONS,
} from '@/lib/contactSuggestions';
import { LanguageProvider, useLanguage } from '@/components/LanguageProvider';
import OrbyloxMark from '@/components/OrbyloxMark';
import { Reveal } from '@/components/motion/Reveal';
import { ListSkeleton } from '@/components/motion/Skeletons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { askDelete } from '@/lib/confirmDelete';

/**
 * Kontaktpflege.
 *
 * Der Kern ist eine einzige Frage: „Wen sollte ich heute mal wieder
 * anschreiben?“ Deshalb stehen die drei Vorschläge ganz oben und alles
 * andere darunter. Wer abhakt, sieht sofort den nächsten Namen — kein
 * Dialog, keine Rückfrage.
 */

const CARD = 'border-2 border-black bg-white';

function Stat({ icon: Icon, value, label }) {
  return (
    <div className={`${CARD} p-4 flex items-center gap-3`}>
      <Icon className="w-5 h-5 text-[#ef5a24] shrink-0" />
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

/** Auswahl des Takts — als echtes Auswahlfeld, damit es überall gleich aussieht. */
function IntervalSelect({ value, onChange, de, className = '' }) {
  return (
    <select
      value={String(value ?? 90)}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`h-9 px-2 border-2 border-black bg-white text-sm ${className}`}
      aria-label={de ? 'Takt' : 'Rhythm'}
    >
      {INTERVAL_OPTIONS.map((o) => (
        <option key={o.days} value={o.days}>{de ? o.de : o.en}</option>
      ))}
    </select>
  );
}

function ContactsContent() {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const de = language === 'de';

  const [search, setSearch] = useState('');
  const [doneToday, setDoneToday] = useState([]);
  const [importInfo, setImportInfo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const fileRef = useRef(null);

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => api.auth.me(), retry: false });
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: listContacts,
    enabled: !!user,
  });

  useEffect(() => { document.title = de ? 'Kontakte — ORBYLOX' : 'Contacts — ORBYLOX'; }, [de]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contacts'] });

  const saveOne = useMutation({ mutationFn: updateContact, onSuccess: invalidate, onError: (e) => setError(e.message) });
  const addOne = useMutation({ mutationFn: createContact, onSuccess: invalidate, onError: (e) => setError(e.message) });
  const delOne = useMutation({ mutationFn: removeContact, onSuccess: invalidate, onError: (e) => setError(e.message) });

  const suggestions = useMemo(
    () => pickSuggestions(contacts, { alreadyDoneIds: doneToday }),
    [contacts, doneToday],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.company, c.phone].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  }, [contacts, search]);

  const totalContacts = contacts.reduce((n, c) => n + (c.contactCount || 0), 0);

  /** Abhaken: Zähler hoch, Zeitpunkt setzen, nächster rückt nach. */
  const markDone = (contact) => {
    setDoneToday((prev) => [...prev, contact.id]);
    saveOne.mutate(markContacted(contact));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError(null); setImportInfo(null);
    try {
      const text = await file.text();
      const parsed = parseContactsFile(file.name, text);
      if (!parsed.length) {
        setError(de
          ? 'In der Datei wurden keine Kontakte gefunden. Erwartet wird .vcf oder .csv aus deinem Adressbuch.'
          : 'No contacts found in that file. Expecting .vcf or .csv from your address book.');
        return;
      }
      const { added, duplicates } = mergeContacts(contacts, parsed);
      if (added.length) await createContactsBulk(added);
      await invalidate();
      setImportInfo(de
        ? `${added.length} Kontakte übernommen${duplicates.length ? `, ${duplicates.length} waren schon da` : ''}.`
        : `${added.length} contacts imported${duplicates.length ? `, ${duplicates.length} already there` : ''}.`);
    } catch (err) {
      setError(`${de ? 'Import fehlgeschlagen' : 'Import failed'}: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="border-b-2 border-black sticky top-0 bg-white z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/ProjectsList" className="flex items-center gap-2 group">
            <OrbyloxMark className="w-8 h-8 shrink-0 transition-transform group-hover:-rotate-6" />
            <span className="font-extrabold tracking-tight">RBYLOX</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 px-4 border-2 border-black bg-white text-xs font-bold uppercase disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {de ? 'Importieren' : 'Import'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".vcf,.vcard,.csv,.txt,text/vcard,text/csv"
              className="hidden"
              onChange={onFile}
            />
            <button
              type="button"
              onClick={() => setDraft(emptyContact())}
              className="inline-flex items-center gap-2 h-10 px-4 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase"
            >
              <Plus className="w-4 h-4" /> {de ? 'Neu' : 'New'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Link to="/ProjectsList" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> {de ? 'Zu den Projekten' : 'To projects'}
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
          {de ? 'Kontaktpflege' : 'Staying in touch'}
        </h1>
        <p className="text-slate-600 mb-8 max-w-2xl">
          {de
            ? 'Drei Vorschläge am Tag. Wer abgehakt ist, kommt erst nach dem eingestellten Takt wieder.'
            : 'Three suggestions a day. Once ticked off, a person only returns after their set rhythm.'}
        </p>

        {error && <div className="border-2 border-red-600 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">{error}</div>}
        {importInfo && <div className="border-2 border-green-600 bg-green-50 text-green-900 px-4 py-3 text-sm mb-6">{importInfo}</div>}

        {/* ---------------------------------------------------- Kennzahlen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
          <Stat icon={Users} value={contacts.length} label={de ? 'Kontakte' : 'Contacts'} />
          <Stat icon={Flame} value={countDue(contacts)} label={de ? 'gerade fällig' : 'due now'} />
          <Stat icon={Check} value={totalContacts} label={de ? 'Kontakte insgesamt aufgenommen' : 'times reached out'} />
        </div>

        {/* --------------------------------------------------- Vorschläge */}
        <section className="mb-12">
          <h2 className="text-2xl font-black tracking-tight mb-4">
            {de ? 'Heute vorgeschlagen' : "Today's suggestions"}
          </h2>

          {isLoading && <ListSkeleton count={3} />}

          {!isLoading && contacts.length === 0 && (
            <div className="border-2 border-[#ef5a24] bg-[#ef5a24]/8 p-6">
              <p className="font-bold mb-1">{de ? 'Noch keine Kontakte' : 'No contacts yet'}</p>
              <p className="text-sm text-slate-600 mb-4 max-w-2xl">
                {de
                  ? 'Exportiere dein Adressbuch als .vcf oder .csv — iPhone: Kontakte teilen; Google Kontakte: Exportieren; Outlook: Datei → Exportieren. Dann hier importieren.'
                  : 'Export your address book as .vcf or .csv — iPhone: share contacts; Google Contacts: export; Outlook: File → Export. Then import it here.'}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 h-11 px-5 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase"
              >
                <Upload className="w-4 h-4" /> {de ? 'Adressbuch importieren' : 'Import address book'}
              </button>
            </div>
          )}

          {!isLoading && contacts.length > 0 && suggestions.length === 0 && (
            <p className="text-slate-500">
              {de ? 'Für heute erledigt. Morgen gibt es neue Vorschläge.' : 'Done for today. New suggestions tomorrow.'}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.map((c, i) => {
              const over = overdueDays(c);
              return (
                <Reveal key={c.id} index={i}>
                  <article className={`${CARD} p-5 h-full flex flex-col`}>
                    <h3 className="font-bold text-lg leading-tight">{c.name}</h3>
                    {c.company && <p className="text-sm text-slate-500">{c.company}</p>}
                    {c.email && <p className="text-sm text-slate-500 truncate">{c.email}</p>}
                    {c.phone && <p className="text-sm text-slate-500">{c.phone}</p>}

                    <p className="text-xs mt-3 text-slate-500">
                      {c.lastContactedAt
                        ? (de
                          ? `Zuletzt vor ${Math.max(0, Math.floor((Date.now() - Date.parse(c.lastContactedAt)) / 86400000))} Tagen · ${c.contactCount}× kontaktiert`
                          : `Last ${Math.max(0, Math.floor((Date.now() - Date.parse(c.lastContactedAt)) / 86400000))} days ago · reached out ${c.contactCount}×`)
                        : (de ? 'Noch nie kontaktiert' : 'Never contacted')}
                    </p>
                    {over > 0 && (
                      <p className="text-xs font-bold text-[#ef5a24] mt-1">
                        {de ? `${over} Tage überfällig` : `${over} days overdue`}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <IntervalSelect
                        de={de}
                        value={c.intervalDays}
                        onChange={(days) => saveOne.mutate({ ...c, intervalDays: days })}
                      />
                    </div>

                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => markDone(c)}
                      className="mt-4 inline-flex items-center justify-center gap-2 h-11 px-4 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase w-full"
                    >
                      <Check className="w-4 h-4" /> {de ? 'Kontaktiert' : 'Contacted'}
                    </button>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* --------------------------------------------- Neuer Kontakt */}
        {draft && (
          <section className={`${CARD} p-5 mb-10`}>
            <h2 className="font-bold mb-4">{de ? 'Neuer Kontakt' : 'New contact'}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold uppercase">{de ? 'Name' : 'Name'}</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase">E-Mail</Label>
                <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase">{de ? 'Telefon' : 'Phone'}</Label>
                <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase">{de ? 'Firma' : 'Company'}</Label>
                <Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase">{de ? 'Takt' : 'Rhythm'}</Label>
                <div><IntervalSelect de={de} value={draft.intervalDays} onChange={(d2) => setDraft({ ...draft, intervalDays: d2 })} /></div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!draft.name.trim()}
                onClick={() => { addOne.mutate(draft); setDraft(null); }}
                className="h-10 px-4 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase disabled:opacity-50"
              >
                {de ? 'Speichern' : 'Save'}
              </button>
              <button type="button" onClick={() => setDraft(null)} className="h-10 px-4 border-2 border-black bg-white text-xs font-bold uppercase">
                {de ? 'Abbrechen' : 'Cancel'}
              </button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------- Alle Kontakte */}
        {contacts.length > 0 && (
          <section>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="text-2xl font-black tracking-tight">
                {de ? 'Alle Kontakte' : 'All contacts'}
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={de ? 'Suchen…' : 'Search…'}
                  className="pl-9 w-64 max-w-full"
                />
              </div>
            </div>

            <div className={`${CARD} divide-y-2 divide-black`}>
              {filtered.map((c) => (
                <div key={c.id} className="p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold truncate ${c.paused ? 'text-slate-400' : ''}`}>{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {[c.company, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {c.contactCount}× {de ? 'kontaktiert' : 'contacted'}
                  </span>
                  <IntervalSelect
                    de={de}
                    value={c.intervalDays}
                    onChange={(days) => saveOne.mutate({ ...c, intervalDays: days })}
                  />
                  <button
                    type="button"
                    title={c.paused ? (de ? 'Wieder vorschlagen' : 'Suggest again') : (de ? 'Nicht mehr vorschlagen' : 'Stop suggesting')}
                    onClick={() => saveOne.mutate({ ...c, paused: !c.paused })}
                    className="h-9 w-9 grid place-items-center border-2 border-black bg-white shrink-0"
                  >
                    {c.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    title={de ? 'Löschen' : 'Delete'}
                    onClick={async () => { if (await askDelete({ kind: 'contact', itemName: c.name })) delOne.mutate(c.id); }}
                    className="h-9 w-9 grid place-items-center border-2 border-black bg-white text-red-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="p-4 text-sm text-slate-500">{de ? 'Nichts gefunden.' : 'Nothing found.'}</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function Contacts() {
  return (
    <LanguageProvider>
      <ContactsContent />
    </LanguageProvider>
  );
}
