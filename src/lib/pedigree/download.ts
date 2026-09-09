/**
 * Browser download plumbing.
 *
 * Split out from `export-image.ts` so that triggering a download does not drag
 * `html-to-image` into the bundle. Only the person poster needs that library,
 * and it is loaded on demand.
 */

export function sanitizeFilename(filename: string, fallback = "pedigree"): string {
  // Strip characters that Windows, macOS, or the shell would object to.
  const safe = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
  return (safe || fallback).slice(0, 80);
}

/** Join meaningful parts into a download basename (no extension). */
export function buildExportBasename(
  parts: Array<string | null | undefined>,
  fallback = "pedigree",
): string {
  const joined = parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("-");
  return sanitizeFilename(joined, fallback);
}

function withExtension(name: string, ext: string): string {
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  triggerDownload(
    dataUrl,
    withExtension(sanitizeFilename(filename, "pedigree"), "png"),
  );
}

export function downloadBlob(blob: Blob, filename: string, ext: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, withExtension(sanitizeFilename(filename, "pedigree"), ext));
  // Revoked on a delay: revoking immediately can cancel the download in Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Prefer Content-Disposition; fall back to a caller-chosen name. */
export function filenameFromDisposition(
  disposition: string | null,
  fallbackName: string,
): string {
  if (!disposition) return fallbackName;
  const utf8 = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* keep scanning */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1]?.trim() || fallbackName;
}
