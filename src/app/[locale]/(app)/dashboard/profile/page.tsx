import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileOverviewView } from "@/components/app/ProfileOverviewView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("metaTitle") };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileOverviewView />;
}
