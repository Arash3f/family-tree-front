"use client";

import { useMemo, useState, type MutableRefObject } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  HiArrowsPointingIn,
  HiArrowsPointingOut,
  HiArrowDownTray,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import type { Marriage, Person } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import {
  BRANCH_DEPTHS,
  subsetForBranchView,
  type BranchDepth,
} from "@/lib/pedigree/branch-view";
import { computePedigreeLayout } from "@/lib/pedigree/layout-compute";
import type { PedigreeCanvasHandle } from "./PedigreeCanvas";
import type { PedigreeDataAccess } from "./PedigreeSelectContext";
import { useFullscreen } from "./useFullscreen";
import styles from "./ProfileBranchPanel.module.css";

/** React Flow and its styles load with the branch card, not with the profile. */
const PedigreeCanvas = dynamic(
  () => import("./PedigreeCanvas").then((mod) => ({ default: mod.PedigreeCanvas })),
  { ssr: false },
);

/** The canvas needs these every render; module-level so identity stays stable. */
const EMPTY_IDS: Set<string> = new Set();
const EMPTY_ORDER: string[] = [];
const EMPTY_LANES: Map<string, number> = new Map();
/** Folding a branch away belongs to the full canvas, not to this card. */
const NO_BRANCH_ACTIONS = {
  toggleCollapse: () => {},
  hideBranch: () => {},
};

/** Default depth: the subject, their children and grandchildren. */
const DEFAULT_DEPTH: BranchDepth = 2;

type Props = {
  rootId: string;
  persons: Person[];
  marriages: Marriage[];
  dataAccess: PedigreeDataAccess;
  /** Export reads the live node positions through this handle. */
  canvasApiRef: MutableRefObject<PedigreeCanvasHandle | null>;
  onOpenPerson: (personId: string) => void;
  onExport: () => void;
};

/**
 * The branch card of the profile view: the subject's own slice of the tree on a
 * real canvas, so the cards, the dragging and the export are the same ones the
 * full tree view has — only the graph is clipped to this person.
 */
export function ProfileBranchPanel({
  rootId,
  persons,
  marriages,
  dataAccess,
  canvasApiRef,
  onOpenPerson,
  onExport,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const fullscreen = useFullscreen();

  const [depth, setDepth] = useState<BranchDepth>(DEFAULT_DEPTH);
  const [includeParents, setIncludeParents] = useState(false);
  /** Bumped to throw away the positions the user dragged the cards to. */
  const [resetAt, setResetAt] = useState(0);

  const branch = useMemo(
    () =>
      subsetForBranchView(persons, marriages, rootId, {
        depth,
        includeParents,
      }),
    [persons, marriages, rootId, depth, includeParents],
  );

  const graph = useMemo(
    () =>
      computePedigreeLayout({
        persons: branch.persons,
        marriages: branch.marriages,
        pathPersonIds: null,
        branchRootId: null,
        pathLayout: null,
        density: "compact",
      }),
    [branch],
  );

  const visiblePersonIds = useMemo(
    () => new Set(branch.persons.map((person) => person.id)),
    [branch],
  );

  /**
   * Must change in the same render as `graph`, or the canvas camera waits for a
   * graph it has already been given — hence derived from the inputs rather than
   * bumped from an effect.
   */
  const layoutToken = useMemo(
    () =>
      resetAt * 8 +
      BRANCH_DEPTHS.indexOf(depth) * 2 +
      (includeParents ? 1 : 0),
    [resetAt, depth, includeParents],
  );

  return (
    <section
      className={`${styles.panel} ${
        fullscreen.active ? styles.panelImmersive : ""
      }`}
    >
      <header className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{t("explorer.branchTitle")}</h3>
          <p className={styles.hint}>{t("explorer.branchHint")}</p>
        </div>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setResetAt((value) => value + 1)}
            aria-label={t("explorer.branchReset")}
            title={t("explorer.branchReset")}
          >
            <HiOutlineArrowPath aria-hidden />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={fullscreen.toggle}
            aria-label={
              fullscreen.active ? t("fullscreenExit") : t("fullscreen")
            }
            title={fullscreen.active ? t("fullscreenExit") : t("fullscreen")}
          >
            {fullscreen.active ? (
              <HiArrowsPointingIn aria-hidden />
            ) : (
              <HiArrowsPointingOut aria-hidden />
            )}
          </button>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={() => onExport()}
            disabled={branch.persons.length === 0}
          >
            <HiArrowDownTray aria-hidden />
            {t("explorer.branchExport")}
          </button>
        </div>
      </header>

      <div className={styles.controls}>
        <div
          className={styles.depthGroup}
          role="group"
          aria-label={t("explorer.branchDepth")}
        >
          <span className={styles.controlLabel}>
            {t("explorer.branchDepth")}
          </span>
          {BRANCH_DEPTHS.map((value) => (
            <button
              key={value ?? "all"}
              type="button"
              className={`${styles.chip} ${
                depth === value ? styles.chipActive : ""
              }`}
              onClick={() => setDepth(value)}
              aria-pressed={depth === value}
            >
              {value === null
                ? t("explorer.branchDepthAll")
                : t("explorer.branchDepthN", {
                    count: formatLocaleDigits(value, locale),
                  })}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.chip} ${includeParents ? styles.chipActive : ""}`}
          onClick={() => setIncludeParents((value) => !value)}
          aria-pressed={includeParents}
        >
          {t("explorer.branchWithParents")}
        </button>
        <span className={styles.count}>
          {t("statPeople", {
            count: formatLocaleDigits(branch.persons.length, locale),
          })}
        </span>
      </div>

      <div className={styles.canvasHost}>
        <PedigreeCanvas
          layoutNodes={graph.nodes}
          layoutEdges={graph.edges}
          layoutToken={layoutToken}
          layoutAnchor={null}
          cameraToken={0}
          cameraNodeIds={EMPTY_ORDER}
          selectedId={rootId}
          focusIds={EMPTY_IDS}
          pathIds={EMPTY_IDS}
          pathOrder={EMPTY_ORDER}
          altPathIds={EMPTY_IDS}
          pathLaneById={EMPTY_LANES}
          visiblePersonIds={visiblePersonIds}
          onSelect={(personId) => {
            if (!personId || personId === rootId) return;
            onOpenPerson(personId);
          }}
          asOfYear={null}
          dataAccess={dataAccess}
          branchActions={NO_BRANCH_ACTIONS}
          exportApiRef={canvasApiRef}
        />
      </div>
    </section>
  );
}
