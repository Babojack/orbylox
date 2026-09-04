import { auth as firebaseAuth } from '@/lib/firebase';

/**
 * Anbindung an about.php.
 *
 * Lesen geht ohne Anmeldung — die Seite "Über uns" ist öffentlich. Gespeichert
 * wird nur mit Firebase-Token; ob jemand Administrator ist, entscheidet der
 * Server, nicht der Browser.
 */

const ENDPOINT =
  import.meta.env.VITE_ABOUT_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/api/about.php` : '');

/** Fallback, falls der Endpunkt fehlt (lokale Entwicklung ohne PHP). */
export const ABOUT_FALLBACK = {
  hero_image: '/team/team.jpg',
  hero_alt: 'Das ORBYLOX-Team',
  de: {
    headline: 'Über uns',
    intro: 'ORBYLOX ist Projektmanagement, das nichts kostet und trotzdem alles kann, was kleine Teams wirklich brauchen.',
    story:
      'Wir haben ORBYLOX gebaut, weil gute Werkzeuge nicht am Preis scheitern sollten.\n\n' +
      'Vereine, Gründerinnen, Studierende und kleine Teams arbeiten oft mit Zetteln und Tabellen — nicht aus Überzeugung, sondern weil ordentliche Software pro Kopf und Monat abgerechnet wird. Genau diese Hürde wollten wir wegnehmen.',
    mission_title: 'Wofür wir stehen',
    mission: 'Alles an einem Ort, verständlich ohne Schulung, und kostenlos für alle.',
    team_title: 'Das Team',
    team_intro: 'Die Menschen hinter ORBYLOX.',
  },
  en: {
    headline: 'About us',
    intro: 'ORBYLOX is project management that costs nothing and still does everything small teams actually need.',
    story:
      'We built ORBYLOX because good tools should not fail on price.\n\n' +
      'Clubs, founders, students and small teams often work with notes and spreadsheets — not by choice, but because proper software is billed per person per month. That is the barrier we wanted to remove.',
    mission_title: 'What we stand for',
    mission: 'Everything in one place, understandable without training, and free for everyone.',
    team_title: 'The team',
    team_intro: 'The people behind ORBYLOX.',
  },
  // Spiegelt aboutDefault() in about.php. Zwei Orte, weil die Seite auch dann
  // etwas Sinnvolles zeigen soll, wenn der PHP-Endpunkt nicht erreichbar ist.
  team: [
    {
      id: 'jeyhun-afandiyev', name: 'Jeyhun Afandiyev', photo: '/team/jeyhun-afandiyev.jpg',
      role_de: 'Gründer & Geschäftsführer (CEO)', role_en: 'Founder & CEO',
      bio_de: '', bio_en: '', email: '', link: '',
    },
    {
      id: 'ilkin-alibayli', name: 'Ilkin Alibayli', photo: '/team/ilkin-alibayli.jpg',
      role_de: 'Technischer Leiter (CTO)', role_en: 'CTO',
      bio_de: '', bio_en: '', email: '', link: '',
    },
    {
      id: 'solution-architect', name: '', photo: '/team/solution-architect.jpg',
      role_de: 'Solution Architect', role_en: 'Solution Architect',
      bio_de: '', bio_en: '', email: '', link: '',
    },
    {
      id: 'nick-huseynli', name: 'Nick Huseynli', photo: '',
      role_de: 'Leiter Finanzen', role_en: 'Finance Director',
      bio_de: '', bio_en: '', email: '', link: '',
    },
    {
      id: 'it-team-lead', name: '', photo: '',
      role_de: 'Teamleiter IT', role_en: 'IT Team Lead',
      bio_de: '', bio_en: '', email: '', link: '',
    },
  ],
  updated_at: '',
};

async function parse(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Unerwartete Antwort vom Server (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

export async function loadAbout() {
  if (!ENDPOINT) return ABOUT_FALLBACK;
  try {
    const data = await parse(await fetch(ENDPOINT, { method: 'GET' }));
    return data.content || ABOUT_FALLBACK;
  } catch {
    // Die Seite soll auch dann etwas zeigen, wenn der Endpunkt fehlt.
    return ABOUT_FALLBACK;
  }
}

export async function saveAbout(content) {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Nicht angemeldet.');
  const data = await parse(
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify(content),
    }),
  );
  return data.content;
}

export function emptyMember() {
  return {
    id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    photo: '',
    role_de: '',
    role_en: '',
    bio_de: '',
    bio_en: '',
    email: '',
    link: '',
  };
}
