import { getTranslations, setRequestLocale } from "next-intl/server";
import { TicketsListView } from "@/components/app/TicketsListView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return { title: t("metaTitle") };
}

export default async function TicketsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TicketsListView />;
}
