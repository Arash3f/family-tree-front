"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { resolvePersonPhotoUrl } from "@/lib/media";
import {
  ageInYears,
  durationInYears,
  formatDateForLocale,
} from "@/lib/pedigree/dates";
import {
  countDescendantsByGeneration,
  namedGenerationKey,
} from "@/lib/pedigree/descendants";
import {
  captureElementPng,
  waitForElementImages,
} from "@/lib/pedigree/export-image";
import {
  posterThemeStyle,
  type ExportTheme,
} from "@/lib/pedigree/export-theme";
import { personDisplayName } from "@/lib/pedigree/layout";
import type { Marriage, Person } from "@/lib/auth/types";
import styles from "./PersonLineagePoster.module.css";

type Props = {
  person: Person;
  persons: Person[];
  marriages: Marriage[];
  treeName: string;
  theme: ExportTheme;
};

export type PersonLineagePosterHandle = {
  capture: () => Promise<string>;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return parts[0]!.slice(0, 1).toUpperCase();
}

export const PersonLineagePoster = forwardRef<PersonLineagePosterHandle, Props>(
  function PersonLineagePoster(
    { person, persons, marriages, treeName, theme },
    ref,
  ) {
    const t = useTranslations("pedigree");
    const locale = useLocale();
    const posterRef = useRef<HTMLDivElement>(null);

    const personById = useMemo(() => {
      const map = new Map<string, Person>();
      for (const item of persons) map.set(item.id, item);
      return map;
    }, [persons]);

    const stats = useMemo(
      () => countDescendantsByGeneration(person.id, persons),
      [person.id, persons],
    );
    const spouses = useMemo(
      () =>
        marriages.filter(
          (marriage) =>
            marriage.spouse_a_id === person.id ||
            marriage.spouse_b_id === person.id,
        ),
      [marriages, person.id],
    );

    const photo = resolvePersonPhotoUrl(person.photo_url, person.photo_object_key);
    const age = ageInYears(person.birth_date, person.death_date);
    const dateText = (value: string | null | undefined) =>
      value
        ? formatLocaleDigits(formatDateForLocale(value, locale), locale)
        : "";

    const generationTitle = (generation: number) => {
      const key = namedGenerationKey(generation);
      return key === "n"
        ? t("generation.n", { n: formatLocaleDigits(generation, locale) })
        : t(`generation.${key}`);
    };

    useImperativeHandle(ref, () => ({
      capture: async () => {
        const root = posterRef.current;
        if (!root) throw new Error("no-poster");
        if (document.fonts?.ready) await document.fonts.ready;
        await waitForElementImages(root);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        return captureElementPng(root, theme.background);
      },
    }), [theme]);

    return (
      <div
        ref={posterRef}
        className={styles.poster}
        lang={locale}
        style={posterThemeStyle(theme) as CSSProperties}
      >
        <p className={styles.kicker}>{t("lineagePosterKicker")}</p>
        {treeName ? <p className={styles.treeName}>{treeName}</p> : null}

        <header className={styles.hero}>
          <span className={`${styles.avatar} ${styles[person.gender]}`}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" loading="lazy" decoding="async" />
            ) : (
              initials(person.name)
            )}
          </span>
          <div>
            <h2>{personDisplayName(person)}</h2>
            <p className={styles.meta}>{t(`gender.${person.gender}`)}</p>
            {person.birth_date ? (
              <p className={styles.meta}>
                {t("born")}: {dateText(person.birth_date)}
                {person.birth_place ? ` · ${person.birth_place}` : ""}
              </p>
            ) : null}
            {age !== null ? (
              <p className={styles.age}>
                {t("ageYears", {
                  count: formatLocaleDigits(age, locale),
                })}
              </p>
            ) : null}
            <p className={styles.meta}>
              {person.death_date ? t("vital.deceased") : t("vital.alive")}
            </p>
            {person.death_date ? (
              <p className={styles.meta}>
                {t("died")}: {dateText(person.death_date)}
                {person.death_place ? ` · ${person.death_place}` : ""}
              </p>
            ) : person.death_place ? (
              <p className={styles.meta}>
                {t("fields.deathPlace")}: {person.death_place}
              </p>
            ) : null}
            {!person.birth_date && person.birth_place ? (
              <p className={styles.meta}>
                {t("fields.birthPlace")}: {person.birth_place}
              </p>
            ) : null}
          </div>
        </header>

        {person.notes ? <p className={styles.notes}>{person.notes}</p> : null}

        {person.parents.length > 0 ? (
          <section className={styles.block}>
            <h3>{t("fields.parents")}</h3>
            <ul className={styles.list}>
              {person.parents.map((link) => {
                const parent = personById.get(link.parent_id);
                return (
                  <li
                    key={`${link.parent_id}-${link.relationship_type}`}
                    className={styles.row}
                  >
                    <span>
                      {parent ? personDisplayName(parent) : link.parent_id}
                    </span>
                    <span className={styles.badge}>
                      {t(`relationship.${link.relationship_type}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {spouses.length > 0 ? (
          <section className={styles.block}>
            <h3>{t("marriagesTitle")}</h3>
            <ul className={styles.list}>
              {spouses.map((marriage) => {
                const otherId =
                  marriage.spouse_a_id === person.id
                    ? marriage.spouse_b_id
                    : marriage.spouse_a_id;
                const other = personById.get(otherId);
                const years = durationInYears(
                  marriage.married_at,
                  marriage.divorced_at,
                );
                return (
                  <li key={marriage.id} className={styles.marriage}>
                    <span className={styles.spouseName}>
                      {other ? personDisplayName(other) : otherId}
                    </span>
                    <p className={styles.meta}>
                      {dateText(marriage.married_at)}
                      {marriage.divorced_at
                        ? ` → ${dateText(marriage.divorced_at)}`
                        : ""}
                      {years !== null
                        ? ` · ${t("marriageDuration", {
                            count: formatLocaleDigits(years, locale),
                          })}`
                        : ""}
                    </p>
                    {marriage.divorced_at ? (
                      <span className={styles.badgeMuted}>{t("divorced")}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className={styles.block}>
          <h3>{t("descendantsTitle")}</h3>
          {stats.total.total === 0 ? (
            <p className={styles.meta}>{t("descendantsEmpty")}</p>
          ) : (
            <>
              <div className={styles.summary}>
                <p className={styles.meta}>
                  {t("descendantsTotal", {
                    total: formatLocaleDigits(stats.total.total, locale),
                  })}
                </p>
                <div className={styles.chips}>
                  {stats.total.male > 0 ? (
                    <span className={`${styles.chip} ${styles.male}`}>
                      {t("descendantGenderCount.male", {
                        count: formatLocaleDigits(stats.total.male, locale),
                      })}
                    </span>
                  ) : null}
                  {stats.total.female > 0 ? (
                    <span className={`${styles.chip} ${styles.female}`}>
                      {t("descendantGenderCount.female", {
                        count: formatLocaleDigits(stats.total.female, locale),
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
              <ul className={styles.list}>
                {stats.generations.map((row) => (
                  <li key={row.generation} className={styles.generation}>
                    <div className={styles.generationHead}>
                      <span>{generationTitle(row.generation)}</span>
                      <span>{formatLocaleDigits(row.total, locale)}</span>
                    </div>
                    <div className={styles.chips}>
                      {row.male > 0 ? (
                        <span className={`${styles.chip} ${styles.male}`}>
                          {t("descendantGenderCount.male", {
                            count: formatLocaleDigits(row.male, locale),
                          })}
                        </span>
                      ) : null}
                      {row.female > 0 ? (
                        <span className={`${styles.chip} ${styles.female}`}>
                          {t("descendantGenderCount.female", {
                            count: formatLocaleDigits(row.female, locale),
                          })}
                        </span>
                      ) : null}
                    </div>
                    <ul className={styles.people}>
                      {row.people.map((item) => {
                        const deceased = Boolean(item.death_date);
                        const itemAge = ageInYears(
                          item.birth_date,
                          item.death_date,
                        );
                        return (
                          <li key={item.id} className={styles.row}>
                            <span>{personDisplayName(item)}</span>
                            <span
                              className={`${styles.chip} ${styles[item.gender]}`}
                            >
                              {t(`gender.${item.gender}`)}
                            </span>
                            <span
                              className={`${styles.chip} ${
                                deceased ? styles.deceased : styles.living
                              }`}
                            >
                              {t(deceased ? "vital.deceased" : "vital.alive")}
                            </span>
                            {itemAge !== null ? (
                              <span className={styles.meta}>
                                {t("ageYears", {
                                  count: formatLocaleDigits(itemAge, locale),
                                })}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <p className={styles.footer}>{treeName || t("title")}</p>
      </div>
    );
  },
);
