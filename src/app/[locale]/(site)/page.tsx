import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Architecture } from "@/components/landing/Architecture";
import { Author } from "@/components/landing/Author";
import { CallToAction } from "@/components/landing/CallToAction";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { Updates } from "@/components/landing/Updates";
import { AppSplash } from "@/components/loading/AppSplash";
import {
  absoluteLocaleUrl,
  getSiteUrl,
  languageAlternates,
  localePath,
} from "@/lib/site-url";
import { AUTHOR_LINKS, AUTHOR_NAMES } from "@/lib/author";
import { OG_IMAGE_SIZE } from "@/lib/brand-icon";
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
  const siteName = t("siteName");
  const ogAlt = t("ogImageAlt");
  const canonicalPath = localePath(locale);
  const pageUrl = absoluteLocaleUrl(locale);
  const ogImageUrl = absoluteLocaleUrl(locale, "/opengraph-image");
  const ogLocale = locale === "fa" ? "fa_IR" : "en_US";
  const ogAlternate = locale === "fa" ? "en_US" : "fa_IR";

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalPath,
      languages: languageAlternates(),
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      siteName,
      locale: ogLocale,
      alternateLocale: [ogAlternate],
      images: [
        {
          url: ogImageUrl,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          alt: ogAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImageUrl, alt: ogAlt }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tLoading = await getTranslations({ locale, namespace: "loading" });
  const tMeta = await getTranslations({ locale, namespace: "meta" });
  const tHero = await getTranslations({ locale, namespace: "hero" });
  const pageUrl = absoluteLocaleUrl(locale);
  const ogImage = absoluteLocaleUrl(locale, "/opengraph-image");
  const tAuthor = await getTranslations({ locale, namespace: "author" });
  const siteName = tMeta("siteName");
  const logoUrl = `${getSiteUrl()}/icons/icon-512.png`;
  const author = {
    "@type": "Person",
    "@id": `${AUTHOR_LINKS.website}#person`,
    ...AUTHOR_NAMES,
    jobTitle: tAuthor("role"),
    url: AUTHOR_LINKS.website,
    sameAs: [AUTHOR_LINKS.linkedin, AUTHOR_LINKS.github],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteName,
    alternateName: locale === "fa" ? "Family Tree" : "شجره‌نامه",
    url: pageUrl,
    image: ogImage,
    screenshot: ogImage,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description: tMeta("description"),
    inLanguage: locale,
    availableLanguage: [...routing.locales],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author,
    creator: { "@id": author["@id"] },
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: pageUrl,
      logo: logoUrl,
    },
    potentialAction: {
      "@type": "RegisterAction",
      target: absoluteLocaleUrl(locale, "/register"),
      name: tHero("ctaRegister"),
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
        <Faq />
        <CallToAction />
      </main>
    </>
  );
}
