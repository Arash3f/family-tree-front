"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { PathViewMode } from "./useGraphFocus";
import styles from "./PedigreeView.module.css";

export type RelationPathChoice = {
  key: string;
  label: string;
  /** 0 = selected (gold); 1..N = alternative lane colors. */
  lane: number;
};

type Props = {
  label: string | null;
  /** False when the lookup found nothing, so there is no view to switch. */
  hasPath: boolean;
  viewMode: PathViewMode;
  onApplyView: (mode: PathViewMode) => void;
  paths?: RelationPathChoice[];
  activePathIndex?: number;
  onSelectPath?: (index: number) => void;
  /** True while diverse alternatives are still loading after the closest path. */
  alternativesLoading?: boolean;
};

function laneSwatchClass(lane: number): string {
  return lane <= 0 ? styles.pathSwatchActive : styles.pathSwatchAlt;
}

export function RelationResult({
  label,
  hasPath,
  viewMode,
  onApplyView,
  paths = [],
  activePathIndex = 0,
  onSelectPath,
  alternativesLoading = false,
}: Props) {
  const t = useTranslations("pedigree");
  if (!label) return null;
  return (
    <div>
      <p className={styles.relationNote}>{label}</p>
      {alternativesLoading ? (
        <p className={styles.relationNote}>{t("relationAlternativesLoading")}</p>
      ) : null}
      {hasPath && paths.length > 1 && onSelectPath ? (
        <div
          className={styles.pathChoices}
          role="listbox"
          aria-label={t("relationPathsLabel")}
        >
          {paths.map((path, index) => (
            <Button
              key={path.key}
              variant="ghost"
              size="sm"
              className={
                index === activePathIndex ? styles.ghostBtnActive : undefined
              }
              aria-selected={index === activePathIndex}
              role="option"
              onClick={() => onSelectPath(index)}
            >
              <span
                className={`${styles.pathSwatch} ${laneSwatchClass(path.lane)}`}
                aria-hidden
              />
              {path.label}
            </Button>
          ))}
        </div>
      ) : null}
      {hasPath ? (
        <div
          className={styles.pathViewToggle}
          role="group"
          aria-label={t("pathViewLabel")}
        >
          <Button
            variant="ghost"
            size="sm"
            className={viewMode === "full" ? styles.ghostBtnActive : undefined}
            onClick={() => onApplyView("full")}
          >
            {t("pathViewFull")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={viewMode === "all" ? styles.ghostBtnActive : undefined}
            onClick={() => onApplyView("all")}
          >
            {t("pathViewAll")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={viewMode === "active" ? styles.ghostBtnActive : undefined}
            onClick={() => onApplyView("active")}
          >
            {t("pathViewActive")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
