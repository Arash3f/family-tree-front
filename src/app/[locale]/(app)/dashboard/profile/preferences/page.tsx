import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfilePreferencesView } from "@/components/app/ProfilePreferencesView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("preferencesMetaTitle") };
}

export default async function ProfilePreferencesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfilePreferencesView />;
}
