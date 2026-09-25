"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineArrowDownTray,
  HiOutlineArrowUturnLeft,
  HiOutlineArrowsPointingIn,
  HiOutlineArrowsPointingOut,
  HiOutlineEyeSlash,
  HiOutlineHeart,
  HiOutlineMagnifyingGlass,
  HiOutlineRectangleGroup,
  HiOutlineRectangleStack,
  HiOutlineSquares2X2,
  HiOutlineUserPlus,
  HiOutlineViewfinderCircle,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { Person } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Button } from "@/components/ui/Button";
import { HelpGuide } from "@/components/app/HelpGuide";
import { OverflowMarquee } from "@/components/ui/OverflowMarquee";
import { MoreMenu } from "./MoreMenu";
import { PersonSearchResults } from "./PersonSearchResults";
import { useChromePlan } from "./useChromePlan";
import styles from "./PedigreeView.module.css";

type Props = {
  treeId: string;
  treeName: string;
  personCount: number;
  marriageCount: number;
  busy: boolean;
  searchPeople: (query: string) => Person[];
  hint: (person: Person) => string | null;
  onPickSearchResult: (person: Person) => void;
  canReadPersons: boolean;
  canCreatePerson: boolean;
  canCreateMarriage: boolean;
  canDownloadSample: boolean;
  canImportExcel: boolean;
  canExportExcel: boolean;
  canCreateTicket: boolean;
  canAccessSettings: boolean;
  branchActive: boolean;
  fullscreen: boolean;
  foldedCount: number;
  onExpandFolded: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAddPerson: () => void;
  onAddMarriage: () => void;
  onTidyLayout: () => void;
  layoutDensity: "layered" | "compact";
  onToggleLayoutDensity: () => void;
  onFitView: () => void;
  onToggleFullscreen: () => void;
  onExport: () => void;
  onExitBranch: () => void;
  onDownloadSample: () => void;
  onExportExcel: () => void;
  onPickFile: (file: File | null) => void;
  onCreateTicket: () => void;
};

type ToolButtonProps = {
  label: string;
  hint?: string;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
};

function ToolButton({
  label,
  hint,
  pressed,
  disabled,
  className,
  onClick,
  children,
}: ToolButtonProps) {
  const classes = [styles.iconTool, pressed ? styles.iconToolActive : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      title={hint ?? label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PedigreeHeader({
  treeId,
  treeName,
  personCount,
  marriageCount,
  busy,
  searchPeople,
  hint,
  onPickSearchResult,
  canReadPersons,
  canCreatePerson,
  canCreateMarriage,
  canDownloadSample,
  canImportExcel,
  canExportExcel,
  canCreateTicket,
  canAccessSettings,
  branchActive,
  fullscreen,
  foldedCount,
  onExpandFolded,
  fileInputRef,
  onAddPerson,
  onAddMarriage,
  onTidyLayout,
  layoutDensity,
  onToggleLayoutDensity,
  onFitView,
  onToggleFullscreen,
  onExport,
  onExitBranch,
  onDownloadSample,
  onExportExcel,
  onPickFile,
  onCreateTicket,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const chromeRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const plan = useChromePlan(chromeRef, actionsRef, searchRef);
  const searchId = useId();
  const results = useMemo(() => searchPeople(search), [searchPeople, search]);
  const empty = personCount === 0;

  const inlineTools = plan.tools !== "menu";
  const labeled = plan.tools === "labeled";
  // Person / marriage / calendar / export sit opposite the view strip.
  // Only fold into MoreMenu when immersive stack hides the identity column.
  const primaryOnIdentity = !(fullscreen && plan.layout === "stack");

  return (
    <header
      ref={chromeRef}
      className={styles.chrome}
      data-layout={plan.layout}
      data-tools={plan.tools}
    >
      <div className={styles.chromeIdentity}>
        <div className={styles.identityBody}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              <OverflowMarquee
                className={styles.titleName}
                title={treeName || t("title")}
              >
                {treeName || t("title")}
              </OverflowMarquee>
            </h1>
            {labeled ? (
              <div
                className={styles.statRow}
                aria-label={t("support", {
                  people: formatLocaleDigits(personCount, locale),
                  marriages: formatLocaleDigits(marriageCount, locale),
                })}
              >
                <span className={styles.stat}>
                  {t("statPeople", {
                    count: formatLocaleDigits(personCount, locale),
                  })}
                </span>
                <span className={styles.stat}>
                  {t("statMarriages", {
                    count: formatLocaleDigits(marriageCount, locale),
                  })}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        {primaryOnIdentity ? (
          <div className={styles.chromePrimary} role="group" aria-label={t("composeGroup")}>
            {canCreatePerson ? (
              <Button
                size="sm"
                className={styles.toolBtn}
                disabled={busy}
                title={t("addPerson")}
                aria-label={t("addPerson")}
                icon={<HiOutlineUserPlus aria-hidden />}
                onClick={onAddPerson}
              >
                {labeled ? <span className={styles.toolLabel}>{t("addPerson")}</span> : null}
              </Button>
            ) : null}
            {canCreateMarriage ? (
              <Button
                variant="ghost"
                size="sm"
                className={styles.toolBtn}
                disabled={busy || personCount < 2}
                title={t("addMarriage")}
                aria-label={t("addMarriage")}
                icon={<HiOutlineHeart aria-hidden />}
                onClick={onAddMarriage}
              >
                {labeled ? (
                  <span className={styles.toolLabel}>{t("addMarriage")}</span>
                ) : null}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className={styles.toolBtn}
              disabled={busy || empty}
              title={t("exportHint")}
              aria-label={t("export")}
              icon={<HiOutlineArrowDownTray aria-hidden />}
              onClick={onExport}
            >
              {labeled ? <span className={styles.toolLabel}>{t("export")}</span> : null}
            </Button>
          </div>
        ) : null}
      </div>

      <div ref={searchRef} className={styles.chromeSearch}>
        <div className={styles.searchField}>
          <label className={styles.srOnly} htmlFor={searchId}>
            {t("searchPlaceholder")}
          </label>
          <HiOutlineMagnifyingGlass className={styles.searchIcon} aria-hidden />
          <input
            id={searchId}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={(event) => {
              event.currentTarget.scrollIntoView({
                block: "nearest",
                inline: "nearest",
              });
            }}
            placeholder={t("searchPlaceholder")}
            disabled={!canReadPersons}
            autoComplete="off"
            enterKeyHint="search"
          />
          {search ? (
            <button
              type="button"
              className={styles.searchClear}
              aria-label={t("searchClear")}
              onClick={() => setSearch("")}
            >
              <HiOutlineXMark aria-hidden />
            </button>
          ) : null}
        </div>
        <PersonSearchResults
          people={results}
          hint={hint}
          onPick={(person) => {
            onPickSearchResult(person);
            setSearch("");
          }}
        />
        {branchActive || foldedCount > 0 ? (
          <div className={styles.chipRow}>
            {branchActive ? (
              <button
                type="button"
                className={styles.chip}
                disabled={busy}
                onClick={onExitBranch}
              >
                <HiOutlineArrowUturnLeft aria-hidden />
                {t("branchPreviewExit")}
              </button>
            ) : null}
            {foldedCount > 0 ? (
              <button
                type="button"
                className={styles.chip}
                disabled={busy}
                title={t("branchesFoldedHint")}
                onClick={onExpandFolded}
              >
                <HiOutlineEyeSlash aria-hidden />
                {t("branchesFolded", {
                  count: formatLocaleDigits(foldedCount, locale),
                })}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div ref={actionsRef} className={styles.chromeActions}>
        {inlineTools ? (
          <div className={styles.iconGroup} role="group" aria-label={t("viewGroup")}>
            {labeled ? (
              <ToolButton
                label={t("tidyLayout")}
                hint={t("tidyLayoutHint")}
                disabled={busy || empty}
                onClick={onTidyLayout}
              >
                <HiOutlineRectangleGroup aria-hidden />
              </ToolButton>
            ) : null}
            <ToolButton
              label={
                layoutDensity === "compact"
                  ? t("layoutDensityLayered")
                  : t("layoutDensityCompact")
              }
              hint={
                layoutDensity === "compact"
                  ? t("layoutDensityLayeredHint")
                  : t("layoutDensityCompactHint")
              }
              pressed={layoutDensity === "compact"}
              disabled={busy || empty}
              onClick={onToggleLayoutDensity}
            >
              {layoutDensity === "compact" ? (
                <HiOutlineSquares2X2 aria-hidden />
              ) : (
                <HiOutlineRectangleStack aria-hidden />
              )}
            </ToolButton>
            <ToolButton
              label={t("fitView")}
              disabled={busy || empty}
              onClick={onFitView}
            >
              <HiOutlineViewfinderCircle aria-hidden />
            </ToolButton>
            <ToolButton
              label={fullscreen ? t("fullscreenExit") : t("fullscreen")}
              hint={t("fullscreenHint")}
              pressed={fullscreen}
              className={styles.fullscreenBtn}
              onClick={onToggleFullscreen}
            >
              {fullscreen ? (
                <HiOutlineArrowsPointingIn aria-hidden />
              ) : (
                <HiOutlineArrowsPointingOut aria-hidden />
              )}
            </ToolButton>
          </div>
        ) : null}

        {inlineTools ? (
          <div className={styles.guideGroup}>
            <HelpGuide focusPedigree className={styles.helpBtn} />
          </div>
        ) : null}

        <MoreMenu
          treeId={treeId}
          busy={busy}
          empty={empty}
          fullscreen={fullscreen}
          branchActive={branchActive}
          foldedCount={foldedCount}
          tools={plan.tools}
          foldPrimary={!primaryOnIdentity}
          fileInputRef={fileInputRef}
          canDownloadSample={canDownloadSample}
          canImportExcel={canImportExcel}
          canExportExcel={canExportExcel}
          canCreateTicket={canCreateTicket}
          canAccessSettings={canAccessSettings}
          canCreatePerson={canCreatePerson}
          canCreateMarriage={canCreateMarriage}
          marriageReady={personCount >= 2}
          layoutDensity={layoutDensity}
          onDownloadSample={onDownloadSample}
          onExportExcel={onExportExcel}
          onPickFile={onPickFile}
          onTidyLayout={onTidyLayout}
          onToggleLayoutDensity={onToggleLayoutDensity}
          onExport={onExport}
          onAddMarriage={onAddMarriage}
          onAddPerson={onAddPerson}
          onFitView={onFitView}
          onToggleFullscreen={onToggleFullscreen}
          onExitBranch={onExitBranch}
          onExpandFolded={onExpandFolded}
          onCreateTicket={onCreateTicket}
        />
      </div>
    </header>
  );
}
