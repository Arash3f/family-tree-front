import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { languageAlternates, localePath } from "@/lib/site-url";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "register" });
  const title = t("metaTitle");
  const description = t("support");
  const canonical = localePath(locale, "/register");

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates("/register"),
    },
    openGraph: {
      url: canonical,
      title,
      description,
    },
    robots: { index: false, follow: false },
  };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
