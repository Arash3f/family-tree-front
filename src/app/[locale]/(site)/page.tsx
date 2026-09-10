import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Architecture } from "@/components/landing/Architecture";
import { Author } from "@/components/landing/Author";
import { CallToAction } from "@/components/landing/CallToAction";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { Updates } from "@/components/landing/Updates";
import { AppSplash } from "@/components/loading/AppSplash";
import {
  absoluteLocaleUrl,
  languageAlternates,
  localePath,
} from "@/lib/site-url";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");
  const canonical = localePath(locale);

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: languageAlternates(),
    },
    openGraph: {
      url: canonical,
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tLoading = await getTranslations({ locale, namespace: "loading" });
  const tMeta = await getTranslations({ locale, namespace: "meta" });
  const pageUrl = absoluteLocaleUrl(locale);
  const ogImage = absoluteLocaleUrl(locale, "/opengraph-image");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Family Tree",
    url: pageUrl,
    image: ogImage,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description: tMeta("description"),
    inLanguage: routing.locales,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: "Family Tree",
      url: pageUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AppSplash brand={tLoading("brand")} label={tLoading("label")} />
      <main id="main">
        <Hero />
        <Features />
        <Updates />
        <Suspense fallback={null}>
          <Architecture />
        </Suspense>
        <Author />
        <CallToAction />
      </main>
    </>
  );
}
