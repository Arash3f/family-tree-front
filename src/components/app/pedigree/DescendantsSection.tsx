"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { ageInYearsAtYear } from "@/lib/pedigree/dates";
import { namedGenerationKey, type DescendantStats } from "@/lib/pedigree/descendants";
import { personDisplayName } from "@/lib/pedigree/layout";
import { GenderChip, GenderCountChips } from "./GenderCountChips";
import shared from "./PedigreeView.module.css";
import styles from "./DescendantsSection.module.css";

type Props = {
  /** Whose descendants these are; changing person collapses the open row. */
  personId: string;
  stats: DescendantStats;
  asOfYear: number | null;
  onSelectPerson: (personId: string) => void;
};

export function DescendantsSection({
  personId,
  stats,
  asOfYear,
  onSelectPerson,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const [expanded, setExpanded] = useState<{
    personId: string;
    generation: number;
  } | null>(null);
  const openGeneration =
    expanded?.personId === personId ? expanded.generation : null;

  const generationTitle = (generation: number) => {
    const key = namedGenerationKey(generation);
    return key === "n"
      ? t("generation.n", { n: formatLocaleDigits(generation, locale) })
      : t(`generation.${key}`);
  };

  return (
    <section className={shared.block}>
      <h3>{t("descendantsTitle")}</h3>
      {stats.total.total === 0 ? (
        <p className={shared.meta}>{t("descendantsEmpty")}</p>
      ) : (
        <>
          <div className={styles.descendantRow}>
            <p className={shared.meta}>
              {t("descendantsTotal", {
                total: formatLocaleDigits(stats.total.total, locale),
              })}
            </p>
            <GenderCountChips
              male={stats.total.male}
              female={stats.total.female}
            />
          </div>
          <ul className={styles.descendants}>
            {stats.generations.map((row) => {
              const open = openGeneration === row.generation;
              return (
                <li
                  key={row.generation}
                  className={open ? styles.descendantItemOpen : undefined}
                >
                  <button
                    type="button"
                    className={styles.descendantBox}
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded(
                        open ? null : { personId, generation: row.generation },
                      )
                    }
                  >
                    <div className={styles.descendantRow}>
                      <span>{generationTitle(row.generation)}</span>
                      <span className={styles.descendantTotal}>
                        {formatLocaleDigits(row.total, locale)}
                      </span>
                    </div>
                    <GenderCountChips male={row.male} female={row.female} />
                  </button>
                  {open ? (
                    <ul className={styles.descendantPeople}>
                      {row.people.map((person) => {
                        const deceased = Boolean(person.death_date);
                        const age = ageInYearsAtYear(
                          person.birth_date,
                          person.death_date,
                          asOfYear,
                          locale,
                        );
                        return (
                          <li key={person.id}>
                            <button
                              type="button"
                              className={styles.personLink}
                              onClick={() => onSelectPerson(person.id)}
                            >
                              {personDisplayName(person)}
                            </button>
                            <GenderChip gender={person.gender} />
                            <span
                              className={`${styles.vitalChip} ${
                                deceased ? styles.deceased : styles.living
                              }`}
                            >
                              {t(deceased ? "vital.deceased" : "vital.alive")}
                            </span>
                            {age !== null ? (
                              <span className={shared.meta}>
                                {t("ageYears", {
                                  count: formatLocaleDigits(age, locale),
                                })}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
