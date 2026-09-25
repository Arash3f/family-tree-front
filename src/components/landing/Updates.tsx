import { getLocale, getTranslations } from "next-intl/server";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Section } from "./Section";
import { UpdatesList } from "./UpdatesList";

export async function Updates() {
  const locale = await getLocale();
  const t = await getTranslations("updates");
  const tNav = await getTranslations("nav");

  return (
    <Section
      id="updates"
      ordinal={formatLocaleDigits("02", locale)}
      eyebrow={tNav("updates")}
      title={t("title")}
      subtitle={t("subtitle")}
      delay={100}
    >
      <UpdatesList />
    </Section>
  );
}
