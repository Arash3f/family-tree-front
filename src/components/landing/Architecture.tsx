import { getLocale, getTranslations } from "next-intl/server";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Section } from "./Section";
import { StackIcons } from "./StackIcons";
import styles from "./Architecture.module.css";

const POINT_KEYS = ["api", "sql", "graph", "jobs"] as const;

export async function Architecture() {
  const locale = await getLocale();
  const t = await getTranslations("architecture");
  const tNav = await getTranslations("nav");

  return (
    <Section
      id="architecture"
      ordinal={formatLocaleDigits("03", locale)}
      eyebrow={tNav("architecture")}
      title={t("title")}
      subtitle={t("subtitle")}
      delay={120}
    >
      <ol className={styles.points}>
        {POINT_KEYS.map((key, index) => (
          <li key={key} className={styles.point}>
            <span className={styles.step} aria-hidden>
              {formatLocaleDigits(index + 1, locale)}
            </span>
            <p className={styles.pointBody}>{t(`points.${key}`)}</p>
          </li>
        ))}
      </ol>

      <div className={styles.stack}>
        <h3 className={styles.stackTitle}>{t("stackTitle")}</h3>
        <StackIcons />
      </div>
    </Section>
  );
}
