import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileSessionsView } from "@/components/app/ProfileSessionsView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("sessionsMetaTitle") };
}

export default async function ProfileSessionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileSessionsView />;
}
