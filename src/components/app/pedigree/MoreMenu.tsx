"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineArrowUturnLeft,
  HiOutlineArrowsPointingIn,
  HiOutlineArrowsPointingOut,
  HiOutlineCog6Tooth,
  HiOutlineDocumentArrowDown,
  HiOutlineEllipsisHorizontal,
  HiOutlineEyeSlash,
  HiOutlineHeart,
  HiOutlineRectangleGroup,
  HiOutlineRectangleStack,
  HiOutlineSquares2X2,
  HiOutlineTableCells,
  HiOutlineTicket,
  HiOutlineUserPlus,
  HiOutlineViewfinderCircle,
} from "react-icons/hi2";
import { Link } from "@/i18n/navigation";
import { formatLocaleDigits } from "@/lib/localeDigits";
import type { ChromeTools } from "./chrome-density";
import styles from "./PedigreeView.module.css";

const emptySubscribe = () => () => {};

type Props = {
  treeId: string;
  busy: boolean;
  empty: boolean;
  fullscreen: boolean;
  /** Set while a branch preview narrows the canvas. */
  branchActive: boolean;
  /** People the folded branches keep off the canvas. */
  foldedCount: number;
  /** Measured chrome tool mode — drives which actions are listed here. */
  tools: ChromeTools;
  /** When true, person/marriage/calendar/export live in this menu (identity hidden). */
  foldPrimary: boolean;
  /** Owned by the Excel flow, which re-reads the picked file on confirm. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  canDownloadSample: boolean;
  canImportExcel: boolean;
  canExportExcel: boolean;
  canCreateTicket: boolean;
  canAccessSettings: boolean;
  canCreatePerson: boolean;
  canCreateMarriage: boolean;
  /** True when marriage create is allowed by count (needs ≥2 people). */
  marriageReady: boolean;
  layoutDensity: "layered" | "compact";
  onDownloadSample: () => void;
  onExportExcel: () => void;
  onPickFile: (file: File | null) => void;
  onTidyLayout: () => void;
  onToggleLayoutDensity: () => void;
  onExport: () => void;
  onAddMarriage: () => void;
  onAddPerson: () => void;
  onFitView: () => void;
  onToggleFullscreen: () => void;
  onExitBranch: () => void;
  onExpandFolded: () => void;
  onCreateTicket: () => void;
};

type Placement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function visibleBox() {
  const vv = window.visualViewport;
  if (vv) {
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
      bottom: vv.offsetTop + vv.height,
    };
  }
  return {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    bottom: window.innerHeight,
  };
}

/** Anchor the overflow menu under the ⋯ trigger, flipped above when needed. */
function measureMenuPlacement(trigger: HTMLElement): Placement | null {
  const rect = trigger.getBoundingClientRect();
  if (rect.width < 2 && rect.height < 2) return null;

  const view = visibleBox();
  const gap = 6;
  const edge = 8;
  const preferredWidth = Math.min(13.5 * 16, view.width - edge * 2);
  const spaceBelow = view.bottom - rect.bottom - gap;
  const spaceAbove = rect.top - view.top - gap;
  const above = spaceBelow < 12 * 16 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    8 * 16,
    Math.min(22 * 16, above ? spaceAbove : spaceBelow),
  );
  const left = Math.min(
    Math.max(view.left + edge, rect.right - preferredWidth),
    view.left + view.width - edge - preferredWidth,
  );
  // When flipped above, `top` is the panel's top edge (fixed positioning).
  const top = above
    ? Math.max(view.top + edge, rect.top - gap - maxHeight)
    : rect.bottom + gap;
  return { top, left, width: preferredWidth, maxHeight };
}

function MenuItem({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={styles.menuItem}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Overflow for the pedigree chrome. On phones this is the only action control
 * beside search and holds every tool the wide bar shows inline.
 *
 * The panel portals to `document.body` so the mobile path sheet and the
 * portaled person sheet (`--z-site-sheet`) cannot paint over it.
 */
export function MoreMenu({
  treeId,
  busy,
  empty,
  fullscreen,
  branchActive,
  foldedCount,
  tools,
  foldPrimary,
  fileInputRef,
  canDownloadSample,
  canImportExcel,
  canExportExcel,
  canCreateTicket,
  canAccessSettings,
  canCreatePerson,
  canCreateMarriage,
  marriageReady,
  layoutDensity,
  onDownloadSample,
  onExportExcel,
  onPickFile,
  onTidyLayout,
  onToggleLayoutDensity,
  onExport,
  onAddMarriage,
  onAddPerson,
  onFitView,
  onToggleFullscreen,
  onExitBranch,
  onExpandFolded,
  onCreateTicket,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const showData = canDownloadSample || canImportExcel || canExportExcel;
  const showCanvasState = branchActive || foldedCount > 0;

  // A closed menu keeps its last placement: the panel only renders while
  // `open`, and reopening re-measures here before the browser paints.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const sync = () => setPlacement(measureMenuPlacement(trigger));
    sync();
    const retry = window.setTimeout(sync, 160);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.clearTimeout(retry);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeThen = (action: () => void) => {
    setOpen(false);
    action();
  };

  const panelStyle: CSSProperties | undefined = placement
    ? {
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
      }
    : undefined;

  const panel =
    open && placement ? (
      <div
        ref={panelRef}
        className={`${styles.menuPanel} ${styles.menuPanelPortaled}`}
        role="menu"
        style={panelStyle}
      >
        {/* Canvas-state actions stay in the menu so immersive chrome can drop
            the identity row without trapping a hide / branch preview. */}
        {showCanvasState ? (
          <>
            {branchActive ? (
              <MenuItem
                disabled={busy}
                onClick={() => closeThen(onExitBranch)}
              >
                <HiOutlineArrowUturnLeft aria-hidden />
                {t("branchPreviewExit")}
              </MenuItem>
            ) : null}
            {foldedCount > 0 ? (
              <MenuItem
                disabled={busy}
                onClick={() => closeThen(onExpandFolded)}
              >
                <HiOutlineEyeSlash aria-hidden />
                {t("branchesFolded", {
                  count: formatLocaleDigits(foldedCount, locale),
                })}
              </MenuItem>
            ) : null}
            <hr className={styles.menuSep} />
          </>
        ) : null}

        {/* Phones: every chrome action that left the toolbar. */}
        {tools === "menu" ? (
        <div>
          {foldPrimary ? (
            <>
              <p className={styles.menuLabel}>{t("composeGroup")}</p>
              {canCreatePerson ? (
                <MenuItem disabled={busy} onClick={() => closeThen(onAddPerson)}>
                  <HiOutlineUserPlus aria-hidden />
                  {t("addPerson")}
                </MenuItem>
              ) : null}
              {canCreateMarriage ? (
                <MenuItem
                  disabled={busy || !marriageReady}
                  onClick={() => closeThen(onAddMarriage)}
                >
                  <HiOutlineHeart aria-hidden />
                  {t("addMarriage")}
                </MenuItem>
              ) : null}
            </>
          ) : null}

          <p className={styles.menuLabel}>{t("viewGroup")}</p>
          <MenuItem
            disabled={busy || empty}
            onClick={() => closeThen(onFitView)}
          >
            <HiOutlineViewfinderCircle aria-hidden />
            {t("fitView")}
          </MenuItem>
          <MenuItem
            disabled={busy}
            onClick={() => closeThen(onToggleFullscreen)}
          >
            {fullscreen ? (
              <HiOutlineArrowsPointingIn aria-hidden />
            ) : (
              <HiOutlineArrowsPointingOut aria-hidden />
            )}
            {fullscreen ? t("fullscreenExit") : t("fullscreen")}
          </MenuItem>
          <MenuItem
            disabled={busy || empty}
            onClick={() => closeThen(onTidyLayout)}
          >
            <HiOutlineRectangleGroup aria-hidden />
            {t("tidyLayout")}
          </MenuItem>
          <MenuItem
            disabled={busy || empty}
            onClick={() => closeThen(onToggleLayoutDensity)}
          >
            {layoutDensity === "compact" ? (
              <HiOutlineSquares2X2 aria-hidden />
            ) : (
              <HiOutlineRectangleStack aria-hidden />
            )}
            {layoutDensity === "compact"
              ? t("layoutDensityLayered")
              : t("layoutDensityCompact")}
          </MenuItem>
          {foldPrimary ? (
            <MenuItem
              disabled={busy || empty}
              onClick={() => closeThen(onExport)}
            >
              <HiOutlineArrowDownTray aria-hidden />
              {t("export")}
            </MenuItem>
          ) : null}
          <hr className={styles.menuSep} />
        </div>
        ) : null}

        {/* Icon strip: tidy stays here until the labeled bar has room. */}
        {tools === "icons" ? (
        <div>
          <MenuItem
            disabled={busy || empty}
            onClick={() => closeThen(onTidyLayout)}
          >
            <HiOutlineRectangleGroup aria-hidden />
            {t("tidyLayout")}
          </MenuItem>
          <hr className={styles.menuSep} />
        </div>
        ) : null}

        {showData ? (
          <>
            <p className={styles.menuLabel}>{t("dataMenu")}</p>
            {canDownloadSample ? (
              <MenuItem
                disabled={busy}
                onClick={() => closeThen(onDownloadSample)}
              >
                <HiOutlineDocumentArrowDown aria-hidden />
                {t("excelSample")}
              </MenuItem>
            ) : null}
            {canImportExcel ? (
              <MenuItem
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <HiOutlineArrowUpTray aria-hidden />
                {t("excelImport")}
              </MenuItem>
            ) : null}
            {canExportExcel ? (
              <MenuItem
                disabled={busy}
                onClick={() => closeThen(onExportExcel)}
              >
                <HiOutlineTableCells aria-hidden />
                {t("excelExport")}
              </MenuItem>
            ) : null}
            <hr className={styles.menuSep} />
          </>
        ) : null}

        {canCreateTicket ? (
          <MenuItem
            onClick={() => {
              setOpen(false);
              onCreateTicket();
            }}
          >
            <HiOutlineTicket aria-hidden />
            {t("createTicket")}
          </MenuItem>
        ) : null}
        {canAccessSettings ? (
          <Link
            role="menuitem"
            className={styles.menuItem}
            href={`/dashboard/trees/${treeId}/settings`}
            onClick={() => setOpen(false)}
          >
            <HiOutlineCog6Tooth aria-hidden />
            {t("settings")}
          </Link>
        ) : null}
      </div>
    ) : null;

  return (
    <div className={styles.menu} ref={menuRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className={styles.hiddenInput}
        onChange={(event) => {
          setOpen(false);
          onPickFile(event.target.files?.[0] ?? null);
        }}
      />
      <button
        ref={triggerRef}
        type="button"
        className={
          open ? `${styles.iconTool} ${styles.iconToolActive}` : styles.iconTool
        }
        disabled={busy}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("moreMenu")}
        title={t("moreMenuHint")}
        onClick={() => setOpen((current) => !current)}
      >
        <HiOutlineEllipsisHorizontal aria-hidden />
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
