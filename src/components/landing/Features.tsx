import { getLocale, getTranslations } from "next-intl/server";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Section } from "./Section";
import styles from "./Features.module.css";

const FEATURE_KEYS = [
  "trees",
  "people",
  "relations",
  "timeline",
  "access",
] as const;

export async function Features() {
  const locale = await getLocale();
  const t = await getTranslations("features");
  const tNav = await getTranslations("nav");

  return (
    <Section
      id="features"
      ordinal={formatLocaleDigits("01", locale)}
      eyebrow={tNav("features")}
      title={t("title")}
      subtitle={t("subtitle")}
      delay={80}
      seamless
    >
      <ul className={styles.list}>
        {FEATURE_KEYS.map((key, index) => (
          <li
            key={key}
            className={styles.item}
            style={{ animationDelay: `${140 + index * 70}ms` }}
          >
            <span className={styles.index} aria-hidden>
              {formatLocaleDigits(String(index + 1).padStart(2, "0"), locale)}
            </span>
            <h3 className={styles.itemTitle}>{t(`items.${key}.title`)}</h3>
            <p className={styles.itemBody}>{t(`items.${key}.body`)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
