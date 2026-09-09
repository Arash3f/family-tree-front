"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import type { Marriage, Person } from "@/lib/auth/types";
import type { ExportFlow } from "./useExportFlow";

/** Export UI and its `html-to-image` dependency load when the dialog opens. */
const ExportPreviewDialog = dynamic(
  () =>
    import("./ExportPreviewDialog").then((mod) => ({
      default: mod.ExportPreviewDialog,
    })),
  { ssr: false },
);

const PersonLineagePoster = dynamic(
  () =>
    import("./PersonLineagePoster").then((mod) => ({
      default: mod.PersonLineagePoster,
    })),
  { ssr: false },
);

type Props = {
  /** Poster handle stays off this object so render never reads a ref. */
  flow: Omit<ExportFlow, "posterRef">;
  posterRef: ExportFlow["posterRef"];
  /** The poster draws the subject's own lineage out of the whole tree. */
  persons: Person[];
  marriages: Marriage[];
  treeName: string;
};

export function ExportDialogHost({
  flow,
  posterRef,
  persons,
  marriages,
  treeName,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const { job } = flow;
  if (!job) return null;

  return (
    <ExportPreviewDialog
      title={
        job.kind === "lineage"
          ? t("exportPreview.titleCard")
          : t("exportPreview.titleTree")
      }
      paginated={job.kind === "tree"}
      settings={flow.settings}
      plan={job.kind === "tree" ? flow.plan : null}
      locale={locale}
      progress={flow.progress}
      pngDownscaled={flow.pngDownscaled}
      theme={flow.theme}
      presetId={flow.presetId}
      preview={
        job.kind === "lineage" && job.person ? (
          <PersonLineagePoster
            ref={posterRef}
            person={job.person}
            persons={persons}
            marriages={marriages}
            treeName={treeName}
            theme={flow.theme}
          />
        ) : flow.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flow.previewUrl} alt="" decoding="async" />
        ) : null
      }
      previewLoading={flow.previewLoading}
      previewError={flow.previewError}
      downloading={flow.downloading}
      canConfirm={job.kind === "lineage" || Boolean(flow.previewUrl)}
      filename={flow.filename}
      onFilenameChange={flow.changeFilename}
      onSettingsChange={flow.changeSettings}
      onThemeChange={flow.changeTheme}
      onPresetChange={flow.changePreset}
      onRetry={flow.retry}
      onConfirm={() => void flow.confirm()}
      onClose={flow.close}
    />
  );
}
