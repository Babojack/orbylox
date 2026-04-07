const STORAGE_KEY = "orbylox_timer_v1";

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function readState() {
  if (typeof window === "undefined") return { active: null, totals: {}, logs: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const state = safeParse(raw, { active: null, totals: {}, logs: [] });
  return {
    active: state?.active || null,
    totals: state?.totals && typeof state.totals === "object" ? state.totals : {},
    logs: Array.isArray(state?.logs) ? state.logs : [],
  };
}

function writeState(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** When a timer session ends, synced to Firestore / Project store (see api.entities.Project.addTrackedTimeSession). */
let trackedTimeSyncHandler = null;

export function setTrackedTimeSyncHandler(fn) {
  trackedTimeSyncHandler = typeof fn === "function" ? fn : null;
}

function pickLatestIso(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  try {
    return new Date(a) > new Date(b) ? a : b;
  } catch {
    return b;
  }
}

/**
 * @param {string} projectId
 * @param {{ tracked_time_ms?: number, last_worked_at?: string } | Record<string, unknown>} [server] — fields from Project entity
 */
export function getProjectTimer(projectId, server = {}) {
  const state = readState();
  const total = state.totals?.[projectId] || {};
  const active = state.active?.projectId === projectId ? state.active : null;
  const localMs = Number.isFinite(total?.totalMs) ? total.totalMs : 0;
  const serverMs = Number(server?.tracked_time_ms) || 0;
  const baseMs = Math.max(localMs, serverMs);
  const lastWorkedAt = pickLatestIso(total?.lastWorkedAt || null, server?.last_worked_at || null);
  return {
    projectId,
    isRunning: !!active,
    startedAt: active?.startedAt || null,
    totalMs: baseMs,
    lastWorkedAt,
  };
}

export function getActiveTimer() {
  const state = readState();
  return state.active || null;
}

export function startTimer(projectId, meta = {}) {
  if (!projectId) return null;
  const state = readState();

  // Enforce single active timer globally. If another timer runs, stop it first.
  if (state.active?.projectId && state.active.projectId !== projectId) {
    stopTimer({ reason: "switch_project" });
  }

  const fresh = readState();
  const next = {
    ...fresh,
    active: {
      projectId,
      startedAt: Date.now(),
      startedAtIso: nowIso(),
      meta: meta && typeof meta === "object" ? meta : {},
    },
  };
  writeState(next);
  return next.active;
}

export function stopTimer({ reason = "manual", endAt = Date.now() } = {}) {
  const state = readState();
  const active = state.active;
  if (!active?.projectId || !active?.startedAt) return null;

  const end = Number.isFinite(endAt) ? endAt : Date.now();
  const startedAt = Number(active.startedAt) || end;
  const elapsedMs = Math.max(0, end - startedAt);
  const projectId = active.projectId;

  const prevTotal = state.totals?.[projectId] || {};
  const prevMs = Number(prevTotal?.totalMs) || 0;
  const nextTotalMs = prevMs + elapsedMs;

  const next = {
    ...state,
    active: null,
    totals: {
      ...(state.totals || {}),
      [projectId]: {
        totalMs: nextTotalMs,
        lastWorkedAt: new Date(end).toISOString(),
      },
    },
    logs: [
      ...(Array.isArray(state.logs) ? state.logs : []),
      {
        projectId,
        startedAt,
        endedAt: end,
        startedAtIso: active.startedAtIso || new Date(startedAt).toISOString(),
        endedAtIso: new Date(end).toISOString(),
        elapsedMs,
        reason,
        meta: active.meta || {},
      },
    ].slice(-5000),
  };

  writeState(next);
  const result = {
    projectId,
    elapsedMs,
    totalMs: nextTotalMs,
    lastWorkedAt: next.totals[projectId].lastWorkedAt,
  };
  if (trackedTimeSyncHandler && result.projectId && result.elapsedMs > 0) {
    Promise.resolve(
      trackedTimeSyncHandler({
        projectId: result.projectId,
        elapsedMs: result.elapsedMs,
        lastWorkedAt: result.lastWorkedAt,
        reason,
      }),
    ).catch((err) => {
      console.error("[projectTimer] tracked time sync failed", err);
    });
  }
  return result;
}

export function recoverActiveTimer() {
  // If we crashed/reloaded while running, close it immediately.
  const active = getActiveTimer();
  if (!active?.projectId) return null;
  return stopTimer({ reason: "recover" });
}

export function formatDuration(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

