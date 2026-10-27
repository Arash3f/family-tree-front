import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getGuides, guideLanguagePaths } from "@/lib/guides";
import { absoluteLocaleUrl, languageAlternates } from "@/lib/site-url";

/**
 * When each page's content last really changed. Crawlers ignore a
 * `lastModified` that moves on every fetch, so bump these by hand with the
 * copy — not with every deploy.
 */
const LANDING_UPDATED = new Date("2026-10-24");
const DEMO_UPDATED = new Date("2026-09-25");
const PRICING_UPDATED = new Date("2026-10-27");
const GUIDES_TOOLS_UPDATED = new Date("2026-10-27");

/** Public marketing pages only — auth and dashboard are noindex. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const staticPages = (["/guides", "/kinship"] as const).flatMap((path) =>
    routing.locales.map((locale) => ({
      url: absoluteLocaleUrl(locale, path),
      lastModified: GUIDES_TOOLS_UPDATED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates: { languages: languageAlternates(path) },
    })),
  );

  // A guide carries its own dates, and hreflang only to a translation that exists.
  const guides = (
    await Promise.all(routing.locales.map((locale) => getGuides(locale)))
  )
    .flat()
    .map((guide) => ({
      url: absoluteLocaleUrl(guide.locale, `/guides/${guide.slug}`),
      lastModified: new Date(guide.updated ?? guide.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(
          Object.entries(guideLanguagePaths(guide)).map(([locale, path]) => [
            locale,
            absoluteLocaleUrl(locale, path),
          ]),
        ),
      },
    }));

  return [...landing, ...demo, ...pricing, ...staticPages, ...guides];
}
