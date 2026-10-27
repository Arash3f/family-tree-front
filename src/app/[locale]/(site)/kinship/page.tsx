import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GuideCta } from "@/components/guides/GuideCta";
import styles from "@/components/guides/Guides.module.css";
import { KinshipTool } from "@/components/kinship/KinshipTool";
import { routing } from "@/i18n/routing";
import {
  describeChain,
  KINSHIP_STEPS,
  KINSHIP_TABLE,
  type KinshipStep,
} from "@/lib/kinship";
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
  const t = await getTranslations({ locale, namespace: "kinship" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: localePath(locale, "/kinship"),
      languages: languageAlternates("/kinship"),
    },
    openGraph: {
      type: "website",
      url: absoluteLocaleUrl(locale, "/kinship"),
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
    robots: { index: true, follow: true },
  };
}

export default async function KinshipPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "kinship" });
  const words = Object.fromEntries(
    KINSHIP_STEPS.map((step) => [step, t(`steps.${step}`)]),
  ) as Record<KinshipStep, string>;
  const faq = t.raw("faq") as { q: string; a: string }[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main id="main" className={styles.page}>
        <header className={styles.intro}>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.support}>{t("support")}</p>
        </header>

        <KinshipTool />

        <section aria-labelledby="kinship-table" className={styles.intro}>
          <h2 id="kinship-table" className={styles.relatedTitle}>
            {t("tableTitle")}
          </h2>
          <div className={styles.prose}>
            <table>
              <thead>
                <tr>
                  <th>{t("tableChain")}</th>
                  <th>{t("tablePersian")}</th>
                  <th>{t("tableEnglish")}</th>
                </tr>
              </thead>
              <tbody>
                {KINSHIP_TABLE.map((row) => (
                  <tr key={row.steps.join("-")}>
                    <td>{describeChain(row.steps, words, locale, t("me"))}</td>
                    <td lang="fa">{row.fa}</td>
                    <td lang="en">{row.en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="kinship-faq" className={styles.intro}>
          <h2 id="kinship-faq" className={styles.relatedTitle}>
            {t("faqTitle")}
          </h2>
          <div className={styles.prose}>
            {faq.map((item) => (
              <div key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <GuideCta title={t("ctaTitle")} body={t("ctaBody")} />
      </main>
    </>
  );
}
