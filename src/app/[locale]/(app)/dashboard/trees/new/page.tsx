import { getTranslations, setRequestLocale } from "next-intl/server";
import { TreeCreateView } from "@/components/app/TreeCreateView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trees" });
  return { title: t("createMetaTitle") };
}

export default async function TreeCreatePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TreeCreateView />;
}
