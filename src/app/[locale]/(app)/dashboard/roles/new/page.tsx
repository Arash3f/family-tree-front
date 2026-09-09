import { getTranslations, setRequestLocale } from "next-intl/server";
import { RoleCreateView } from "@/components/app/RoleCreateView";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roles" });
  return { title: t("createMetaTitle") };
}

export default async function RoleCreatePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RoleCreateView />;
}
