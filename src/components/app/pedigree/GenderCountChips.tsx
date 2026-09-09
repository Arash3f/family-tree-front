"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatLocaleDigits } from "@/lib/localeDigits";
import type { Gender } from "@/lib/auth/types";
import styles from "./GenderCountChips.module.css";

export function GenderCountChips({
  male,
  female,
}: {
  male: number;
  female: number;
}) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  if (male <= 0 && female <= 0) return null;
  return (
    <div className={styles.genderChips}>
      {male > 0 ? (
        <span className={`${styles.genderChip} ${styles.male}`}>
          {t("descendantGenderCount.male", {
            count: formatLocaleDigits(male, locale),
          })}
        </span>
      ) : null}
      {female > 0 ? (
        <span className={`${styles.genderChip} ${styles.female}`}>
          {t("descendantGenderCount.female", {
            count: formatLocaleDigits(female, locale),
          })}
        </span>
      ) : null}
    </div>
  );
}

export function GenderChip({ gender }: { gender: Gender }) {
  const t = useTranslations("pedigree");
  return (
    <span className={`${styles.genderChip} ${styles[gender]}`}>
      {t(`gender.${gender}`)}
    </span>
  );
}
