import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileMcpView } from "@/components/app/ProfileMcpView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("mcpMetaTitle") };
}

export default async function ProfileMcpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileMcpView />;
}
