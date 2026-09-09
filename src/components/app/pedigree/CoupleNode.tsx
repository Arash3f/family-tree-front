"use client";

import { memo, useRef, type CSSProperties } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useLocale, useTranslations } from "next-intl";
import { HiOutlineLockClosed } from "react-icons/hi2";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { formatDateForLocale, isReachedByYear } from "@/lib/pedigree/dates";
import type { CoupleNodeData } from "@/lib/pedigree/layout";
import {
  usePedigreeAsOfYear,
  usePedigreeDataAccess,
  usePedigreeSelect,
} from "./PedigreeSelectContext";
import styles from "./CoupleNode.module.css";

type CoupleFlowNode = Node<CoupleNodeData, "couple">;

function CoupleNodeComponent({ data }: NodeProps<CoupleFlowNode>) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const asOfYear = usePedigreeAsOfYear();
  const { canViewMarriageDate } = usePedigreeDataAccess();
  const onSelect = usePedigreeSelect();
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const unmarried =
    asOfYear !== null &&
    !isReachedByYear(data.marriedAt, asOfYear, locale);
  const marriedDate = data.marriedAt
    ? formatLocaleDigits(formatDateForLocale(data.marriedAt, locale), locale)
    : "";
  const chromeAt =
    typeof data.chromeAt === "number" && Number.isFinite(data.chromeAt)
      ? Math.min(1, Math.max(0, data.chromeAt))
      : 0.5;
  const chromeStyle = {
    ["--couple-chrome-x" as string]: `${chromeAt * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={[
        styles.frame,
        data.tone === "secondary" ? styles.secondary : "",
        data.highlighted ? styles.highlighted : "",
        data.onPath ? styles.onPath : "",
        data.onAltPath ? styles.onAltPath : "",
        data.dimmed ? styles.dimmed : "",
        unmarried ? styles.unmarried : data.divorced ? styles.divorced : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={chromeStyle}
      dir={locale === "fa" ? "rtl" : "ltr"}
      onPointerDown={(event) => {
        pointerDown.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={(event) => {
        const start = pointerDown.current;
        pointerDown.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (dx * dx + dy * dy > 36) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        onSelect(x < rect.width / 2 ? data.leftId : data.rightId);
      }}
    >
      {unmarried ? (
        <>
          <span className={styles.split} aria-hidden />
          <span className={styles.unmarriedBadge}>{t("notYetMarried")}</span>
        </>
      ) : (
        <span className={styles.ring} />
      )}
      {canViewMarriageDate ? (
        marriedDate ? (
          <span className={styles.marriedDate}>{marriedDate}</span>
        ) : null
      ) : (
        <span
          className={`${styles.marriedDate} ${styles.lockedDate}`}
          title={t("noAccessHint")}
          aria-label={t("noAccess")}
        >
          <HiOutlineLockClosed aria-hidden />
        </span>
      )}
      <Handle
        className={styles.handle}
        type="source"
        position={Position.Bottom}
        id="out"
        style={
          data.chromeAt != null
            ? { left: `${chromeAt * 100}%` }
            : undefined
        }
      />
    </div>
  );
}

export const CoupleNode = memo(CoupleNodeComponent);
