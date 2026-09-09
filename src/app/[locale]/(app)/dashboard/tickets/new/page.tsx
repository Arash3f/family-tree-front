import { getTranslations, setRequestLocale } from "next-intl/server";
import { TicketCreateView } from "@/components/app/TicketCreateView";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ treeId?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return { title: t("createMetaTitle") };
}

export default async function NewTicketPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { treeId } = await searchParams;
  setRequestLocale(locale);
  return (
    <TicketCreateView
      preferredFamilyTreeId={typeof treeId === "string" ? treeId : undefined}
    />
  );
}
