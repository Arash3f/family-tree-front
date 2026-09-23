import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absoluteLocaleUrl, languageAlternates } from "@/lib/site-url";

/** Public marketing pages only — auth and dashboard are noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const landing = routing.locales.map((locale) => ({
    url: absoluteLocaleUrl(locale),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 1,
    alternates: {
      languages: languageAlternates(),
    },
  }));

  // The demo is the one view of real tree data that is public on purpose.
  const demo = routing.locales.map((locale) => ({
    url: absoluteLocaleUrl(locale, "/demo"),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
    alternates: {
      languages: languageAlternates("/demo"),
    },
  }));

  return [...landing, ...demo];
}
