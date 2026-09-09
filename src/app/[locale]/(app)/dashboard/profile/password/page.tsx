import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfilePasswordView } from "@/components/app/ProfilePasswordView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("passwordMetaTitle") };
}

export default async function ProfilePasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfilePasswordView />;
}
