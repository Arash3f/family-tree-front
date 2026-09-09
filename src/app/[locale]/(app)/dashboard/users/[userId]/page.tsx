import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserDetailView } from "@/components/app/UserDetailView";

type Props = {
  params: Promise<{ locale: string; userId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "users" });
  return { title: t("editMetaTitle") };
}

export default async function UserDetailPage({ params }: Props) {
  const { locale, userId } = await params;
  setRequestLocale(locale);
  return <UserDetailView userId={userId} />;
}
