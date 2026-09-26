import { getTranslations, setRequestLocale } from "next-intl/server";
import { PedigreeView } from "@/components/app/pedigree/PedigreeView";
import { CARD_VARIANT_PARAM, parseCardVariant } from "@/lib/pedigree/card-variant";

type Props = {
  params: Promise<{ locale: string; treeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trees" });
  return { title: t("pedigreeMetaTitle") };
}

export default async function TreePedigreePage({ params, searchParams }: Props) {
  const { locale, treeId } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  return (
    <PedigreeView
      treeId={treeId}
      cardVariant={parseCardVariant(query[CARD_VARIANT_PARAM])}
    />
  );
}
