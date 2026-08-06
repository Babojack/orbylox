/**
 * Shared room naming for the video conference.
 *
 * Room names on a public Jitsi server are effectively passwords, so the project
 * id is folded into a short hash instead of being spelled out.
 */
/**
 * Two modes:
 *   JaaS (8x8)  — set VITE_JAAS_APP_ID to the vpaas magic cookie of the account.
 *   Public Jitsi — no app id; falls back to meet.jit.si.
 */
export const JAAS_APP_ID = import.meta.env.VITE_JAAS_APP_ID || '';
export const JITSI_DOMAIN =
  import.meta.env.VITE_JITSI_DOMAIN || (JAAS_APP_ID ? '8x8.vc' : 'meet.jit.si');

/** JaaS serves its own build of the embed script per account. */
export function externalApiUrl() {
  return JAAS_APP_ID
    ? `https://${JITSI_DOMAIN}/${JAAS_APP_ID}/external_api.js`
    : `https://${JITSI_DOMAIN}/external_api.js`;
}

/** JaaS expects "<appId>/<room>" as the room name. */
export function apiRoomName(room) {
  return JAAS_APP_ID ? `${JAAS_APP_ID}/${room}` : room;
}

let apiScriptPromise = null;
/** Loads the embed script once, no matter how many components ask for it. */
export function loadJitsiApi() {
  if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) return Promise.resolve();
  if (apiScriptPromise) return apiScriptPromise;

  apiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = externalApiUrl();
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      apiScriptPromise = null;
      reject(new Error(`Konferenz-Dienst (${JITSI_DOMAIN}) konnte nicht geladen werden.`));
    };
    document.head.appendChild(script);
  });
  return apiScriptPromise;
}

function shortHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function slugify(value, max = 24) {
  return (
    (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, max) || 'projekt'
  );
}

/** Standing room of a project — the one behind the "Meeting" button. */
export function projectRoomName(projectId, projectName = '') {
  return `orbylox-${slugify(projectName)}-${shortHash(`orbylox:${projectId || 'lobby'}`)}`;
}

/** Fresh room for a single appointment, so parallel meetings never collide. */
export function eventRoomName(projectId, seed = '') {
  const unique = seed || Math.random().toString(36).slice(2, 8);
  return `orbylox-termin-${slugify(String(projectId || 'projekt'), 8)}-${unique}`;
}

export function roomUrl(room) {
  return JAAS_APP_ID
    ? `https://${JITSI_DOMAIN}/${JAAS_APP_ID}/${room}`
    : `https://${JITSI_DOMAIN}/${room}`;
}

/** Accepts a full URL or a bare room name and returns the plain room name. */
export function roomFromUrl(value) {
  if (!value) return '';
  let path;
  try {
    path = new URL(value).pathname.replace(/^\//, '');
  } catch {
    path = String(value).replace(/^\//, '');
  }
  // Strip a JaaS app id prefix so stored links keep working after a switch.
  return path.replace(/^vpaas-magic-cookie-[a-z0-9]+\//i, '');
}

/**
 * Chrome only forwards camera and microphone into a cross-origin iframe if the
 * embedding page holds the permission itself. Asking here makes the browser show
 * its prompt for orbylox.de before Jitsi loads.
 *
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function ensureMediaPermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: 'Dieser Browser unterstützt keine Kamera-/Mikrofonfreigabe.' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // Release the devices immediately — Jitsi opens them again itself.
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err) {
    const messages = {
      NotAllowedError:
        'Kamera und Mikrofon sind für orbylox.de blockiert. Klicke oben links in der Adressleiste auf das Symbol direkt vor der Adresse (Regler-Symbol, früher ein Schloss) und stelle Kamera und Mikrofon auf „Zulassen“. Danach die Seite neu laden.',
      NotFoundError: 'Keine Kamera oder kein Mikrofon gefunden.',
      NotReadableError: 'Kamera oder Mikrofon wird bereits von einem anderen Programm benutzt (z. B. Zoom oder Teams).',
      SecurityError: 'Zugriff nur über HTTPS möglich.',
    };
    return {
      ok: false,
      blocked: err?.name === 'NotAllowedError',
      error: messages[err?.name] || err?.message || 'Zugriff auf Kamera/Mikrofon fehlgeschlagen.',
    };
  }
}

/** 'granted' | 'denied' | 'prompt' | 'unknown' — used to show the right hint. */
export async function mediaPermissionState() {
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const [camera, microphone] = await Promise.all([
      navigator.permissions.query({ name: 'camera' }),
      navigator.permissions.query({ name: 'microphone' }),
    ]);
    if (camera.state === 'denied' || microphone.state === 'denied') return 'denied';
    if (camera.state === 'granted' && microphone.state === 'granted') return 'granted';
    return 'prompt';
  } catch {
    return 'unknown';
  }
}

/** Explicit permission delegation on the embedded frame. */
export function allowMediaInFrame(jitsiApi) {
  try {
    const iframe = jitsiApi?.getIFrame?.();
    if (!iframe) return;
    iframe.setAttribute(
      'allow',
      'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen; speaker-selection'
    );
    iframe.setAttribute('allowfullscreen', 'true');
  } catch {
    /* older API versions have no getIFrame */
  }
}

/** In-app meeting page — keeps the conference inside ORBYLOX. */
export function meetingPageUrl(projectId, room) {
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  if (room) params.set('room', room);
  return `/Meeting?${params.toString()}`;
}
