import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PedigreeView } from "@/components/app/pedigree/PedigreeView";
import {
  absoluteLocaleUrl,
  languageAlternates,
  localePath,
} from "@/lib/site-url";
import { routing } from "@/i18n/routing";
import styles from "./page.module.css";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Identity for the per-tree UI state (collapsed branches, opening fit). The
 * real tree id is server-side configuration and arrives with the data.
 */
const DEMO_TREE_KEY = "demo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "demo" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: localePath(locale, "/demo"),
      languages: languageAlternates("/demo"),
    },
    openGraph: {
      type: "website",
      url: absoluteLocaleUrl(locale, "/demo"),
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
    // Unlike the dashboard, this page is public on purpose — it is the only
    // view of a real tree a search engine may index.
    robots: { index: true, follow: true },
  };
}

export default async function DemoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "demo" });

  return (
    <main id="main" className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.support}>{t("support")}</p>
        <p className={styles.note}>{t("readOnlyNote")}</p>
      </header>
      {/*
       * Same component as the dashboard. Locale picks which published demo
       * tree loads (`DEMO_TREE_ID_FA` / `DEMO_TREE_ID_EN`, with `DEMO_TREE_ID`
       * as fallback). Capabilities come back read-only.
       */}
      <section className={styles.canvas} aria-label={t("canvasLabel")}>
        <PedigreeView treeId={DEMO_TREE_KEY} treeSource="demo" />
      </section>
    </main>
  );
}
