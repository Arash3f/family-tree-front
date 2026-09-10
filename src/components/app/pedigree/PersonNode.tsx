"use client";

import { memo, useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineCalendarDays,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineEyeSlash,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlineMoon,
  HiOutlineUser,
} from "react-icons/hi2";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { OverflowMarquee } from "@/components/ui/OverflowMarquee";
import { ageInYearsAtYear, formatDateForLocale } from "@/lib/pedigree/dates";
import {
  personDisplayName,
  type PersonNodeData,
} from "@/lib/pedigree/layout";
import { resolvePersonPhotoUrl } from "@/lib/media";
import {
  usePedigreeAsOfYear,
  usePedigreeBranchActions,
  usePedigreeDataAccess,
  usePedigreeSelect,
} from "./PedigreeSelectContext";
import styles from "./PersonNode.module.css";

type PersonFlowNode = Node<PersonNodeData, "person">;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

function formatPersonDate(value: string | null, locale: string): string {
  if (!value) return "—";
  return formatLocaleDigits(formatDateForLocale(value, locale), locale);
}

/** Card clicks select the person and card drags move it; folding does neither. */
function swallow(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function stopThen(action: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    action();
  };
}

function FactRow({
  icon,
  label,
  value,
  empty,
  tone,
  title,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  empty?: boolean;
  tone?: "death";
  title?: string;
}) {
  return (
    <div className={`${styles.fact} ${tone === "death" ? styles.deathFact : ""}`}>
      <span className={styles.factIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.factLabel}>{label}</span>
      <span
        className={`${styles.factValue} ${empty ? styles.factEmpty : ""}`}
        title={title}
      >
        {value}
      </span>
    </div>
  );
}

function PersonNodeComponent({ data }: NodeProps<PersonFlowNode>) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const onSelect = usePedigreeSelect();
  const asOfYear = usePedigreeAsOfYear();
  const branch = usePedigreeBranchActions();
  const { canViewBirthDate, canViewPhoto } = usePedigreeDataAccess();
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const {
    person,
    selected,
    highlighted,
    onPath,
    onAltPath,
    dimmed,
    inCouple,
    hasDescendants,
    collapsedCount = 0,
  } = data;
  const collapsed = collapsedCount > 0;
  const label = personDisplayName(person);
  const photoSrc = resolvePersonPhotoUrl(person.photo_url, person.photo_object_key);
  const birthDate = formatPersonDate(person.birth_date, locale);
  const birthPlace = person.birth_place?.trim() || "—";
  const age = ageInYearsAtYear(
    person.birth_date,
    person.death_date,
    asOfYear,
    locale,
  );
  const deathDate = person.death_date
    ? formatPersonDate(person.death_date, locale)
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        styles.node,
        styles[person.gender],
        inCouple ? styles.inCouple : "",
        selected ? styles.selected : "",
        highlighted ? styles.highlighted : "",
        onPath ? styles.onPath : "",
        onAltPath ? styles.onAltPath : "",
        dimmed ? styles.dimmed : "",
        collapsed ? styles.collapsed : "",
        person.death_date ? styles.deceased : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        pressOrigin.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const origin = pressOrigin.current;
        pressOrigin.current = null;
        if (!origin) return;
        // Fold / hide controls own their presses.
        if ((event.target as HTMLElement | null)?.closest?.("button")) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        // Ignore presses that turned into a pan/drag.
        if (dx * dx + dy * dy > 64) return;
        onSelect(person.id);
      }}
      onPointerCancel={() => {
        pressOrigin.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(person.id);
        }
      }}
      aria-pressed={selected}
      aria-label={label}
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <Handle
        className={styles.handle}
        type="target"
        position={Position.Top}
        id="parent"
      />
      <Handle
        className={styles.handle}
        type="target"
        position={Position.Left}
        id="spouse-in"
      />
      <Handle
        className={styles.handle}
        type="source"
        position={Position.Right}
        id="spouse-out"
      />

      <div className={styles.header}>
        <span
          className={styles.avatar}
          aria-hidden
          title={canViewPhoto ? undefined : t("noAccessHint")}
        >
          {canViewPhoto ? (
            photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt=""
                className={styles.photo}
                loading="lazy"
                decoding="async"
              />
            ) : (
              initials(person.name)
            )
          ) : (
            <HiOutlineLockClosed className={styles.avatarLock} />
          )}
        </span>
        <span className={styles.identity}>
          <OverflowMarquee className={styles.name} title={label}>
            {label}
          </OverflowMarquee>
        </span>
        {age !== null ? (
          <span className={styles.ageBadge} title={t("fields.age")}>
            {formatLocaleDigits(age, locale)}
          </span>
        ) : null}
      </div>

      <div
        className={`${styles.foldBar} ${collapsed ? styles.foldBarPinned : ""} nodrag nopan`}
      >
        {collapsed ? (
          <button
            type="button"
            className={styles.foldChip}
            onClick={stopThen(() => branch.toggleCollapse(person.id))}
            onMouseDown={swallow}
            onPointerDown={swallow}
            title={t("branchExpand", {
              count: formatLocaleDigits(collapsedCount, locale),
            })}
            aria-label={t("branchExpand", {
              count: formatLocaleDigits(collapsedCount, locale),
            })}
          >
            <HiOutlineChevronDown aria-hidden />
            <span>+{formatLocaleDigits(collapsedCount, locale)}</span>
          </button>
        ) : null}
        {hasDescendants && !collapsed ? (
          <button
            type="button"
            className={styles.foldBtn}
            onClick={stopThen(() => branch.toggleCollapse(person.id))}
            onMouseDown={swallow}
            onPointerDown={swallow}
            title={t("branchCollapse")}
            aria-label={t("branchCollapse")}
          >
            <HiOutlineChevronUp aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          className={styles.foldBtn}
          onClick={stopThen(() => branch.hideBranch(person.id))}
          onMouseDown={swallow}
          onPointerDown={swallow}
          title={t("branchHide")}
          aria-label={t("branchHide")}
        >
          <HiOutlineEyeSlash aria-hidden />
        </button>
      </div>

      <div className={styles.facts}>
        <FactRow
          icon={<HiOutlineUser />}
          label={t("fields.gender")}
          value={
            <span className={`${styles.genderBadge} ${styles[person.gender]}`}>
              {t(`gender.${person.gender}`)}
            </span>
          }
        />
        <FactRow
          icon={<HiOutlineCalendarDays />}
          label={t("born")}
          value={
            canViewBirthDate ? (
              birthDate
            ) : (
              <HiOutlineLockClosed
                className={styles.lockedValue}
                aria-label={t("noAccess")}
              />
            )
          }
          empty={canViewBirthDate ? !person.birth_date : false}
          title={canViewBirthDate ? undefined : t("noAccessHint")}
        />
        <FactRow
          icon={<HiOutlineMapPin />}
          label={t("fields.birthPlace")}
          value={birthPlace}
          empty={!person.birth_place?.trim()}
        />
        {deathDate ? (
          <FactRow
            icon={<HiOutlineMoon />}
            label={t("died")}
            value={deathDate}
            tone="death"
          />
        ) : null}
      </div>

      <Handle
        className={styles.handle}
        type="source"
        position={Position.Bottom}
        id="child"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
