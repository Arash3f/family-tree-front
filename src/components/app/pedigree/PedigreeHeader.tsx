"use client";

import {
  useId,
  useMemo,
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
  HiOutlineUserPlus,
  HiOutlineViewfinderCircle,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { Person } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Button } from "@/components/ui/Button";
import { HelpGuide } from "@/components/app/HelpGuide";
import { OverflowMarquee } from "@/components/ui/OverflowMarquee";
import { BirthdayCalendarButton } from "./LazyBirthdayCalendar";
import { MoreMenu } from "./MoreMenu";
import { PersonSearchResults } from "./PersonSearchResults";
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
  /** Set while a branch preview narrows the canvas. */
  branchActive: boolean;
  /** Set while the workspace covers the whole screen. */
  fullscreen: boolean;
  /** People the folded branches keep off the canvas. */
  foldedCount: number;
  onExpandFolded: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAddPerson: () => void;
  onAddMarriage: () => void;
  onTidyLayout: () => void;
  onFitView: () => void;
  onToggleFullscreen: () => void;
  onExport: () => void;
  onExitBranch: () => void;
  onDownloadSample: () => void;
  onExportExcel: () => void;
  onPickFile: (file: File | null) => void;
  onCreateTicket: () => void;
  people: Person[];
  canViewBirthDate: boolean;
  onSelectBirthdayPerson: (personId: string) => void;
};

type ToolButtonProps = {
  label: string;
  /** Longer tooltip text; the label is used when there is none. */
  hint?: string;
  /** Only for toggles — plain actions leave it off so they read as buttons. */
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
};

/**
 * Square icon button for the view controls. Labels live in the tooltip and the
 * accessible name: five spelled-out Persian actions in a row read as a
 * paragraph, and the canvas is what the eye should land on.
 */
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
  branchActive,
  fullscreen,
  foldedCount,
  onExpandFolded,
  fileInputRef,
  onAddPerson,
  onAddMarriage,
  onTidyLayout,
  onFitView,
  onToggleFullscreen,
  onExport,
  onExitBranch,
  onDownloadSample,
  onExportExcel,
  onPickFile,
  onCreateTicket,
  people,
  canViewBirthDate,
  onSelectBirthdayPerson,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const searchId = useId();
  const results = useMemo(() => searchPeople(search), [searchPeople, search]);
  const empty = personCount === 0;

  return (
    <header className={styles.chrome}>
      <div className={styles.chromeIdentity}>
        <div className={styles.identityBody}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              <OverflowMarquee title={treeName || t("title")}>
                {treeName || t("title")}
              </OverflowMarquee>
            </h1>
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
          </div>
        </div>
      </div>

      {/* Search owns its own row on phones so tools cannot crush it. */}
      <div className={styles.chromeSearch}>
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

      <div className={styles.chromeActions}>
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
            <span className={styles.toolLabel}>{t("addPerson")}</span>
          </Button>
        ) : null}

        {canCreateMarriage ? (
          <Button
            variant="ghost"
            size="sm"
            className={`${styles.toolBtn} ${styles.wideOnly}`}
            disabled={busy || personCount < 2}
            title={t("addMarriage")}
            aria-label={t("addMarriage")}
            icon={<HiOutlineHeart aria-hidden />}
            onClick={onAddMarriage}
          >
            <span className={styles.toolLabel}>{t("addMarriage")}</span>
          </Button>
        ) : null}

        {canReadPersons ? (
          <BirthdayCalendarButton
            people={people}
            canViewBirthDate={canViewBirthDate}
            onSelectPerson={onSelectBirthdayPerson}
            open={birthdayOpen}
            onOpenChange={setBirthdayOpen}
          />
        ) : null}

        <div className={styles.iconGroup} role="group" aria-label={t("viewGroup")}>
          <ToolButton
            label={t("tidyLayout")}
            hint={t("tidyLayoutHint")}
            disabled={busy || empty}
            className={styles.wideOnly}
            onClick={onTidyLayout}
          >
            <HiOutlineRectangleGroup aria-hidden />
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

        <Button
          variant="ghost"
          size="sm"
          className={`${styles.toolBtn} ${styles.wideOnly}`}
          disabled={busy || empty}
          title={t("exportHint")}
          aria-label={t("export")}
          icon={<HiOutlineArrowDownTray aria-hidden />}
          onClick={onExport}
        >
          <span className={styles.toolLabel}>{t("export")}</span>
        </Button>

        <HelpGuide focusPedigree className={styles.helpBtn} />

        <MoreMenu
          treeId={treeId}
          busy={busy}
          empty={empty}
          fullscreen={fullscreen}
          branchActive={branchActive}
          foldedCount={foldedCount}
          fileInputRef={fileInputRef}
          canDownloadSample={canDownloadSample}
          canImportExcel={canImportExcel}
          canExportExcel={canExportExcel}
          canCreateTicket={canCreateTicket}
          canCreatePerson={canCreatePerson}
          canCreateMarriage={canCreateMarriage}
          canReadPersons={canReadPersons}
          marriageReady={personCount >= 2}
          onDownloadSample={onDownloadSample}
          onExportExcel={onExportExcel}
          onPickFile={onPickFile}
          onTidyLayout={onTidyLayout}
          onExport={onExport}
          onAddMarriage={onAddMarriage}
          onAddPerson={onAddPerson}
          onFitView={onFitView}
          onToggleFullscreen={onToggleFullscreen}
          onOpenBirthday={() => setBirthdayOpen(true)}
          onExitBranch={onExitBranch}
          onExpandFolded={onExpandFolded}
          onCreateTicket={onCreateTicket}
        />
      </div>
    </header>
  );
}
