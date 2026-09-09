import { getTranslations, setRequestLocale } from "next-intl/server";
import { RoleDetailView } from "@/components/app/RoleDetailView";

type Props = {
  params: Promise<{ locale: string; roleId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roles" });
  return { title: t("editMetaTitle") };
}

export default async function RoleDetailPage({ params }: Props) {
  const { locale, roleId } = await params;
  setRequestLocale(locale);
  return <RoleDetailView roleId={roleId} />;
}
