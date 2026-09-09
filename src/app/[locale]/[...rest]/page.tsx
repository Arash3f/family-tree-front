import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; rest: string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notFound" });

  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

/**
 * Unknown paths under a locale must return a real HTTP 404. The custom UI lives
 * in `src/app/[locale]/not-found.tsx`.
 */
export default async function CatchAllNotFound({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
