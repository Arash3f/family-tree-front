"use client";

import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  downloadTreeExcelSample,
  exportTreeExcel,
  importTreeExcel,
  previewTreeExcel,
  type TreeExcelPreviewResult,
} from "@/lib/auth/client";
import { getApiErrorMessage } from "@/lib/auth/types";
import { useFreeAccountNotice } from "@/lib/auth/useFreeAccountNotice";
import { formatLocaleDigits } from "@/lib/localeDigits";
import {
  collectPersonImportGraph,
  defaultExcelSelection,
  isImportableMarriage,
  isImportablePerson,
} from "./excel-import";

export type ExcelTransfer = {
  /** Attached to the hidden file input the Data menu renders. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  preview: TreeExcelPreviewResult | null;
  previewName: string;
  selectedPersonRefs: Set<string>;
  selectedMarriageRefs: Set<string>;
  selectedPersonCount: number;
  selectedMarriageCount: number;
  canConfirm: boolean;
  downloadSample: () => Promise<void>;
  exportExcel: () => Promise<void>;
  openPreview: (file: File | null) => Promise<void>;
  confirmImport: () => Promise<void>;
  closePreview: () => void;
  togglePerson: (ref: string, checked: boolean) => void;
  toggleMarriage: (ref: string, checked: boolean) => void;
  selectNewRows: () => void;
  clearSelection: () => void;
};

/**
 * The whole spreadsheet round-trip: sample download, export, and the
 * preview-then-confirm import. The picked file is held in a ref because the
 * confirm step re-uploads the same bytes the preview was built from.
 */
export function useExcelTransfer(
  treeId: string,
  treeName: string,
  setBusy: (busy: boolean) => void,
  reload: () => Promise<void>,
): ExcelTransfer {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const { showError, showSuccess } = useFeedback();
  const { handleMaybeFreeLimit } = useFreeAccountNotice();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickedFileRef = useRef<File | null>(null);
  const [preview, setPreview] = useState<TreeExcelPreviewResult | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [selectedPersonRefs, setSelectedPersonRefs] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedMarriageRefs, setSelectedMarriageRefs] = useState<Set<string>>(
    () => new Set(),
  );

  const downloadSample = useCallback(async () => {
    setBusy(true);
    try {
      await downloadTreeExcelSample(treeId, treeName);
      showSuccess(t("excelSampleSuccess"));
    } catch (err) {
      showError(getApiErrorMessage(err, t("excelSampleError")));
    } finally {
      setBusy(false);
    }
  }, [treeId, treeName, setBusy, showError, showSuccess, t]);

  const exportExcel = useCallback(async () => {
    setBusy(true);
    try {
      await exportTreeExcel(treeId, treeName);
      showSuccess(t("excelExportSuccess"));
    } catch (err) {
      showError(getApiErrorMessage(err, t("excelExportError")));
    } finally {
      setBusy(false);
    }
  }, [treeId, treeName, setBusy, showError, showSuccess, t]);

  const closePreview = useCallback(() => {
    pickedFileRef.current = null;
    setPreview(null);
    setPreviewName("");
    setSelectedPersonRefs(new Set());
    setSelectedMarriageRefs(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const openPreview = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setBusy(true);
      try {
        const result = await previewTreeExcel(treeId, file);
        pickedFileRef.current = file;
        setPreviewName(file.name);
        setPreview(result);
        const selection = defaultExcelSelection(result);
        setSelectedPersonRefs(selection.persons);
        setSelectedMarriageRefs(selection.marriages);
      } catch (err) {
        showError(getApiErrorMessage(err, t("excelImportError")));
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        setBusy(false);
      }
    },
    [treeId, setBusy, showError, t],
  );

  const confirmImport = useCallback(async () => {
    const file = pickedFileRef.current;
    if (!file || !preview?.valid) return;
    const personRefs = [...selectedPersonRefs].filter((ref) => {
      const person = preview.persons.find((item) => item.ref === ref);
      return person ? isImportablePerson(person) : false;
    });
    const marriageRefs = [...selectedMarriageRefs].filter((ref) => {
      const marriage = preview.marriages.find((item) => item.ref === ref);
      return marriage ? isImportableMarriage(marriage) : false;
    });
    if (personRefs.length === 0 && marriageRefs.length === 0) return;
    setBusy(true);
    try {
      const result = await importTreeExcel(treeId, file, {
        person_refs: personRefs,
        marriage_refs: marriageRefs,
      });
      showSuccess(
        t("excelImportSuccess", {
          people: formatLocaleDigits(result.persons_created, locale),
          marriages: formatLocaleDigits(result.marriages_created, locale),
        }),
      );
      closePreview();
      await reload();
    } catch (err) {
      await handleMaybeFreeLimit(
        err,
        getApiErrorMessage(err, t("excelImportError")),
      );
    } finally {
      setBusy(false);
    }
  }, [
    treeId,
    preview,
    selectedPersonRefs,
    selectedMarriageRefs,
    setBusy,
    handleMaybeFreeLimit,
    showSuccess,
    t,
    locale,
    closePreview,
    reload,
  ]);

  const togglePerson = useCallback(
    (ref: string, checked: boolean) => {
      if (!preview) return;
      if (!checked) {
        setSelectedPersonRefs((current) => {
          const next = new Set(current);
          next.delete(ref);
          return next;
        });
        return;
      }
      const extra = collectPersonImportGraph(ref, preview);
      setSelectedPersonRefs((current) => new Set([...current, ...extra.people]));
      setSelectedMarriageRefs(
        (current) => new Set([...current, ...extra.marriages]),
      );
    },
    [preview],
  );

  const toggleMarriage = useCallback(
    (ref: string, checked: boolean) => {
      if (!preview) return;
      const marriage = preview.marriages.find((item) => item.ref === ref);
      if (!marriage || !isImportableMarriage(marriage)) return;
      setSelectedMarriageRefs((current) => {
        const next = new Set(current);
        if (checked) next.add(ref);
        else next.delete(ref);
        return next;
      });
      if (checked) {
        const spouseA = collectPersonImportGraph(marriage.spouse_a_ref, preview);
        const spouseB = collectPersonImportGraph(marriage.spouse_b_ref, preview);
        setSelectedPersonRefs(
          (current) => new Set([...current, ...spouseA.people, ...spouseB.people]),
        );
        setSelectedMarriageRefs(
          (current) =>
            new Set([...current, ref, ...spouseA.marriages, ...spouseB.marriages]),
        );
      }
    },
    [preview],
  );

  const selectNewRows = useCallback(() => {
    if (!preview) return;
    const selection = defaultExcelSelection(preview);
    setSelectedPersonRefs(selection.persons);
    setSelectedMarriageRefs(selection.marriages);
  }, [preview]);

  const clearSelection = useCallback(() => {
    setSelectedPersonRefs(new Set());
    setSelectedMarriageRefs(new Set());
  }, []);

  const selectedPersonCount = useMemo(
    () =>
      preview
        ? preview.persons.filter(
            (person) =>
              selectedPersonRefs.has(person.ref) && isImportablePerson(person),
          ).length
        : 0,
    [preview, selectedPersonRefs],
  );

  const selectedMarriageCount = useMemo(
    () =>
      preview
        ? preview.marriages.filter(
            (marriage) =>
              selectedMarriageRefs.has(marriage.ref) &&
              isImportableMarriage(marriage),
          ).length
        : 0,
    [preview, selectedMarriageRefs],
  );

  return {
    fileInputRef,
    preview,
    previewName,
    selectedPersonRefs,
    selectedMarriageRefs,
    selectedPersonCount,
    selectedMarriageCount,
    canConfirm:
      Boolean(preview?.valid) &&
      (selectedPersonCount > 0 || selectedMarriageCount > 0),
    downloadSample,
    exportExcel,
    openPreview,
    confirmImport,
    closePreview,
    togglePerson,
    toggleMarriage,
    selectNewRows,
    clearSelection,
  };
}
