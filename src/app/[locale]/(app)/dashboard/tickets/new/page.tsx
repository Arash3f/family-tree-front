import { getTranslations, setRequestLocale } from "next-intl/server";
import { TicketCreateView } from "@/components/app/TicketCreateView";
import { TICKET_CATEGORIES } from "@/lib/auth/types";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    treeId?: string | string[];
    category?: string | string[];
  }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return { title: t("createMetaTitle") };
}

export default async function NewTicketPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { treeId, category } = await searchParams;
  setRequestLocale(locale);
  const preferredCategory = TICKET_CATEGORIES.find((value) => value === category);
  return (
    <TicketCreateView
      preferredFamilyTreeId={typeof treeId === "string" ? treeId : undefined}
      preferredCategory={preferredCategory}
    />
  );
}
