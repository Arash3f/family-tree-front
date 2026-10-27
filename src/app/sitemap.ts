import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absoluteLocaleUrl, languageAlternates } from "@/lib/site-url";

/**
 * When each page's content last really changed. Crawlers ignore a
 * `lastModified` that moves on every fetch, so bump these by hand with the
 * copy — not with every deploy.
 */
const LANDING_UPDATED = new Date("2026-10-24");
const DEMO_UPDATED = new Date("2026-09-25");
const PRICING_UPDATED = new Date("2026-10-27");

/** Public marketing pages only — auth and dashboard are noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const landing = routing.locales.map((locale) => ({
    url: absoluteLocaleUrl(locale),
    lastModified: LANDING_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 1,
    alternates: {
      languages: languageAlternates(),
    },
  }));

  // The demo is the one view of real tree data that is public on purpose.
  const demo = routing.locales.map((locale) => ({
    url: absoluteLocaleUrl(locale, "/demo"),
    lastModified: DEMO_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.8,
    alternates: {
      languages: languageAlternates("/demo"),
    },
  }));

  const pricing = routing.locales.map((locale) => ({
    url: absoluteLocaleUrl(locale, "/pricing"),
    lastModified: PRICING_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.7,
    alternates: {
      languages: languageAlternates("/pricing"),
    },
  }));

  return [...landing, ...demo, ...pricing];
}
