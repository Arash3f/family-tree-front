import { getTranslations, setRequestLocale } from "next-intl/server";
import { UsersListView } from "@/components/app/UsersListView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "users" });
  return { title: t("metaTitle") };
}

export default async function UsersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UsersListView />;
}
