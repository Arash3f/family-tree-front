import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { languageAlternates, localePath } from "@/lib/site-url";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  const title = t("metaTitle");
  const description = t("support");
  const canonical = localePath(locale, "/login");

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates("/login"),
    },
    openGraph: {
      url: canonical,
      title,
      description,
    },
    // Sign-in is a utility surface — keep it out of the marketing index.
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
