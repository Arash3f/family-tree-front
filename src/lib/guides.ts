import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ComponentType } from "react";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Frontmatter every guide declares. A guide is one MDX file in
 * `src/content/guides/<locale>/<slug>.mdx`; the index, the route, the sitemap
 * and the hreflang links all derive from these files.
 */
export type GuideMeta = {
  title: string;
  description: string;
  /** ISO day the guide was first published, e.g. "2026-10-27". */
  date: string;
  /** ISO day of the last real content change; drives sitemap lastModified. */
  updated?: string;
  keywords?: string[];
  /** Must match the folder the file sits in. */
  locale: AppLocale;
  /** Slug of the same guide in the other locale, for hreflang. */
  translationOf?: string;
  /** Rough reading time in minutes. */
  readingMinutes?: number;
  draft?: boolean;
};

export type Guide = GuideMeta & { slug: string };
export type LoadedGuide = Guide & { Content: ComponentType };

const GUIDES_ROOT = path.join(process.cwd(), "src", "content", "guides");

async function listSlugs(locale: AppLocale): Promise<string[]> {
  const entries = await readdir(path.join(GUIDES_ROOT, locale), {
    withFileTypes: true,
  }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name.replace(/\.mdx$/, ""));
}

async function importGuide(locale: AppLocale, slug: string) {
  // One literal template per locale keeps the bundler's dynamic import bounded.
  const mdx =
    locale === "fa"
      ? await import(`@/content/guides/fa/${slug}.mdx`)
      : await import(`@/content/guides/en/${slug}.mdx`);
  return {
    meta: mdx.frontmatter as GuideMeta,
    Content: mdx.default as ComponentType,
  };
}

const newestFirst = (a: Guide, b: Guide) => b.date.localeCompare(a.date);

/** Every published guide in `locale`, newest first. */
export async function getGuides(locale: AppLocale): Promise<Guide[]> {
  const slugs = await listSlugs(locale);
  const guides = await Promise.all(
    slugs.map(async (slug) => ({ slug, ...(await importGuide(locale, slug)).meta })),
  );
  return guides.filter((guide) => !guide.draft).sort(newestFirst);
}

/** One guide with its rendered body, or `null` when there is none by that slug. */
export async function getGuide(
  locale: AppLocale,
  slug: string,
): Promise<LoadedGuide | null> {
  if (!(await listSlugs(locale)).includes(slug)) return null;
  const { meta, Content } = await importGuide(locale, slug);
  if (meta.draft) return null;
  return { slug, ...meta, Content };
}

/** `{ locale, slug }` for every published guide, for `generateStaticParams`. */
export async function getGuideParams() {
  const perLocale = await Promise.all(
    routing.locales.map(async (locale) =>
      (await getGuides(locale)).map((guide) => ({ locale, slug: guide.slug })),
    ),
  );
  return perLocale.flat();
}

/**
 * The guides a reader of `guide` most likely wants next: those sharing the
 * most keywords first, then the newest.
 */
export async function getRelatedGuides(guide: Guide, limit = 3): Promise<Guide[]> {
  const keywords = new Set(guide.keywords ?? []);
  const shared = (other: Guide) =>
    (other.keywords ?? []).filter((keyword) => keywords.has(keyword)).length;
  return (await getGuides(guide.locale))
    .filter((other) => other.slug !== guide.slug)
    .sort((a, b) => shared(b) - shared(a) || newestFirst(a, b))
    .slice(0, limit);
}

/**
 * hreflang paths for a guide: its own locale, plus the translation when one
 * is declared. Only versions that exist are listed.
 */
export function guideLanguagePaths(guide: Guide): Partial<Record<AppLocale, string>> {
  const paths: Partial<Record<AppLocale, string>> = {
    [guide.locale]: `/guides/${guide.slug}`,
  };
  const other = routing.locales.find((locale) => locale !== guide.locale);
  if (other && guide.translationOf) {
    paths[other] = `/guides/${guide.translationOf}`;
  }
  return paths;
}
