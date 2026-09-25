"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { Button } from "@/components/ui/Button";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import type { Person } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import {
  buildExportBasename,
  downloadBlob,
  sanitizeFilename,
} from "@/lib/pedigree/download";
import {
  buildMaleLineTree,
  maleLinePersonCount,
} from "@/lib/pedigree/male-line";
import { layoutMaleLine } from "@/lib/pedigree/male-line-layout";
import { personDisplayName } from "@/lib/pedigree/layout";
import { MaleLineChart } from "./MaleLineChart";
import styles from "./MaleLineExportDialog.module.css";

type Props = {
  person: Person;
  persons: Person[];
  treeName: string;
  onClose: () => void;
};

const PAPER = "#f7f4ef";
const INK = "#1c1917";
const RAIL = "#a8a29e";

export function MaleLineExportDialog({
  person,
  persons,
  treeName,
  onClose,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const { showSuccess } = useFeedback();
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const [filename, setFilename] = useState(() =>
    buildExportBasename(
      [personDisplayName(person), t("maleLine.fileSuffix"), treeName],
      "male-line",
    ),
  );

  const tree = useMemo(
    () => buildMaleLineTree(person.id, persons),
    [person.id, persons],
  );
  const graphic = useMemo(
    () => (tree ? layoutMaleLine(tree) : null),
    [tree],
  );
  const count = tree ? maleLinePersonCount(tree) : 0;

  const onEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap(modalRef, true, onEscape);
  useScrollLock(true);

  const downloadSvg = () => {
    if (!graphic) return;
    const name = sanitizeFilename(filename.trim() || "male-line");
    if (!filename.trim()) return;
    const rtl = locale === "fa";
    const edges = graphic.edges
      .map(
        (edge) =>
          `<polyline points="${edge.points}" fill="none" stroke="${RAIL}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>`,
      )
      .join("");
    const labels = graphic.boxes
      .map((box) => {
        const x = box.x + box.w / 2;
        const y = box.y + box.h / 2;
        const text = box.label
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
        return `<g><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${PAPER}" stroke="${INK}" stroke-width="1" rx="1.5"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" direction="${rtl ? "rtl" : "ltr"}" fill="${INK}" font-size="12.5" font-weight="600" font-family="Vazirmatn, Tahoma, sans-serif">${text}</text></g>`;
      })
      .join("");
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${graphic.width}" height="${graphic.height}" viewBox="0 0 ${graphic.width} ${graphic.height}" style="background:${PAPER}">${edges}${labels}</svg>`;
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      name,
      "svg",
    );
    showSuccess(t("maleLine.downloadSuccess"));
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={onEscape}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>{t("maleLine.title")}</h2>
            <p className={styles.hint}>
              {t("maleLine.hint", {
                name: personDisplayName(person),
                count: formatLocaleDigits(count, locale),
              })}
            </p>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onEscape}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>

        <div className={styles.preview}>
          {graphic ? (
            <div className={styles.chartHost}>
              <MaleLineChart
                graphic={graphic}
                ink={INK}
                rail={RAIL}
                paper={PAPER}
                rtl={locale === "fa"}
              />
            </div>
          ) : (
            <p className={styles.empty}>{t("maleLine.empty")}</p>
          )}
        </div>

        <div className={styles.footer}>
          <label className={styles.filename}>
            <span>{t("exportPreview.filename")}</span>
            <input
              type="text"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className={styles.actions}>
            <Button
              size="sm"
              disabled={!graphic || !filename.trim()}
              onClick={downloadSvg}
            >
              {t("maleLine.downloadSvg")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
