"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  HiArrowSmallLeft,
  HiMagnifyingGlass,
  HiOutlineArrowUpRight,
  HiXMark,
} from "react-icons/hi2";
import {
  getAlternativeRelationshipPaths,
  getClosestRelationship,
} from "@/lib/auth/client";
import type {
  ClosestRelationshipPath,
  Person,
} from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { personDisplayName } from "@/lib/pedigree/layout";
import styles from "./ProfileRelationPanel.module.css";

/** Hits rendered while picking the other person — enough to scan, cheap to paint. */
const MAX_RESULTS = 24;

type Props = {
  /** Tree id as the API knows it. */
  treeId: string;
  fromId: string;
  fromName: string;
  persons: Person[];
  personById: Map<string, Person>;
  onOpenPerson: (personId: string) => void;
};

type PathView = {
  key: string;
  ids: string[];
  distance: number;
  kinship: string | null;
  detail: string | null;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "miss" }
  | { kind: "error" }
  | { kind: "hit"; paths: PathView[] };

/** Picks the locale's copy of the kinship phrases the backend sends. */
function toPathView(
  path: ClosestRelationshipPath,
  index: number,
  locale: string,
): PathView {
  const fa = locale.startsWith("fa");
  return {
    key: `${index}-${path.path_person_ids.join("-")}`,
    ids: path.path_person_ids,
    distance: path.distance,
    kinship: (fa ? path.label_fa : path.label_en) ?? null,
    detail: (fa ? path.description_fa : path.description_en) ?? null,
  };
}

/**
 * The plain-language side of pathfinding: pick a second person and read how the
 * two are related as a sentence and a chain of names. The canvas view keeps the
 * highlighted corridor, lane colours and travel animation; this one does not
 * draw the tree at all.
 *
 * The caller keys the profile by person id, so moving on to another person
 * remounts this panel and the lookup resets on its own.
 */
export function ProfileRelationPanel({
  treeId,
  fromId,
  fromName,
  persons,
  personById,
  onOpenPerson,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [target, setTarget] = useState<Person | null>(null);
  const [maleOnly, setMaleOnly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [altLoading, setAltLoading] = useState(false);
  const [altAsked, setAltAsked] = useState(false);

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: Person[] = [];
    for (const person of persons) {
      if (person.id === fromId) continue;
      const hay = `${person.name} ${person.family_name ?? ""}`.toLowerCase();
      if (hay.includes(q)) {
        hits.push(person);
        if (hits.length >= MAX_RESULTS) break;
      }
    }
    return hits;
  }, [deferredQuery, persons, fromId]);

  const run = useCallback(
    async (toPerson: Person, viaMenOnly: boolean) => {
      setOutcome({ kind: "busy" });
      setActiveIndex(0);
      setAltAsked(false);
      try {
        const data = await getClosestRelationship(treeId, fromId, toPerson.id, {
          maleOnly: viaMenOnly,
        });
        if (!data.found) {
          setOutcome({ kind: "miss" });
          return;
        }
        const paths =
          data.paths.length > 0
            ? data.paths
            : [
                {
                  distance: data.distance ?? data.path_person_ids.length - 1,
                  path_person_ids: data.path_person_ids,
                  relationship_types: data.relationship_types,
                  label_fa: data.label_fa ?? null,
                  label_en: data.label_en ?? null,
                  description_fa: data.description_fa ?? null,
                  description_en: data.description_en ?? null,
                },
              ];
        setOutcome({
          kind: "hit",
          paths: paths.map((path, index) => toPathView(path, index, locale)),
        });
      } catch {
        setOutcome({ kind: "error" });
      }
    },
    [treeId, fromId, locale],
  );

  const pick = useCallback(
    (person: Person) => {
      setTarget(person);
      setQuery("");
      void run(person, maleOnly);
    },
    [run, maleOnly],
  );

  const toggleMaleOnly = useCallback(() => {
    const next = !maleOnly;
    setMaleOnly(next);
    if (target) void run(target, next);
  }, [maleOnly, target, run]);

  const loadAlternatives = useCallback(async () => {
    if (!target) return;
    setAltLoading(true);
    try {
      const data = await getAlternativeRelationshipPaths(
        treeId,
        fromId,
        target.id,
        { maleOnly },
      );
      if (data.paths.length > 0) {
        setOutcome({
          kind: "hit",
          paths: data.paths.map((path, index) =>
            toPathView(path, index, locale),
          ),
        });
        setActiveIndex(0);
      }
      setAltAsked(true);
    } catch {
      setAltAsked(true);
    } finally {
      setAltLoading(false);
    }
  }, [target, treeId, fromId, maleOnly, locale]);

  const parentHint = useCallback(
    (person: Person) => {
      const names: string[] = [];
      for (const link of person.parents) {
        const parent = personById.get(link.parent_id);
        if (parent) names.push(personDisplayName(parent));
        if (names.length === 2) break;
      }
      if (names.length === 0) return null;
      return t("explorer.childOf", { names: names.join(" · ") });
    },
    [personById, t],
  );

  const paths = outcome.kind === "hit" ? outcome.paths : [];
  const active = paths[activeIndex] ?? null;

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{t("findRelation")}</h3>
          <p className={styles.hint}>{t("relationFrom", { name: fromName })}</p>
        </div>
        <button
          type="button"
          className={`${styles.chip} ${maleOnly ? styles.chipActive : ""}`}
          onClick={toggleMaleOnly}
          aria-pressed={maleOnly}
        >
          {t("explorer.relationMaleOnly")}
        </button>
      </header>

      {target ? (
        <div className={styles.targetRow}>
          <span className={styles.targetName}>
            {personDisplayName(target)}
          </span>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              setTarget(null);
              setOutcome({ kind: "idle" });
            }}
          >
            <HiXMark aria-hidden />
            {t("clearSelection")}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.searchBox}>
            <HiMagnifyingGlass aria-hidden className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              value={query}
              placeholder={t("relateSearchPlaceholder")}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t("fields.relateTo")}
            />
          </div>
          {deferredQuery.trim().length > 0 ? (
            results.length > 0 ? (
              <ul className={styles.pickList}>
                {results.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      className={styles.pickRow}
                      onClick={() => pick(person)}
                    >
                      <span className={styles.pickName}>
                        {personDisplayName(person)}
                      </span>
                      {parentHint(person) ? (
                        <span className={styles.pickHint}>
                          {parentHint(person)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.note}>{t("explorer.noResults")}</p>
            )
          ) : (
            <p className={styles.note}>{t("explorer.relationPrompt")}</p>
          )}
        </>
      )}

      {outcome.kind === "busy" ? (
        <p className={styles.note} role="status">
          {t("relationAlternativesLoading")}
        </p>
      ) : null}

      {outcome.kind === "error" ? (
        <p className={styles.error}>{t("relationError")}</p>
      ) : null}

      {outcome.kind === "miss" ? (
        <p className={styles.note}>
          {maleOnly ? t("relationNotFoundMaleOnly") : t("relationNotFound")}
        </p>
      ) : null}

      {active ? (
        <div className={styles.result}>
          {active.kinship ? (
            <p className={styles.kinship}>{active.kinship}</p>
          ) : null}
          <p className={styles.distance}>
            {maleOnly
              ? t("relationFoundMaleOnly", {
                  distance: formatLocaleDigits(active.distance, locale),
                })
              : t("relationFound", {
                  distance: formatLocaleDigits(active.distance, locale),
                })}
          </p>

          <ol className={styles.chain}>
            {active.ids.map((id, index) => {
              const person = personById.get(id);
              return (
                <li key={`${id}-${index}`} className={styles.chainItem}>
                  {index > 0 ? (
                    <HiArrowSmallLeft aria-hidden className={styles.chainArrow} />
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.chainChip} ${
                      id === fromId ? styles.chainChipFrom : ""
                    }`}
                    onClick={() => onOpenPerson(id)}
                    disabled={!person}
                  >
                    {person ? personDisplayName(person) : "—"}
                    <HiOutlineArrowUpRight
                      aria-hidden
                      className={styles.chainGo}
                    />
                  </button>
                </li>
              );
            })}
          </ol>

          {active.detail && active.detail !== active.kinship ? (
            <p className={styles.detail}>
              {t("relationKinshipDetail", { detail: active.detail })}
            </p>
          ) : null}

          {paths.length > 1 ? (
            <div className={styles.altBlock}>
              <span className={styles.altLabel}>{t("relationPathsLabel")}</span>
              <div className={styles.altChips}>
                {paths.map((path, index) => (
                  <button
                    key={path.key}
                    type="button"
                    className={`${styles.chip} ${
                      index === activeIndex ? styles.chipActive : ""
                    }`}
                    onClick={() => setActiveIndex(index)}
                    title={path.kinship ?? undefined}
                  >
                    {index === 0
                      ? t("relationPathClosest", {
                          distance: formatLocaleDigits(path.distance, locale),
                        })
                      : t("relationPathOther", {
                          n: formatLocaleDigits(index + 1, locale),
                          distance: formatLocaleDigits(path.distance, locale),
                        })}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!altAsked ? (
            <button
              type="button"
              className={styles.altMore}
              onClick={() => void loadAlternatives()}
              disabled={altLoading}
            >
              {altLoading
                ? t("relationAlternativesLoading")
                : t("explorer.relationMorePaths")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
