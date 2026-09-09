import { getTranslations, setRequestLocale } from "next-intl/server";
import { TicketDetailView } from "@/components/app/TicketDetailView";

type Props = {
  params: Promise<{ locale: string; ticketId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return { title: t("detailMetaTitle") };
}

export default async function TicketDetailPage({ params }: Props) {
  const { locale, ticketId } = await params;
  setRequestLocale(locale);
  return <TicketDetailView ticketId={ticketId} />;
}
