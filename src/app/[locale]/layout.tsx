import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3, Vazirmatn } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { getSiteUrl } from "@/lib/site-url";
import { routing, type AppLocale } from "@/i18n/routing";
import "../globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#070d11" },
  ],
};

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

/**
 * Persian only. The Arabic subset is the largest of the three faces, so English
 * pages should not download it — `--font-vazirmatn` simply goes unset there and
 * the `html[lang="fa"]` rules in `globals.css` never apply.
 */
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (
    hasLocale(routing.locales, raw) ? raw : routing.defaultLocale
  ) as AppLocale;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: title,
      template: "%s · Family Tree",
    },
    description,
    applicationName: "Family Tree",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Family Tree",
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        {
          url: "/icons/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    openGraph: {
      type: "website",
      locale: locale === "fa" ? "fa_IR" : "en_US",
      alternateLocale: locale === "fa" ? ["en_US"] : ["fa_IR"],
      siteName: "Family Tree",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const isFa = locale === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const fontClasses = [
    fraunces.variable,
    sourceSans.variable,
    isFa ? vazirmatn.variable : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html
      lang={locale}
      dir={dir}
      data-scroll-behavior="smooth"
      className={fontClasses}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AuthProvider>
              <FeedbackProvider>{children}</FeedbackProvider>
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
