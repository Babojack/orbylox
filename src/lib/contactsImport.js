/**
 * Kontakte aus vCard- und CSV-Dateien einlesen.
 *
 * Warum Datei-Import und keine Adressbuch-Schnittstelle: der Browser hat
 * keinen Zugriff auf das Adressbuch des Rechners. Die Contact Picker API gibt
 * es ausschließlich in Chrome auf Android. Ein Import aus .vcf oder .csv
 * funktioniert dagegen überall — und jedes Adressbuch (iPhone, Google,
 * Outlook, Thunderbird) kann eines von beiden exportieren.
 *
 * Die Regeln beider Formate sind unangenehm: vCard faltet lange Zeilen um,
 * kodiert Umlaute je nach Version unterschiedlich und trennt Namensteile mit
 * Semikolons, die selbst maskiert sein können. CSV wiederum benennt seine
 * Spalten in jedem Programm anders. Beides steckt hier drin, mit Tests.
 */

/** Ein leerer Kontakt — eine Stelle, an der die Felder festgelegt sind. */
export function emptyContact() {
  return {
    name: '',
    email: '',
    phone: '',
    company: '',
    note: '',
    /** Takt in Tagen, 0 = kein fester Takt. */
    intervalDays: 90,
    /** Wie oft schon kontaktiert. */
    contactCount: 0,
    /** ISO-Zeitpunkt des letzten Kontakts, null = noch nie. */
    lastContactedAt: null,
    /** Aus der Vorschlagsauswahl herausnehmen, ohne zu löschen. */
    paused: false,
  };
}

/* ------------------------------------------------------------------ vCard */

/**
 * Umgebrochene Zeilen wieder zusammenfügen.
 *
 * vCard begrenzt Zeilen auf 75 Zeichen; der Rest steht in der nächsten Zeile,
 * eingeleitet durch ein Leerzeichen oder einen Tabulator. Ohne dieses
 * Zusammenfügen zerfällt jeder längere Name.
 */
function unfold(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');
}

/** Maskierungen innerhalb eines vCard-Wertes auflösen. */
function unescapeVCard(v) {
  return String(v || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Nach Semikolons trennen, maskierte Semikolons dabei stehen lassen. */
function splitEscaped(value, sep = ';') {
  const out = [];
  let cur = '';
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i];
    if (c === '\\' && i + 1 < value.length) { cur += c + value[i + 1]; i += 1; continue; }
    if (c === sep) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** QUOTED-PRINTABLE, wie es ältere Outlook-Exporte schreiben. */
function decodeQuotedPrintable(v) {
  const bytes = [];
  const s = String(v).replace(/=\n/g, '');
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i));
    }
  }
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return s;
  }
}

/** Eine vCard-Zeile in Name, Parameter und Wert zerlegen. */
function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  let value = line.slice(colon + 1);
  const parts = splitEscaped(left, ';');
  const name = (parts[0] || '').split('.').pop().toUpperCase(); // "item1.TEL" -> "TEL"
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) params[p.toUpperCase()] = true;
    else params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  if (String(params.ENCODING || '').toUpperCase().includes('QUOTED-PRINTABLE')) {
    value = decodeQuotedPrintable(value);
  }
  return { name, params, value };
}

/** Namen aus N zusammensetzen: Nachname;Vorname;Zusatz;Anrede;Suffix */
function nameFromN(value) {
  const [last = '', first = '', middle = '', prefix = ''] = splitEscaped(value, ';').map(unescapeVCard);
  return [prefix, first, middle, last].map((s) => s.trim()).filter(Boolean).join(' ');
}

/**
 * vCard-Text in Kontakte umwandeln. Verarbeitet 2.1, 3.0 und 4.0.
 */
export function parseVCard(text) {
  const lines = unfold(text).split('\n');
  const out = [];
  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const up = line.toUpperCase();
    if (up === 'BEGIN:VCARD') { cur = emptyContact(); continue; }
    if (up === 'END:VCARD') {
      if (cur && (cur.name || cur.email || cur.phone)) {
        if (!cur.name) cur.name = cur.email || cur.phone;
        out.push(cur);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const p = parseLine(line);
    if (!p) continue;

    switch (p.name) {
      case 'FN':
        cur.name = unescapeVCard(p.value).trim();
        break;
      case 'N':
        // FN hat Vorrang; N nur nehmen, wenn noch nichts da ist.
        if (!cur.name) cur.name = nameFromN(p.value);
        else cur._n = nameFromN(p.value);
        break;
      case 'EMAIL':
        if (!cur.email) cur.email = unescapeVCard(p.value).trim();
        break;
      case 'TEL':
        if (!cur.phone) cur.phone = unescapeVCard(p.value).trim();
        break;
      case 'ORG':
        if (!cur.company) cur.company = splitEscaped(p.value, ';').map(unescapeVCard)[0]?.trim() || '';
        break;
      case 'NOTE':
        if (!cur.note) cur.note = unescapeVCard(p.value).trim().slice(0, 500);
        break;
      default:
        break;
    }
  }
  return out.map(({ _n, ...c }) => c);
}

/* -------------------------------------------------------------------- CSV */

/** CSV-Zeilen zerlegen — Anführungszeichen, Zeilenumbrüche in Feldern, "". */
export function parseCsvRows(text, sep) {
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delim = sep || guessDelimiter(s);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

/** Trennzeichen raten: Komma, Semikolon oder Tabulator. */
export function guessDelimiter(text) {
  const head = String(text || '').split('\n').slice(0, 5).join('\n');
  const counts = [',', ';', '\t'].map((d) => [d, head.split(d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
}

/**
 * Spaltennamen den Feldern zuordnen.
 *
 * Jedes Programm nennt sie anders: Google schreibt "First Name" und
 * "E-mail 1 - Value", Outlook "Vorname" und "E-Mail-Adresse", Apple exportiert
 * gleich gar kein CSV. Deshalb eine Liste bekannter Bezeichnungen statt einer
 * festen Reihenfolge.
 */
const CSV_FIELDS = {
  first: ['first name', 'given name', 'vorname', 'firstname'],
  last: ['last name', 'family name', 'nachname', 'surname', 'lastname'],
  name: ['name', 'full name', 'display name', 'anzeigename', 'vollständiger name', 'kontakt'],
  email: ['e-mail 1 - value', 'e-mail address', 'email', 'e-mail', 'email address',
    'e-mail-adresse', 'primary email', 'mail'],
  phone: ['phone 1 - value', 'mobile phone', 'phone', 'telefon', 'mobiltelefon',
    'telefon (mobil)', 'handy', 'mobile'],
  company: ['organization name', 'organization 1 - name', 'company', 'firma', 'unternehmen', 'organisation'],
  note: ['notes', 'notiz', 'notizen', 'note'],
};

function matchColumn(header) {
  const h = String(header || '').trim().toLowerCase().replace(/^﻿/, '');
  for (const [field, names] of Object.entries(CSV_FIELDS)) {
    if (names.includes(h)) return field;
  }
  // Zweiter Versuch: enthält der Kopf den Begriff? ("E-mail 2 - Value")
  for (const [field, names] of Object.entries(CSV_FIELDS)) {
    if (names.some((n) => h.startsWith(n))) return field;
  }
  return null;
}

export function parseCsvContacts(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(matchColumn);
  const out = [];

  for (const row of rows.slice(1)) {
    const c = emptyContact();
    let first = '';
    let last = '';
    header.forEach((field, i) => {
      const v = String(row[i] ?? '').trim();
      if (!v || !field) return;
      if (field === 'first') { if (!first) first = v; return; }
      if (field === 'last') { if (!last) last = v; return; }
      if (!c[field]) c[field] = field === 'note' ? v.slice(0, 500) : v;
    });
    if (!c.name) c.name = [first, last].filter(Boolean).join(' ');
    if (!c.name) c.name = c.email || c.phone;
    if (c.name || c.email || c.phone) out.push(c);
  }
  return out;
}

/* ----------------------------------------------------------- gemeinsam */

/** Format an der Dateiendung bzw. am Inhalt erkennen und einlesen. */
export function parseContactsFile(filename, text) {
  const lower = String(filename || '').toLowerCase();
  const looksVCard = /BEGIN:VCARD/i.test(String(text || '').slice(0, 2000));
  if (lower.endsWith('.vcf') || lower.endsWith('.vcard') || looksVCard) {
    return parseVCard(text);
  }
  return parseCsvContacts(text);
}

/**
 * Schlüssel zum Erkennen von Dubletten.
 *
 * E-Mail zuerst — die ist eindeutig. Sonst die Telefonnummer ohne
 * Formatierung, sonst der Name in Kleinbuchstaben. So wird "Max Mustermann"
 * nicht doppelt angelegt, nur weil ein Export ihn "max mustermann" nennt.
 */
export function contactKey(c) {
  const email = String(c?.email || '').trim().toLowerCase();
  if (email) return `e:${email}`;
  const phone = String(c?.phone || '').replace(/[^\d+]/g, '');
  if (phone.length >= 6) return `p:${phone.slice(-9)}`;
  const name = String(c?.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return name ? `n:${name}` : '';
}

/**
 * Neue Kontakte gegen den Bestand abgleichen.
 * Gibt zurück, was neu ist und was bereits existiert — nichts wird
 * überschrieben, denn im Bestand stehen Zähler und Takt.
 */
export function mergeContacts(existing, incoming) {
  const known = new Map();
  for (const c of existing || []) {
    const k = contactKey(c);
    if (k) known.set(k, c);
  }
  const added = [];
  const duplicates = [];
  const seen = new Set();

  for (const c of incoming || []) {
    const k = contactKey(c);
    if (!k) continue;
    if (known.has(k) || seen.has(k)) { duplicates.push(c); continue; }
    seen.add(k);
    added.push(c);
  }
  return { added, duplicates };
}
