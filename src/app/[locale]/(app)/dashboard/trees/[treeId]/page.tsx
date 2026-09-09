import { getTranslations, setRequestLocale } from "next-intl/server";
import { PedigreeView } from "@/components/app/pedigree/PedigreeView";

type Props = {
  params: Promise<{ locale: string; treeId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trees" });
  return { title: t("pedigreeMetaTitle") };
}

export default async function TreePedigreePage({ params }: Props) {
  const { locale, treeId } = await params;
  setRequestLocale(locale);
  return <PedigreeView treeId={treeId} />;
}
