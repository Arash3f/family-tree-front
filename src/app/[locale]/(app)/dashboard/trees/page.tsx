import { getTranslations, setRequestLocale } from "next-intl/server";
import { TreesListView } from "@/components/app/TreesListView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trees" });
  return { title: t("metaTitle") };
}

export default async function TreesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TreesListView />;
}
