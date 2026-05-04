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
