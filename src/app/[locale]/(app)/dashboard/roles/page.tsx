import { getTranslations, setRequestLocale } from "next-intl/server";
import { RolesListView } from "@/components/app/RolesListView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roles" });
  return { title: t("metaTitle") };
}

export default async function RolesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RolesListView />;
}
