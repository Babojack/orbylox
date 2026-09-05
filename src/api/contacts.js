import {
  collection, doc, addDoc, setDoc, deleteDoc, getDocs, query, where, writeBatch,
} from 'firebase/firestore';
import { db, hasFirebaseConfig, auth as firebaseAuth } from '@/lib/firebase';
import { emptyContact } from '@/lib/contactsImport';

/**
 * Kontakte — persönlich, nicht projektgebunden.
 *
 * Eigene Sammlung `Contact` mit `userId`. Anders als die Kontaktpflege-
 * Einstellung (ein einziges Feld) können das hunderte Einträge werden; die
 * gehören nicht in ein Dokument, sonst wird bei jeder Änderung alles neu
 * geschrieben und das 1-MB-Limit rückt näher.
 *
 * Ohne Firebase (lokal, Demo) läuft alles über den localStorage — dieselbe
 * Schnittstelle, damit die Seite überall funktioniert.
 */

const COLLECTION = 'Contact';
const LOCAL_KEY = (uid) => `orbylox_contacts:${uid || 'local'}`;

/** Firestore-Dokument -> Objekt der Anwendung. */
export function fromDoc(id, d = {}) {
  return {
    ...emptyContact(),
    id,
    name: String(d.name || ''),
    email: String(d.email || ''),
    phone: String(d.phone || ''),
    company: String(d.company || ''),
    note: String(d.note || ''),
    intervalDays: Number.isFinite(Number(d.interval_days)) ? Number(d.interval_days) : 90,
    contactCount: Number(d.contact_count) || 0,
    lastContactedAt: typeof d.last_contacted_at === 'string' ? d.last_contacted_at : null,
    paused: !!d.paused,
  };
}

/** Objekt der Anwendung -> Firestore-Dokument. */
export function toDoc(c, uid) {
  return {
    userId: uid,
    name: String(c.name || '').slice(0, 200),
    email: String(c.email || '').slice(0, 200),
    phone: String(c.phone || '').slice(0, 60),
    company: String(c.company || '').slice(0, 200),
    note: String(c.note || '').slice(0, 500),
    interval_days: Number(c.intervalDays) || 0,
    contact_count: Number(c.contactCount) || 0,
    last_contacted_at: c.lastContactedAt || null,
    paused: !!c.paused,
    updated_date: new Date().toISOString(),
  };
}

/* --------------------------------------------------------------- lokal */

function readLocal(uid) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY(uid));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map((c) => ({ ...emptyContact(), ...c })) : [];
  } catch {
    return [];
  }
}

function writeLocal(uid, list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_KEY(uid), JSON.stringify(list));
  } catch {
    /* Speicher voll — dann eben nur die Cloud */
  }
}

function uidNow() {
  return firebaseAuth?.currentUser?.uid || null;
}

const online = () => hasFirebaseConfig && db && uidNow();

/* ------------------------------------------------------------ Zugriffe */

export async function listContacts() {
  const uid = uidNow();
  if (!online()) return readLocal(uid);
  const snap = await getDocs(query(collection(db, COLLECTION), where('userId', '==', uid)));
  const list = snap.docs.map((d) => fromDoc(d.id, d.data()));
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  writeLocal(uid, list);
  return list;
}

export async function createContact(contact) {
  const uid = uidNow();
  if (!online()) {
    const list = readLocal(uid);
    const withId = { ...emptyContact(), ...contact, id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}` };
    writeLocal(uid, [...list, withId]);
    return withId;
  }
  const ref = await addDoc(collection(db, COLLECTION), toDoc({ ...emptyContact(), ...contact }, uid));
  return { ...emptyContact(), ...contact, id: ref.id };
}

export async function updateContact(contact) {
  const uid = uidNow();
  if (!online()) {
    const list = readLocal(uid).map((c) => (c.id === contact.id ? { ...c, ...contact } : c));
    writeLocal(uid, list);
    return contact;
  }
  await setDoc(doc(db, COLLECTION, contact.id), toDoc(contact, uid), { merge: true });
  return contact;
}

export async function removeContact(id) {
  const uid = uidNow();
  if (!online()) {
    writeLocal(uid, readLocal(uid).filter((c) => c.id !== id));
    return;
  }
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Viele Kontakte auf einmal anlegen.
 *
 * Firestore erlaubt 500 Schreibvorgänge je Stapel; ein Adressbuch hat
 * schnell mehr. Deshalb in Blöcken — und einzeln geschrieben wäre es bei
 * 800 Kontakten quälend langsam.
 */
export async function createContactsBulk(contacts) {
  const uid = uidNow();
  const list = (contacts || []).map((c) => ({ ...emptyContact(), ...c }));
  if (!list.length) return 0;

  if (!online()) {
    const existing = readLocal(uid);
    const withIds = list.map((c, i) => ({ ...c, id: `l${Date.now()}${i}` }));
    writeLocal(uid, [...existing, ...withIds]);
    return withIds.length;
  }

  const CHUNK = 400;
  for (let i = 0; i < list.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const c of list.slice(i, i + CHUNK)) {
      batch.set(doc(collection(db, COLLECTION)), toDoc(c, uid));
    }
    await batch.commit();
  }
  return list.length;
}
