import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OAuthConsentView } from "@/components/app/OAuthConsentView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "oauth" });
  return { title: t("metaTitle") };
}

export default async function OAuthConsentPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <OAuthConsentView />
    </Suspense>
  );
}
