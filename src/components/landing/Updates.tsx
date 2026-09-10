import { getLocale, getTranslations } from "next-intl/server";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Section } from "./Section";
import styles from "./Updates.module.css";

const UPDATE_KEYS = ["u1", "u2", "u3"] as const;

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
      <ol className={styles.list}>
        {UPDATE_KEYS.map((key) => (
          <li key={key} className={styles.item}>
            <time className={styles.date} dateTime={t(`items.${key}.iso`)}>
              {t(`items.${key}.date`)}
            </time>
            <h3 className={styles.itemTitle}>{t(`items.${key}.title`)}</h3>
            <p className={styles.itemBody}>{t(`items.${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
