/**
 * Cloudinary often delivers PDFs with Content-Disposition: attachment, which breaks
 * embedded viewers (<object>, <iframe>). Inserting fl_inline forces inline disposition.
 *
 * @param {string | undefined | null} url
 * @returns {string | undefined | null}
 */
export function previewablePdfUrl(url) {
  if (!url || typeof url !== "string") return url;
  const u = url.trim();
  if (!u || u.startsWith("blob:") || u.startsWith("data:")) return u;
  if (!u.includes("res.cloudinary.com")) return u;
  if (!/\.pdf([?#]|$)/i.test(u)) return u;
  if (u.includes("/fl_inline/") || u.includes(",fl_inline,")) return u;
  const marker = "/upload/";
  const idx = u.indexOf(marker);
  if (idx === -1) return u;
  return u.slice(0, idx + marker.length) + "fl_inline/" + u.slice(idx + marker.length);
}

/**
 * Why a stored file cannot be opened. Records can outlive the storage they were
 * written to — blob URLs die with the tab, Firebase Storage was never activated,
 * and files under /uploads disappear if the folder is replaced during a deploy.
 *
 * @returns {{ok: boolean, kind: string, reason?: string, hint?: string}}
 */
export function describeFileUrl(url) {
  const u = (url || "").trim();
  if (!u) {
    return { ok: false, kind: "missing", reason: "Kein Link gespeichert.", hint: "Datei neu hochladen." };
  }
  if (u.startsWith("blob:")) {
    return {
      ok: false,
      kind: "blob",
      reason: "Der Eintrag zeigt auf eine temporäre Browser-Adresse (blob:).",
      hint: "Der Upload wurde damals nicht abgeschlossen. Datei bitte neu hochladen.",
    };
  }
  if (u.startsWith("data:")) return { ok: true, kind: "inline" };
  if (u.includes("firebasestorage.googleapis.com")) {
    return {
      ok: false,
      kind: "firebase",
      reason: "Der Eintrag zeigt auf Firebase Storage.",
      hint: "Firebase Storage war nie aktiv (Blaze-Tarif). Datei bitte neu hochladen.",
    };
  }
  if (u.includes("res.cloudinary.com")) return { ok: true, kind: "cloudinary" };
  if (/^https?:\/\//i.test(u)) return { ok: true, kind: "http" };
  return { ok: false, kind: "unknown", reason: "Der gespeicherte Link ist unvollständig." };
}

/** HEAD request — tells a deleted file apart from a wrong link. */
export async function checkFileReachable(url) {
  const described = describeFileUrl(url);
  if (!described.ok) return described;
  if (described.kind === "inline") return { ok: true, kind: "inline" };

  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok) return { ok: true, kind: described.kind };
    return {
      ok: false,
      kind: described.kind,
      reason: `Der Server antwortet mit HTTP ${response.status}.`,
      hint:
        response.status === 404
          ? "Die Datei liegt nicht mehr am gespeicherten Ort — beim Deploy gelöschte Uploads sind die häufigste Ursache."
          : "Zugriff verweigert oder Serverfehler.",
    };
  } catch {
    // Cross-origin without CORS: no verdict possible, so do not cry wolf.
    return { ok: true, kind: described.kind, unverified: true };
  }
}
