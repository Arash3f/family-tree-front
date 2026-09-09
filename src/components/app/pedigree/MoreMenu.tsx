"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineArrowUturnLeft,
  HiOutlineArrowsPointingIn,
  HiOutlineArrowsPointingOut,
  HiOutlineCalendarDays,
  HiOutlineCog6Tooth,
  HiOutlineDocumentArrowDown,
  HiOutlineEllipsisHorizontal,
  HiOutlineEyeSlash,
  HiOutlineHeart,
  HiOutlineRectangleGroup,
  HiOutlineTableCells,
  HiOutlineTicket,
  HiOutlineUserPlus,
  HiOutlineViewfinderCircle,
} from "react-icons/hi2";
import { Link } from "@/i18n/navigation";
import { formatLocaleDigits } from "@/lib/localeDigits";
import styles from "./PedigreeView.module.css";

type Props = {
  treeId: string;
  busy: boolean;
  empty: boolean;
  fullscreen: boolean;
  /** Set while a branch preview narrows the canvas. */
  branchActive: boolean;
  /** People the folded branches keep off the canvas. */
  foldedCount: number;
  /** Owned by the Excel flow, which re-reads the picked file on confirm. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  canDownloadSample: boolean;
  canImportExcel: boolean;
  canExportExcel: boolean;
  canCreateTicket: boolean;
  canCreatePerson: boolean;
  canCreateMarriage: boolean;
  canReadPersons: boolean;
  /** True when marriage create is allowed by count (needs ≥2 people). */
  marriageReady: boolean;
  onDownloadSample: () => void;
  onExportExcel: () => void;
  onPickFile: (file: File | null) => void;
  onTidyLayout: () => void;
  onExport: () => void;
  onAddMarriage: () => void;
  onAddPerson: () => void;
  onFitView: () => void;
  onToggleFullscreen: () => void;
  onOpenBirthday: () => void;
  onExitBranch: () => void;
  onExpandFolded: () => void;
  onCreateTicket: () => void;
};

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
 */
export function MoreMenu({
  treeId,
  busy,
  empty,
  fullscreen,
  branchActive,
  foldedCount,
  fileInputRef,
  canDownloadSample,
  canImportExcel,
  canExportExcel,
  canCreateTicket,
  canCreatePerson,
  canCreateMarriage,
  canReadPersons,
  marriageReady,
  onDownloadSample,
  onExportExcel,
  onPickFile,
  onTidyLayout,
  onExport,
  onAddMarriage,
  onAddPerson,
  onFitView,
  onToggleFullscreen,
  onOpenBirthday,
  onExitBranch,
  onExpandFolded,
  onCreateTicket,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const showData = canDownloadSample || canImportExcel || canExportExcel;
  const showCanvasState = branchActive || foldedCount > 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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
      {open ? (
        <div className={styles.menuPanel} role="menu">
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

          {/* Phones only (≤719): every chrome action that left the toolbar. */}
          <div className={styles.compactOnly}>
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
            {canReadPersons ? (
              <MenuItem disabled={busy} onClick={() => closeThen(onOpenBirthday)}>
                <HiOutlineCalendarDays aria-hidden />
                {t("birthdayCalendar")}
              </MenuItem>
            ) : null}

            <p className={styles.menuLabel}>{t("viewGroup")}</p>
            <MenuItem
              disabled={busy || empty}
              onClick={() => closeThen(onFitView)}
            >
              <HiOutlineViewfinderCircle aria-hidden />
              {t("fitView")}
            </MenuItem>
            <MenuItem disabled={busy} onClick={() => closeThen(onToggleFullscreen)}>
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
              onClick={() => closeThen(onExport)}
            >
              <HiOutlineArrowDownTray aria-hidden />
              {t("export")}
            </MenuItem>
            <hr className={styles.menuSep} />
          </div>

          {/* Tablet (720–1099): only items already tucked from the inline bar. */}
          <div className={styles.phoneOnly}>
            {canCreateMarriage ? (
              <MenuItem
                disabled={busy || !marriageReady}
                onClick={() => closeThen(onAddMarriage)}
              >
                <HiOutlineHeart aria-hidden />
                {t("addMarriage")}
              </MenuItem>
            ) : null}
            <MenuItem
              disabled={busy || empty}
              onClick={() => closeThen(onTidyLayout)}
            >
              <HiOutlineRectangleGroup aria-hidden />
              {t("tidyLayout")}
            </MenuItem>
            <MenuItem
              disabled={busy || empty}
              onClick={() => closeThen(onExport)}
            >
              <HiOutlineArrowDownTray aria-hidden />
              {t("export")}
            </MenuItem>
            <hr className={styles.menuSep} />
          </div>

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
          <Link
            role="menuitem"
            className={styles.menuItem}
            href={`/dashboard/trees/${treeId}/settings`}
            onClick={() => setOpen(false)}
          >
            <HiOutlineCog6Tooth aria-hidden />
            {t("settings")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
