import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserCreateView } from "@/components/app/UserCreateView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "users" });
  return { title: t("createMetaTitle") };
}

export default async function UserCreatePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UserCreateView />;
}
