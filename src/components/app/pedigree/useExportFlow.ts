"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import type { Person } from "@/lib/auth/types";
import { personDisplayName } from "@/lib/pedigree/layout";
import { downloadBlob, downloadDataUrl, buildExportBasename, sanitizeFilename } from "@/lib/pedigree/download";
import type { PedigreeGraphic } from "@/lib/pedigree/export-graphic";
import { planPages, type PagePlan } from "@/lib/pedigree/export-paginate";
import {
  DEFAULT_EXPORT_THEME,
  EXPORT_PRESETS,
  type ExportPresetId,
  type ExportTheme,
} from "@/lib/pedigree/export-theme";
import type { PedigreeCanvasHandle } from "./PedigreeCanvas";
import type { ExportSettings } from "./ExportPreviewDialog";
import type { PersonLineagePosterHandle } from "./PersonLineagePoster";

/** Screen-sized preview render; the download uses the full pixel budget. */
const EXPORT_PREVIEW_MAX_EDGE = 1400;

/** Long enough to swallow a colour-picker drag, short enough to feel immediate. */
const EXPORT_PREVIEW_DEBOUNCE_MS = 260;

async function loadExportRaster() {
  return import("@/lib/pedigree/export-raster");
}

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "png",
  paper: "a3",
  orientation: "landscape",
  fit: "actual",
};

export type ExportJob = {
  kind: "tree" | "lineage";
  person: Person | null;
};

export type ExportFlow = {
  job: ExportJob | null;
  settings: ExportSettings;
  theme: ExportTheme;
  presetId: ExportPresetId | "custom";
  plan: PagePlan | null;
  previewUrl: string | null;
  previewLoading: boolean;
  previewError: boolean;
  downloading: boolean;
  /** Basename the user chose (no extension). */
  filename: string;
  /** 0..1 while a download renders, or null when idle. */
  progress: number | null;
  pngDownscaled: boolean;
  posterRef: RefObject<PersonLineagePosterHandle | null>;
  /** Without a format the dialog reopens on whichever one was picked last. */
  openTreeExport: (format?: "png" | "pdf") => void;
  openLineageExport: (person: Person, format?: "png" | "pdf") => void;
  changeSettings: (settings: ExportSettings) => void;
  changeTheme: (theme: ExportTheme) => void;
  changePreset: (id: ExportPresetId) => void;
  changeFilename: (filename: string) => void;
  retry: () => void;
  confirm: () => Promise<void>;
  close: () => void;
};

/**
 * Drives the export dialog: the debounced preview render, the page plan, and
 * the download itself. Theme and paper choices outlive a single dialog visit,
 * so they are held here rather than inside the dialog.
 */
export function useExportFlow(input: {
  canvasApiRef: RefObject<PedigreeCanvasHandle | null>;
  treeName: string;
  /** Which part of the tree the canvas is currently showing. */
  scope: "path" | "branch" | "tree";
}): ExportFlow {
  const { canvasApiRef, treeName, scope } = input;
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const { showError, showSuccess } = useFeedback();

  const [job, setJob] = useState<ExportJob | null>(null);
  const [settings, setSettings] = useState<ExportSettings>(
    DEFAULT_EXPORT_SETTINGS,
  );
  const [theme, setTheme] = useState<ExportTheme>(DEFAULT_EXPORT_THEME);
  const [presetId, setPresetId] = useState<ExportPresetId | "custom">("classic");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  /** Graph extent from the last preview, so page counts update without a render. */
  const [graphSize, setGraphSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [pngDownscaled, setPngDownscaled] = useState(false);
  /** Reused between preview and download so photos are fetched once. */
  const graphicRef = useRef<PedigreeGraphic | null>(null);
  const posterRef = useRef<PersonLineagePosterHandle | null>(null);
  const [filename, setFilename] = useState("");

  const suggestFilename = useCallback(
    (nextJob: ExportJob) => {
      if (nextJob.kind === "lineage" && nextJob.person) {
        return buildExportBasename(
          [personDisplayName(nextJob.person), "card"],
          "person-card",
        );
      }
      return buildExportBasename(
        [(treeName || t("title")).trim(), scope],
        "pedigree",
      );
    },
    [scope, t, treeName],
  );

  const openTreeExport = useCallback(
    (format?: "png" | "pdf") => {
      graphicRef.current = null;
      setPreviewUrl(null);
      setPreviewError(false);
      setPreviewLoading(true);
      setGraphSize(null);
      setPngDownscaled(false);
      if (format) setSettings((current) => ({ ...current, format }));
      const nextJob: ExportJob = { kind: "tree", person: null };
      setFilename(suggestFilename(nextJob));
      setJob(nextJob);
    },
    [suggestFilename],
  );

  const openLineageExport = useCallback(
    (person: Person, format: "png" | "pdf" = "png") => {
      graphicRef.current = null;
      setPreviewUrl(null);
      setPreviewError(false);
      setPreviewLoading(false);
      setSettings((current) => ({ ...current, format }));
      const nextJob: ExportJob = { kind: "lineage", person };
      setFilename(suggestFilename(nextJob));
      setJob(nextJob);
    },
    [suggestFilename],
  );

  const close = useCallback(() => {
    if (downloading) return;
    graphicRef.current = null;
    setJob(null);
    setPreviewUrl(null);
    setPreviewError(false);
    setPreviewLoading(false);
    setGraphSize(null);
    setFilename("");
  }, [downloading]);

  // Rebuild the graphic whenever the palette changes; page and paper choices
  // only affect how it is sliced, so they do not invalidate it.
  //
  // The delay is a debounce for the colour pickers: dragging one fires a change
  // per pixel of travel, and each rebuild re-renders the whole tree.
  useEffect(() => {
    if (job?.kind !== "tree") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const run = async () => {
        setPreviewLoading(true);
        setPreviewError(false);
        try {
          const api = canvasApiRef.current;
          if (!api) throw new Error("no-canvas");
          const graphic = await api.buildGraphic(theme);
          if (cancelled) return;
          graphicRef.current = graphic;
          setGraphSize({ width: graphic.width, height: graphic.height });
          const { renderPedigreePng } = await loadExportRaster();
          const render = await renderPedigreePng({
            graphic,
            background: theme.background,
            locale,
            maxEdge: EXPORT_PREVIEW_MAX_EDGE,
            targetScale: 1,
          });
          if (cancelled) return;
          setPreviewUrl(render.dataUrl);
        } catch {
          if (!cancelled) {
            graphicRef.current = null;
            setPreviewUrl(null);
            setPreviewError(true);
          }
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      };
      void run();
    }, EXPORT_PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [job?.kind, theme, retryToken, locale, canvasApiRef]);

  const plan = useMemo<PagePlan | null>(() => {
    if (!graphSize) return null;
    return planPages({
      graphWidth: graphSize.width,
      graphHeight: graphSize.height,
      paper: settings.paper,
      orientation: settings.orientation,
      fit: settings.fit,
    });
  }, [graphSize, settings]);

  const confirm = async () => {
    if (!job) return;
    const raw = filename.trim();
    if (!raw) {
      showError(t("exportPreview.filenameRequired"));
      return;
    }
    const name = sanitizeFilename(raw);
    const { format } = settings;
    const isLineage = job.kind === "lineage";
    setDownloading(true);
    setProgress(0);
    try {
      if (isLineage) {
        const dataUrl = await posterRef.current?.capture();
        if (!dataUrl) throw new Error("no-poster");
        if (format === "pdf") {
          // Loaded here rather than at module scope: this path pulls in
          // `html-to-image`, which the tree view itself never needs.
          const { downloadPdfFromPng } = await import(
            "@/lib/pedigree/export-image"
          );
          await downloadPdfFromPng(dataUrl, name, theme.background);
          showSuccess(t("downloadLineagePdfSuccess"));
        } else {
          downloadDataUrl(dataUrl, name);
          showSuccess(t("downloadLineageSuccess"));
        }
      } else {
        const graphic = graphicRef.current;
        if (!graphic) throw new Error("no-graphic");
        const onProgress = (done: number, total: number) =>
          setProgress(total > 0 ? done / total : 1);

        if (format === "pdf") {
          const { renderPedigreePdf } = await loadExportRaster();
          const { blob } = await renderPedigreePdf({
            graphic,
            background: theme.background,
            locale,
            title: name,
            paper: settings.paper,
            orientation: settings.orientation,
            fit: settings.fit,
            onProgress,
          });
          downloadBlob(blob, name, "pdf");
          showSuccess(t("downloadPdfSuccess"));
        } else {
          const { renderPedigreePng } = await loadExportRaster();
          const render = await renderPedigreePng({
            graphic,
            background: theme.background,
            locale,
            onProgress,
          });
          setPngDownscaled(render.downscaled);
          downloadDataUrl(render.dataUrl, name);
          showSuccess(t("downloadImageSuccess"));
        }
      }

      graphicRef.current = null;
      setJob(null);
      setPreviewUrl(null);
      setGraphSize(null);
      setFilename("");
    } catch {
      showError(
        isLineage
          ? format === "pdf"
            ? t("downloadLineagePdfError")
            : t("downloadLineageError")
          : format === "pdf"
            ? t("downloadPdfError")
            : t("downloadImageError"),
      );
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  };

  const changeTheme = useCallback((next: ExportTheme) => {
    setTheme(next);
    setPresetId("custom");
  }, []);

  const changePreset = useCallback((id: ExportPresetId) => {
    setPresetId(id);
    setTheme(EXPORT_PRESETS[id]);
  }, []);

  const retry = useCallback(() => {
    setRetryToken((value) => value + 1);
  }, []);

  return {
    job,
    settings,
    theme,
    presetId,
    plan,
    previewUrl,
    previewLoading,
    previewError,
    downloading,
    filename,
    progress,
    pngDownscaled,
    posterRef,
    openTreeExport,
    openLineageExport,
    changeSettings: setSettings,
    changeTheme,
    changePreset,
    changeFilename: setFilename,
    retry,
    confirm,
    close,
  };
}
