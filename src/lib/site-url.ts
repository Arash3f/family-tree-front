/** Absolute public site origin for metadata, sitemap, and robots. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  return "http://localhost:5173";
}

export function localePath(locale: string, path = ""): string {
  const normalized = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `/${locale}${normalized}`;
}

/** Absolute URL for a locale-prefixed path (path without locale). */
export function absoluteLocaleUrl(locale: string, path = ""): string {
  return `${getSiteUrl()}${localePath(locale, path)}`;
}

/** Absolute hreflang map (Lighthouse rejects relative hrefs on link[hreflang]). */
export function languageAlternates(path = ""): Record<string, string> {
  return {
    en: absoluteLocaleUrl("en", path),
    fa: absoluteLocaleUrl("fa", path),
    "x-default": absoluteLocaleUrl("en", path),
  };
}
