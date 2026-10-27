import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import styles from "@/components/guides/Guides.module.css";
import { ButtonLink } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { getGuides } from "@/lib/guides";
import { formatLocaleDigits } from "@/lib/localeDigits";
import {
  absoluteLocaleUrl,
  languageAlternates,
  localePath,
} from "@/lib/site-url";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guides" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: localePath(locale, "/guides"),
      languages: languageAlternates("/guides"),
    },
    openGraph: {
      type: "website",
      url: absoluteLocaleUrl(locale, "/guides"),
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
    robots: { index: true, follow: true },
  };
}

export default async function GuidesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "guides" });
  const guides = await getGuides(locale as AppLocale);

  return (
    <main id="main" className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.support}>{t("support")}</p>
      </header>

      <aside className={styles.promo}>
        <div>
          <p className={styles.promoTitle}>{t("toolTitle")}</p>
          <p className={styles.promoBody}>{t("toolBody")}</p>
        </div>
        <ButtonLink href="/kinship" variant="ghost">
          {t("toolLink")}
        </ButtonLink>
      </aside>

      <ul className={styles.list}>
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link href={`/guides/${guide.slug}`} className={styles.card}>
              <span className={styles.cardTitle}>{guide.title}</span>
              <span className={styles.cardBody}>{guide.description}</span>
              {guide.readingMinutes ? (
                <span className={styles.meta}>
                  {t("readingTime", {
                    minutes: formatLocaleDigits(guide.readingMinutes, locale),
                  })}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
