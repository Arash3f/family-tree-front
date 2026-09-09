"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineHeart,
  HiOutlineLockClosed,
  HiOutlineUser,
  HiOutlineUserCircle,
  HiOutlineUserPlus,
} from "react-icons/hi2";
import type { Marriage, Person } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { formatDateForLocale } from "@/lib/pedigree/dates";
import {
  namedGenerationKey,
  type DescendantStats,
} from "@/lib/pedigree/descendants";
import { personDisplayName } from "@/lib/pedigree/layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { DescendantsSection } from "./DescendantsSection";
import { marriagePeriodText } from "./marriage-text";
import type { ParentRole } from "./person-form";
import styles from "./PedigreeView.module.css";

type Props = {
  person: Person;
  photoUrl: string | null;
  /** Age in the scrubbed timeline year, or null without a birth date. */
  age: number | null;
  asOfYear: number | null;
  marriages: Marriage[];
  descendantStats: DescendantStats | null;
  hasFather: boolean;
  hasMother: boolean;
  /** True when this person is the root of the branch preview. */
  branchActive: boolean;
  /** Set while any branch preview is open, whoever its root is. */
  branchRootName: string | null;
  relationResult: ReactNode;
  busy: boolean;
  canReadPersons: boolean;
  canReadMarriages: boolean;
  canViewBirthDate: boolean;
  canViewMarriageDate: boolean;
  canViewPhoto: boolean;
  canUpdatePerson: boolean;
  canDeletePerson: boolean;
  canCreatePerson: boolean;
  canCreateMarriage: boolean;
  canDeleteMarriage: boolean;
  nameOf: (personId: string) => string;
  onClose: () => void;
  onSelectPerson: (personId: string) => void;
  onEdit: () => void;
  onAddMarriage: () => void;
  onAddChild: () => void;
  onAddParent: (role: ParentRole) => void;
  onFindRelation: () => void;
  onToggleBranch: () => void;
  onDownloadLineage: () => void;
  onDelete: () => void;
};

type AddRelativeTile = {
  key: string;
  icon: ReactNode;
  /** Short label for the tile; the full phrase is the accessible name. */
  label: string;
  fullLabel: string;
  tone?: "male" | "female";
  onClick: () => void;
};

export function PersonDetailPanel({
  person,
  photoUrl,
  age,
  asOfYear,
  marriages,
  descendantStats,
  hasFather,
  hasMother,
  branchActive,
  branchRootName,
  relationResult,
  busy,
  canReadPersons,
  canReadMarriages,
  canViewBirthDate,
  canViewMarriageDate,
  canViewPhoto,
  canUpdatePerson,
  canDeletePerson,
  canCreatePerson,
  canCreateMarriage,
  canDeleteMarriage,
  nameOf,
  onClose,
  onSelectPerson,
  onEdit,
  onAddMarriage,
  onAddChild,
  onAddParent,
  onFindRelation,
  onToggleBranch,
  onDownloadLineage,
  onDelete,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();

  const generationShortLabel = (generation: number, count: number) => {
    const key = namedGenerationKey(generation);
    const countText = formatLocaleDigits(count, locale);
    return key === "n"
      ? t("generationShort.n", {
          count: countText,
          n: formatLocaleDigits(generation, locale),
        })
      : t(`generationShort.${key}`, { count: countText });
  };

  const canAddParent =
    canCreatePerson && canUpdatePerson && person.parents.length < 2;

  const addTiles: AddRelativeTile[] = [];
  if (canCreateMarriage) {
    addTiles.push({
      key: "marriage",
      icon: <HiOutlineHeart aria-hidden />,
      label: t("addRelative.marriage"),
      fullLabel: t("addMarriage"),
      onClick: onAddMarriage,
    });
  }
  if (canCreatePerson) {
    addTiles.push({
      key: "child",
      icon: <HiOutlineUserPlus aria-hidden />,
      label: t("addRelative.child"),
      fullLabel: t("addChild"),
      onClick: onAddChild,
    });
  }
  if (canAddParent && !hasFather) {
    addTiles.push({
      key: "father",
      icon: <HiOutlineUser aria-hidden />,
      label: t("addRelative.father"),
      fullLabel: t("addFather"),
      tone: "male",
      onClick: () => onAddParent("father"),
    });
  }
  if (canAddParent && !hasMother) {
    addTiles.push({
      key: "mother",
      icon: <HiOutlineUserCircle aria-hidden />,
      label: t("addRelative.mother"),
      fullLabel: t("addMother"),
      tone: "female",
      onClick: () => onAddParent("mother"),
    });
  }

  return (
    <div className={styles.detail}>
      <header className={styles.panelHeader}>
        <h2>{personDisplayName(person)}</h2>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onClose}
          aria-label={t("close")}
        >
          ×
        </button>
      </header>

      <div className={styles.detailHero}>
        <span
          className={`${styles.detailAvatar} ${styles[person.gender]}`}
          title={canViewPhoto ? undefined : t("noAccessHint")}
        >
          {canViewPhoto ? (
            photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              person.name.slice(0, 1).toUpperCase()
            )
          ) : (
            <HiOutlineLockClosed aria-hidden />
          )}
        </span>
        <div>
          <p className={styles.meta}>{t(`gender.${person.gender}`)}</p>
          {!canViewBirthDate ? (
            <p className={styles.meta} title={t("noAccessHint")}>
              {t("born")}:{" "}
              <HiOutlineLockClosed
                className={styles.lockedInline}
                aria-label={t("noAccess")}
              />
              {person.birth_place ? ` · ${person.birth_place}` : ""}
            </p>
          ) : person.birth_date ? (
            <p className={styles.meta}>
              {t("born")}:{" "}
              {formatLocaleDigits(
                formatDateForLocale(person.birth_date, locale),
                locale,
              )}
              {person.birth_place ? ` · ${person.birth_place}` : ""}
            </p>
          ) : null}
          {age !== null ? (
            <p className={styles.age}>
              {t("ageYears", { count: formatLocaleDigits(age, locale) })}
            </p>
          ) : null}
          <p className={styles.meta}>
            {person.death_date ? t("vital.deceased") : t("vital.alive")}
          </p>
          {descendantStats && descendantStats.total.total > 0 ? (
            <p className={styles.descendantSummary}>
              {descendantStats.generations
                .map((row) => generationShortLabel(row.generation, row.total))
                .join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {person.notes ? <p className={styles.notes}>{person.notes}</p> : null}

      {person.parents.length > 0 ? (
        <section className={styles.block}>
          <h3>{t("fields.parents")}</h3>
          <ul className={styles.list}>
            {person.parents.map((link) => (
              <li key={`${link.parent_id}-${link.relationship_type}`}>
                <button
                  type="button"
                  className={styles.linkish}
                  onClick={() => onSelectPerson(link.parent_id)}
                >
                  {nameOf(link.parent_id)}
                </button>
                <Badge tone="accent">
                  {t(`relationship.${link.relationship_type}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canReadMarriages && marriages.length > 0 ? (
        <section className={styles.block}>
          <h3>
            {t("marriagesTitle")}
            {marriages.filter((m) => !m.divorced_at).length > 1 ? (
              <Badge tone="accent">
                {t("activeSpousesCount", {
                  count: formatLocaleDigits(
                    marriages.filter((m) => !m.divorced_at).length,
                    locale,
                  ),
                })}
              </Badge>
            ) : null}
          </h3>
          <ul className={styles.list}>
            {marriages.map((marriage, index) => {
              const otherId =
                marriage.spouse_a_id === person.id
                  ? marriage.spouse_b_id
                  : marriage.spouse_a_id;
              const spouseOrdinal = marriages
                .slice(0, index + 1)
                .filter((item) => !item.divorced_at).length;
              return (
                <li key={marriage.id} className={styles.marriageRow}>
                  <div>
                    <button
                      type="button"
                      className={styles.linkish}
                      onClick={() => onSelectPerson(otherId)}
                    >
                      {!marriage.divorced_at
                        ? t("spouseOrdinal", {
                            n: formatLocaleDigits(spouseOrdinal, locale),
                          })
                        : t("formerSpouse")}
                      {": "}
                      {nameOf(otherId)}
                    </button>
                    {canViewMarriageDate ? (
                      <p className={styles.meta}>
                        {marriagePeriodText(marriage, locale, (years) =>
                          t("marriageDuration", {
                            count: formatLocaleDigits(years, locale),
                          }),
                        )}
                      </p>
                    ) : (
                      <p className={styles.meta} title={t("noAccessHint")}>
                        {t("fields.marriedAt")}:{" "}
                        <HiOutlineLockClosed
                          className={styles.lockedInline}
                          aria-label={t("noAccess")}
                        />
                      </p>
                    )}
                    {marriage.divorced_at ? (
                      <Badge>{t("divorced")}</Badge>
                    ) : (
                      <Badge tone="accent">{t("spouseActive")}</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {descendantStats ? (
        <DescendantsSection
          personId={person.id}
          stats={descendantStats}
          asOfYear={asOfYear}
          onSelectPerson={onSelectPerson}
        />
      ) : null}

      {addTiles.length > 0 ? (
        <section className={styles.block}>
          <h3>{t("addRelativeTitle")}</h3>
          <div className={styles.addGrid}>
            {addTiles.map((tile) => (
              <button
                key={tile.key}
                type="button"
                className={styles.addTile}
                disabled={busy}
                aria-label={tile.fullLabel}
                title={tile.fullLabel}
                onClick={tile.onClick}
              >
                <span
                  className={`${styles.addTileIcon} ${
                    tile.tone ? styles[tile.tone] : ""
                  }`}
                >
                  {tile.icon}
                </span>
                {tile.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.detailActions}>
        {canUpdatePerson || canDeleteMarriage ? (
          <Button size="sm" disabled={busy} onClick={onEdit}>
            {t("edit")}
          </Button>
        ) : null}
        {canReadPersons ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onFindRelation}
          >
            {t("findRelation")}
          </Button>
        ) : null}
        {canReadPersons ? (
          <Button
            variant="ghost"
            size="sm"
            className={branchActive ? styles.ghostBtnActive : undefined}
            disabled={busy}
            onClick={onToggleBranch}
          >
            {branchActive ? t("branchPreviewExit") : t("branchPreview")}
          </Button>
        ) : null}
        {canReadPersons ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onDownloadLineage}
          >
            {t("downloadLineage")}
          </Button>
        ) : null}
        {canDeletePerson ? (
          <Button
            variant="dangerGhost"
            size="sm"
            disabled={busy}
            onClick={onDelete}
          >
            {t("delete")}
          </Button>
        ) : null}
      </div>

      {branchRootName ? (
        <p className={styles.relationNote}>
          {t("branchPreviewNote", { name: branchRootName })}
        </p>
      ) : null}

      {relationResult}
    </div>
  );
}
