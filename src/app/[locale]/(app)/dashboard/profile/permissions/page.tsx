import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfilePermissionsView } from "@/components/app/ProfilePermissionsView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("permissionsMetaTitle") };
}

export default async function ProfilePermissionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfilePermissionsView />;
}
