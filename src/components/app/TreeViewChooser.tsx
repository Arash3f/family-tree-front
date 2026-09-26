"use client";

import { useCallback, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import {
  treePageHref,
  type PedigreeCardVariant,
} from "@/lib/pedigree/card-variant";
import styles from "./TreeViewChooser.module.css";

type Props = {
  /** The tree being opened; null keeps the dialog closed. */
  tree: { id: string; name: string } | null;
  onClose: () => void;
};

const VARIANTS: PedigreeCardVariant[] = ["full", "minimal"];

/** Sketch of one person card in the chosen style, drawn with plain boxes. */
function CardSketch({ variant }: { variant: PedigreeCardVariant }) {
  if (variant === "minimal") {
    return (
      <span className={`${styles.sketchCard} ${styles.sketchMinimal}`} aria-hidden>
        <span className={styles.sketchAvatarLarge} />
        <span className={styles.sketchLine} />
        <span className={`${styles.sketchLine} ${styles.sketchLineShort}`} />
      </span>
    );
  }
  return (
    <span className={styles.sketchCard} aria-hidden>
      <span className={styles.sketchHead}>
        <span className={styles.sketchAvatar} />
        <span className={styles.sketchLine} />
      </span>
      <span className={`${styles.sketchLine} ${styles.sketchLineFact}`} />
      <span className={`${styles.sketchLine} ${styles.sketchLineFact}`} />
      <span className={`${styles.sketchLine} ${styles.sketchLineFact}`} />
    </span>
  );
}

/**
 * Asks how to show a family tree before opening it: the full cards, or the
 * minimal ones (photo, name, family name) that render faster on big trees.
 */
export function TreeViewChooser({ tree, onClose }: Props) {
  const t = useTranslations("trees");
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const open = tree !== null;

  const onEscape = useCallback(() => onClose(), [onClose]);
  useFocusTrap(modalRef, open, onEscape);
  useScrollLock(open);

  if (!tree) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId}>{t("viewChooserTitle")}</h2>
            <p className={styles.hint}>{tree.name}</p>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label={t("viewChooserClose")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.options}>
          {VARIANTS.map((variant) => (
            <Link
              key={variant}
              className={`${styles.option} ${
                variant === "minimal" ? styles.optionMinimal : ""
              }`}
              href={treePageHref(tree.id, variant)}
              onClick={onClose}
            >
              <span className={styles.preview}>
                <CardSketch variant={variant} />
                <CardSketch variant={variant} />
              </span>
              <span className={styles.optionTitle}>
                {t(variant === "minimal" ? "viewMinimal" : "viewFull")}
              </span>
              <span className={styles.optionHint}>
                {t(variant === "minimal" ? "viewMinimalHint" : "viewFullHint")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
