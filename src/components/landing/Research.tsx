import { getLocale, getTranslations } from "next-intl/server";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Section } from "./Section";
import styles from "./Research.module.css";

export async function Research() {
  const locale = await getLocale();
  const t = await getTranslations("research");
  const tNav = await getTranslations("nav");

  return (
    <Section
      id="research"
      ordinal={formatLocaleDigits("04", locale)}
      eyebrow={tNav("research")}
      title={t("title")}
      subtitle={t("subtitle")}
      delay={140}
    >
      <p className={styles.empty}>{t("empty")}</p>
    </Section>
  );
}
