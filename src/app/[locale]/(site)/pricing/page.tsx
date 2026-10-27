import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HiCheck } from "react-icons/hi2";
import { ButtonLink } from "@/components/ui/Button";
import { routing } from "@/i18n/routing";
import {
  FREE_MAX_MARRIAGES_PER_TREE,
  FREE_MAX_OWNED_TREES,
  FREE_MAX_PERSONS_PER_TREE,
  UPGRADE_REQUEST_HREF,
} from "@/lib/auth/account-limits";
import { formatLocaleDigits } from "@/lib/localeDigits";
import {
  absoluteLocaleUrl,
  languageAlternates,
  localePath,
} from "@/lib/site-url";
import styles from "./page.module.css";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Self-hosting starts from the backend, whose README covers the full stack. */
const SELF_HOST_REPO_URL = "https://github.com/Arash3f/family-tree-backend";

const PLANS = ["free", "family", "selfHost"] as const;
type PlanId = (typeof PLANS)[number];

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: localePath(locale, "/pricing"),
      languages: languageAlternates("/pricing"),
    },
    openGraph: {
      type: "website",
      url: absoluteLocaleUrl(locale, "/pricing"),
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
    robots: { index: true, follow: true },
  };
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pricing" });
  const tMeta = await getTranslations({ locale, namespace: "meta" });
  const digits = (value: number) => formatLocaleDigits(value, locale);
  const limits = {
    trees: digits(FREE_MAX_OWNED_TREES),
    people: digits(FREE_MAX_PERSONS_PER_TREE),
    marriages: digits(FREE_MAX_MARRIAGES_PER_TREE),
  };

  const plan = (id: PlanId) => ({
    name: t(`plans.${id}.name`),
    tagline: t(`plans.${id}.tagline`),
    features: (t.raw(`plans.${id}.features`) as string[]).map((_, index) =>
      t(`plans.${id}.features.${index}`, limits),
    ),
    cta: t(`plans.${id}.cta`),
  });
  const price: Record<PlanId, string> = {
    free: t("freePrice"),
    family: t("familyPrice"),
    selfHost: t("freePrice"),
  };
  const cta: Record<PlanId, string> = {
    free: "/register",
    family: UPGRADE_REQUEST_HREF,
    selfHost: SELF_HOST_REPO_URL,
  };
  const steps = t.raw("howSteps") as string[];

  // The Family price is set by hand, so its offer names the plan without a
  // price until one is published in the copy.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tMeta("siteName"),
    url: absoluteLocaleUrl(locale, "/pricing"),
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    inLanguage: locale,
    offers: PLANS.map((id) => ({
      "@type": "Offer",
      name: plan(id).name,
      description: plan(id).tagline,
      ...(id === "family" ? {} : { price: "0", priceCurrency: "USD" }),
      url: absoluteLocaleUrl(locale, "/pricing"),
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

        <ul className={styles.plans}>
          {PLANS.map((id) => {
            const { name, tagline, features, cta: label } = plan(id);
            const external = id === "selfHost";
            return (
              <li
                key={id}
                className={`${styles.plan} ${id === "family" ? styles.featured : ""}`}
              >
                <h2 className={styles.planName}>{name}</h2>
                <p className={styles.price}>{price[id]}</p>
                <p className={styles.tagline}>{tagline}</p>
                <ul className={styles.features}>
                  {features.map((feature) => (
                    <li key={feature}>
                      <HiCheck className={styles.check} aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                {external ? (
                  <a
                    className={styles.external}
                    href={cta[id]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                  </a>
                ) : (
                  <ButtonLink
                    href={cta[id]}
                    variant={id === "family" ? "primary" : "ghost"}
                    block
                  >
                    {label}
                  </ButtonLink>
                )}
              </li>
            );
          })}
        </ul>

        <section className={styles.how} aria-labelledby="pricing-how">
          <h2 id="pricing-how" className={styles.howTitle}>
            {t("howTitle")}
          </h2>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className={styles.note}>{t("keepNote")}</p>
        </section>
      </main>
    </>
  );
}
