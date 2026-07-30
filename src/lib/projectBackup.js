/**
 * Full project backups: every Firestore collection plus the actual files, packed
 * into one ZIP by public/api/backup.php. File paths are preserved, so a restore
 * puts each file back exactly where its stored URL points.
 */
import { api } from "@/api/apiClient";
import { auth as firebaseAuth } from "@/lib/firebase";

/** Collections that belong to a project, with the row limit used when reading them. */
export const BACKUP_COLLECTIONS = [
  ["Task", 1000],
  ["Subtask", 1000],
  ["TaskComment", 1000],
  ["Document", 500],
  ["FileRecord", 500],
  ["Folder", 200],
  ["Post", 500],
  ["PostComment", 1000],
  ["Message", 1000],
  ["Event", 500],
  ["CanvasItem", 500],
  ["CanvasConnection", 500],
  ["CanvasComment", 1000],
  ["KanbanBoard", 100],
  ["StartupStep", 300],
  ["StartupJourney", 100],
  ["ProductIdea", 300],
  ["CustomIntegration", 100],
];

function endpoint() {
  const url = import.meta.env.VITE_BACKUP_API_URL;
  if (!url) {
    throw new Error("Backup-Endpoint nicht konfiguriert (VITE_BACKUP_API_URL).");
  }
  return url;
}

async function authHeader() {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error("Nicht angemeldet.");
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

async function parse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Backup-Server antwortete mit HTTP ${response.status}.`);
  }
  return payload;
}

/** Reads every project-scoped collection plus the URLs of all referenced files. */
export async function collectProjectData(projectId) {
  const entries = await Promise.all(
    BACKUP_COLLECTIONS.map(async ([name, limit]) => {
      const entity = api.entities[name];
      if (!entity) return [name, []];
      try {
        const all = await entity.list("-created_date", limit);
        return [name, all.filter((row) => row.project_id === projectId)];
      } catch (err) {
        console.error(`[Backup] ${name} konnte nicht gelesen werden:`, err?.message || err);
        return [name, []];
      }
    }),
  );

  const collections = Object.fromEntries(entries);

  // Every place a file URL can hide: File Hub records and canvas attachments.
  const fileUrls = new Set();
  for (const record of collections.FileRecord || []) {
    if (record.url) fileUrls.add(record.url);
  }
  for (const item of collections.CanvasItem || []) {
    for (const ref of item.file_hub_refs || []) {
      if (ref?.url) fileUrls.add(ref.url);
    }
  }
  for (const post of collections.Post || []) {
    for (const image of post.images || []) {
      if (image) fileUrls.add(image);
    }
    if (post.image_url) fileUrls.add(post.image_url);
  }

  return { collections, files: [...fileUrls] };
}

export async function createBackup({ projectId, project, name, type = "manual" }) {
  const { collections, files } = await collectProjectData(projectId);
  const response = await fetch(`${endpoint()}?action=create`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      name,
      backup_type: type,
      data: { project, collections },
      files,
    }),
  });
  return parse(response);
}

export async function listBackups(projectId) {
  const response = await fetch(
    `${endpoint()}?action=list&project_id=${encodeURIComponent(projectId)}`,
    { headers: await authHeader() },
  );
  const payload = await parse(response);
  return Array.isArray(payload) ? payload : [];
}

export async function deleteBackup(projectId, id) {
  const response = await fetch(
    `${endpoint()}?action=delete&project_id=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`,
    { method: "POST", headers: await authHeader() },
  );
  return parse(response);
}

/** Streams the ZIP through fetch so the Authorization header can be sent. */
export async function downloadBackup(projectId, id) {
  const response = await fetch(
    `${endpoint()}?action=download&project_id=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`,
    { headers: await authHeader() },
  );
  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orbylox-backup-${id}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const stripServerFields = (row) => {
  const { id, created_date, updated_date, userId, ...rest } = row;
  return rest;
};

/**
 * Restores files on the server, then replaces the project's Firestore documents.
 * Runs collection by collection so a failure can be reported precisely.
 */
export async function restoreBackup({ projectId, id, onProgress }) {
  onProgress?.("Dateien werden zurueckgespielt…");
  const response = await fetch(
    `${endpoint()}?action=restore&project_id=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`,
    { headers: await authHeader() },
  );
  const payload = await parse(response);
  const snapshot = payload?.data?.data;
  if (!snapshot?.collections) {
    throw new Error("Backup enthaelt keine lesbaren Projektdaten.");
  }

  for (const [name] of BACKUP_COLLECTIONS) {
    const entity = api.entities[name];
    if (!entity) continue;
    onProgress?.(`${name} wird ersetzt…`);

    const limit = BACKUP_COLLECTIONS.find(([n]) => n === name)?.[1] || 500;
    const current = (await entity.list("-created_date", limit)).filter((row) => row.project_id === projectId);
    await Promise.all(current.map((row) => entity.delete(row.id).catch(() => {})));

    const rows = snapshot.collections[name] || [];
    for (const row of rows) {
      await entity.create({ ...stripServerFields(row), project_id: projectId });
    }
  }

  if (snapshot.project) {
    const { id: _id, created_date, updated_date, created_by, userId, ...projectFields } = snapshot.project;
    await api.entities.Project.update(projectId, projectFields).catch((err) => {
      console.error("[Backup] Projektfelder konnten nicht aktualisiert werden:", err?.message || err);
    });
  }

  return {
    restoredFiles: payload?.restored_files ?? 0,
    manifest: payload?.manifest ?? null,
  };
}
