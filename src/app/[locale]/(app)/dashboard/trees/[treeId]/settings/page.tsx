import { getTranslations, setRequestLocale } from "next-intl/server";
import { TreeDetailView } from "@/components/app/TreeDetailView";

type Props = {
  params: Promise<{ locale: string; treeId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trees" });
  return { title: t("settingsMetaTitle") };
}

export default async function TreeSettingsPage({ params }: Props) {
  const { locale, treeId } = await params;
  setRequestLocale(locale);
  return <TreeDetailView treeId={treeId} />;
}
