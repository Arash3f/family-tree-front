import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardHome } from "@/components/app/DashboardHome";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("metaTitle") };
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardHome />;
}
