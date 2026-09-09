"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { formatLocaleDigits } from "@/lib/localeDigits";
import { Select } from "@/components/ui/Select";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import {
  PAPER_IDS,
  type FitMode,
  type Orientation,
  type PagePlan,
  type PaperId,
} from "@/lib/pedigree/export-paginate";
import {
  EXPORT_PRESET_IDS,
  EXPORT_PRESETS,
  patchExportTheme,
  type ExportPresetId,
  type ExportTheme,
} from "@/lib/pedigree/export-theme";
import styles from "./ExportPreviewDialog.module.css";

type ColorKey = "background" | "surface" | "foreground" | "accent" | "male" | "female";

const COLOR_FIELDS: { key: ColorKey; labelKey: string }[] = [
  { key: "background", labelKey: "background" },
  { key: "surface", labelKey: "surface" },
  { key: "foreground", labelKey: "text" },
  { key: "accent", labelKey: "accent" },
  { key: "male", labelKey: "male" },
  { key: "female", labelKey: "female" },
];

const FIT_MODES: FitMode[] = ["actual", "compact", "single"];
const ORIENTATIONS: Orientation[] = ["landscape", "portrait"];
const FORMATS = ["png", "pdf"] as const;

export type ExportSettings = {
  format: "png" | "pdf";
  paper: PaperId;
  orientation: Orientation;
  fit: FitMode;
};

type Props = {
  title: string;
  /** Absent for the person poster, which is always a single page. */
  paginated: boolean;
  settings: ExportSettings;
  /** Page geometry for the current settings, once the graph size is known. */
  plan: PagePlan | null;
  theme: ExportTheme;
  presetId: ExportPresetId | "custom";
  preview: ReactNode;
  previewLoading?: boolean;
  previewError?: boolean;
  downloading?: boolean;
  /** 0..1 while a download renders, or null when idle. */
  progress?: number | null;
  /** Set when a PNG had to be shrunk below true size. */
  pngDownscaled?: boolean;
  canConfirm?: boolean;
  locale: string;
  /** Basename without extension; user-editable. */
  filename: string;
  onFilenameChange: (filename: string) => void;
  onSettingsChange: (settings: ExportSettings) => void;
  onThemeChange: (theme: ExportTheme) => void;
  onPresetChange: (id: ExportPresetId) => void;
  onRetry?: () => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ExportPreviewDialog({
  title,
  paginated,
  settings,
  plan,
  theme,
  presetId,
  preview,
  previewLoading,
  previewError,
  downloading,
  progress,
  pngDownscaled,
  canConfirm = true,
  locale,
  filename,
  onFilenameChange,
  onSettingsChange,
  onThemeChange,
  onPresetChange,
  onRetry,
  onConfirm,
  onClose,
}: Props) {
  const t = useTranslations("pedigree");
  const titleId = useId();
  const filenameId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const controlsLocked = Boolean(downloading);
  const num = (value: number) => formatLocaleDigits(value, locale);
  const filenameReady = Boolean(filename.trim());

  // Escape must not abandon a render that is already writing a file.
  const onEscape = useCallback(() => {
    if (!downloading) onClose();
  }, [downloading, onClose]);

  useFocusTrap(modalRef, true, onEscape);
  useScrollLock(true);

  const patch = (next: Partial<ExportSettings>) =>
    onSettingsChange({ ...settings, ...next });

  const showPageOptions = paginated && settings.format === "pdf";

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (!downloading) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId}>{title}</h2>
            <p className={styles.hint}>{t("exportPreview.hint")}</p>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            disabled={downloading}
            aria-label={t("cancel")}
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

        <div className={styles.body}>
          <div className={styles.previewPane} style={{ background: theme.background }}>
            {previewError && !previewLoading ? (
              <div className={styles.previewStatus} role="alert">
                <p>{t("exportPreview.error")}</p>
                {onRetry ? (
                  <button type="button" className={styles.ghostBtn} onClick={onRetry}>
                    {t("exportPreview.retry")}
                  </button>
                ) : null}
              </div>
            ) : (
              preview
            )}
            {previewLoading ? (
              <div className={styles.busyMask}>
                <span className={styles.spinner} aria-hidden />
                <p>{t("exportPreview.loading")}</p>
              </div>
            ) : null}
            {downloading ? (
              <div className={styles.busyMask}>
                <span className={styles.spinner} aria-hidden />
                <p aria-live="polite">
                  {progress != null && plan && plan.pageCount > 1
                    ? t("exportPreview.workingPages", {
                        done: num(Math.round(progress * plan.pageCount)),
                        total: num(plan.pageCount),
                      })
                    : t("exportPreview.working")}
                </p>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((progress ?? 0) * 100)}
                >
                  <span
                    className={styles.progressFill}
                    style={{ inlineSize: `${Math.round((progress ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <aside className={styles.options}>
            <fieldset className={styles.fieldset}>
              <legend>{t("exportPreview.filename")}</legend>
              <label className={styles.filenameField} htmlFor={filenameId}>
                <span className={styles.filenameHint}>
                  {t("exportPreview.filenameHint")}
                </span>
                <div className={styles.filenameRow}>
                  <input
                    id={filenameId}
                    type="text"
                    className={styles.filenameInput}
                    value={filename}
                    disabled={controlsLocked}
                    maxLength={80}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => onFilenameChange(event.target.value)}
                  />
                  <span className={styles.filenameExt} aria-hidden>
                    .{settings.format}
                  </span>
                </div>
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>{t("exportPreview.format")}</legend>
              <div className={styles.fitList}>
                {FORMATS.map((format) => (
                  <label key={format} className={styles.radioRow}>
                    <input
                      type="radio"
                      name="export-format"
                      value={format}
                      checked={settings.format === format}
                      disabled={controlsLocked}
                      onChange={() => patch({ format })}
                    />
                    <span>
                      <strong>{t(`exportPreview.${format}`)}</strong>
                      <em>{t(`exportPreview.formatHint.${format}`)}</em>
                    </span>
                  </label>
                ))}
              </div>
              {settings.format === "png" && pngDownscaled ? (
                <p className={styles.warning}>{t("exportPreview.pngDownscaled")}</p>
              ) : null}
            </fieldset>

            {showPageOptions ? (
              <>
                <fieldset className={styles.fieldset}>
                  <legend>{t("exportPreview.paper")}</legend>
                  <div className={styles.paperRow}>
                    <Select
                      className={styles.select}
                      options={PAPER_IDS.map((paper) => ({
                        value: paper,
                        label: t(`exportPreview.paperName.${paper}`),
                        text: t(`exportPreview.paperName.${paper}`),
                      }))}
                      value={settings.paper}
                      disabled={controlsLocked}
                      aria-label={t("exportPreview.paper")}
                      onChange={(event) =>
                        patch({ paper: event.target.value as PaperId })
                      }
                    />
                    <div className={styles.segment}>
                      {ORIENTATIONS.map((orientation) => (
                        <button
                          key={orientation}
                          type="button"
                          className={
                            settings.orientation === orientation
                              ? styles.segmentActive
                              : ""
                          }
                          aria-pressed={settings.orientation === orientation}
                          disabled={controlsLocked}
                          onClick={() => patch({ orientation })}
                        >
                          {t(`exportPreview.orientation.${orientation}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>

                <fieldset className={styles.fieldset}>
                  <legend>{t("exportPreview.fit")}</legend>
                  <div className={styles.fitList}>
                    {FIT_MODES.map((fit) => (
                      <label key={fit} className={styles.radioRow}>
                        <input
                          type="radio"
                          name="export-fit"
                          value={fit}
                          checked={settings.fit === fit}
                          disabled={controlsLocked}
                          onChange={() => patch({ fit })}
                        />
                        <span>
                          <strong>{t(`exportPreview.fitMode.${fit}`)}</strong>
                          <em>{t(`exportPreview.fitHint.${fit}`)}</em>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {plan ? (
                  <div className={styles.planCard}>
                    <dl className={styles.planStats}>
                      <div>
                        <dt>{t("exportPreview.pages")}</dt>
                        <dd className={styles.planPages}>{num(plan.pageCount)}</dd>
                      </div>
                      <div>
                        <dt>{t("exportPreview.grid")}</dt>
                        <dd>
                          {num(plan.columns)}×{num(plan.rows)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("exportPreview.zoom")}</dt>
                        <dd>{num(Math.round(plan.scale * 100))}٪</dd>
                      </div>
                    </dl>
                    {plan.belowLegible ? (
                      <p className={styles.warning}>
                        {t("exportPreview.belowLegible")}
                      </p>
                    ) : plan.clampedByLegibility ? (
                      <p className={styles.note}>
                        {t("exportPreview.clampedByLegibility")}
                      </p>
                    ) : (
                      <p className={styles.note}>
                        {t("exportPreview.assemblyHint")}
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            <fieldset className={styles.fieldset}>
              <legend>{t("exportPreview.presets")}</legend>
              <div className={styles.presets}>
                {EXPORT_PRESET_IDS.map((id) => {
                  const preset = EXPORT_PRESETS[id];
                  const active = presetId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.preset} ${active ? styles.presetActive : ""}`}
                      aria-pressed={active}
                      disabled={controlsLocked}
                      onClick={() => onPresetChange(id)}
                    >
                      <span
                        className={styles.swatch}
                        style={{
                          background: `linear-gradient(135deg, ${preset.accent}, ${preset.male} 55%, ${preset.female})`,
                        }}
                        aria-hidden
                      />
                      {t(`exportPreview.preset.${id}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>{t("exportPreview.colors")}</legend>
              <div className={styles.colors}>
                {COLOR_FIELDS.map((field) => (
                  <label key={field.key} className={styles.colorField}>
                    <span>{t(`exportPreview.${field.labelKey}`)}</span>
                    <input
                      type="color"
                      value={theme[field.key]}
                      disabled={controlsLocked}
                      onChange={(event) =>
                        onThemeChange(
                          patchExportTheme(theme, field.key, event.target.value),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </aside>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={
              downloading ||
              previewLoading ||
              previewError ||
              !canConfirm ||
              !filenameReady
            }
            onClick={onConfirm}
          >
            {downloading
              ? t("exportPreview.working")
              : showPageOptions && plan && plan.pageCount > 1
                ? t("exportPreview.downloadPages", { count: num(plan.pageCount) })
                : t("exportPreview.download")}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={downloading}
            onClick={onClose}
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
