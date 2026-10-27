import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GuideCta } from "@/components/guides/GuideCta";
import styles from "@/components/guides/Guides.module.css";
import { Link } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { AUTHOR_LINKS, AUTHOR_NAMES } from "@/lib/author";
import {
  getGuide,
  getGuideParams,
  getRelatedGuides,
  guideLanguagePaths,
  type Guide,
} from "@/lib/guides";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { OG_IMAGE_SIZE } from "@/lib/brand-icon";
import { formatDateForLocale } from "@/lib/pedigree/dates";
import { absoluteLocaleUrl, localePath } from "@/lib/site-url";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getGuideParams();
}

function isLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}

/** Absolute hreflang map, with x-default on English when it exists. */
function languages(guide: Guide): Record<string, string> {
  const paths = guideLanguagePaths(guide);
  const map: Record<string, string> = {};
  for (const [locale, path] of Object.entries(paths)) {
    map[locale] = absoluteLocaleUrl(locale, path);
  }
  map["x-default"] = map.en ?? map[guide.locale]!;
  return map;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const guide = await getGuide(locale, slug);
  if (!guide) return {};
  const path = `/guides/${slug}`;
  const image = {
    url: absoluteLocaleUrl(locale, `${path}/og-image`),
    ...OG_IMAGE_SIZE,
    alt: guide.title,
  };

  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: {
      canonical: localePath(locale, path),
      languages: languages(guide),
    },
    openGraph: {
      type: "article",
      url: absoluteLocaleUrl(locale, path),
      title: guide.title,
      description: guide.description,
      publishedTime: guide.date,
      modifiedTime: guide.updated ?? guide.date,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const guide = await getGuide(locale, slug);
  if (!guide) notFound();

  const t = await getTranslations({ locale, namespace: "guides" });
  const tMeta = await getTranslations({ locale, namespace: "meta" });
  const related = await getRelatedGuides(guide);
  const url = absoluteLocaleUrl(locale, `/guides/${slug}`);
  const dateText = (value: string) =>
    formatLocaleDigits(formatDateForLocale(value, locale), locale);
  const { Content } = guide;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: locale,
    datePublished: guide.date,
    dateModified: guide.updated ?? guide.date,
    mainEntityOfPage: url,
    image: `${url}/og-image`,
    ...(guide.keywords?.length ? { keywords: guide.keywords.join(", ") } : {}),
    author: {
      "@type": "Person",
      "@id": `${AUTHOR_LINKS.website}#person`,
      ...AUTHOR_NAMES,
      url: AUTHOR_LINKS.website,
    },
    publisher: {
      "@type": "Organization",
      name: tMeta("siteName"),
      url: absoluteLocaleUrl(locale),
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: tMeta("siteName"), path: "" },
      { name: t("title"), path: "/guides" },
      { name: guide.title, path: `/guides/${slug}` },
    ].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteLocaleUrl(locale, item.path),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([article, breadcrumbs]) }}
      />
      <main id="main" className={styles.page}>
        <nav className={styles.crumbs} aria-label={t("breadcrumb")}>
          <Link href="/guides">{t("title")}</Link>
          <span aria-hidden>/</span>
          <span>{guide.title}</span>
        </nav>

        <header className={styles.intro}>
          <h1 className={styles.title}>{guide.title}</h1>
          <p className={styles.support}>{guide.description}</p>
          <p className={styles.meta}>
            <time dateTime={guide.updated ?? guide.date}>
              {guide.updated
                ? t("updated", { date: dateText(guide.updated) })
                : dateText(guide.date)}
            </time>
            {guide.readingMinutes ? (
              <span>
                {t("readingTime", {
                  minutes: formatLocaleDigits(guide.readingMinutes, locale),
                })}
              </span>
            ) : null}
          </p>
        </header>

        <article className={styles.prose}>
          <Content />
        </article>

        <GuideCta />

        {related.length > 0 ? (
          <section aria-labelledby="related-guides" className={styles.intro}>
            <h2 id="related-guides" className={styles.relatedTitle}>
              {t("related")}
            </h2>
            <ul className={styles.list}>
              {related.map((other) => (
                <li key={other.slug}>
                  <Link href={`/guides/${other.slug}`} className={styles.card}>
                    <span className={styles.cardTitle}>{other.title}</span>
                    <span className={styles.cardBody}>{other.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
