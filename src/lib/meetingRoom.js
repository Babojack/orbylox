/**
 * Shared room naming for the video conference.
 *
 * Room names on a public Jitsi server are effectively passwords, so the project
 * id is folded into a short hash instead of being spelled out.
 */
export const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

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
  return `https://${JITSI_DOMAIN}/${room}`;
}

/** Accepts a full URL or a bare room name and returns the room name. */
export function roomFromUrl(value) {
  if (!value) return '';
  try {
    return new URL(value).pathname.replace(/^\//, '');
  } catch {
    return String(value).replace(/^\//, '');
  }
}

/** In-app meeting page — keeps the conference inside ORBYLOX. */
export function meetingPageUrl(projectId, room) {
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  if (room) params.set('room', room);
  return `/Meeting?${params.toString()}`;
}
