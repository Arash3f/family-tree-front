import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absoluteLocaleUrl, languageAlternates } from "@/lib/site-url";

/** Only marketing landing pages — auth and dashboard are noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routing.locales.map((locale) => ({
    url: absoluteLocaleUrl(locale),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 1,
    alternates: {
      languages: languageAlternates(),
    },
  }));
}
