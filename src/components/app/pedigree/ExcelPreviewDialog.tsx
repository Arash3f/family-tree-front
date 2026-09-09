"use client";

import { useLocale, useTranslations } from "next-intl";
import type { TreeExcelPreviewResult } from "@/lib/auth/client";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { formatDateForLocale } from "@/lib/pedigree/dates";
import { Button } from "@/components/ui/Button";
import { isImportableMarriage, isImportablePerson } from "./excel-import";
import shared from "./PedigreeView.module.css";
import styles from "./ExcelPreviewDialog.module.css";

type Props = {
  preview: TreeExcelPreviewResult;
  fileName: string;
  selectedPersonRefs: Set<string>;
  selectedMarriageRefs: Set<string>;
  selectedPersonCount: number;
  selectedMarriageCount: number;
  canConfirm: boolean;
  busy: boolean;
  onTogglePerson: (ref: string, checked: boolean) => void;
  onToggleMarriage: (ref: string, checked: boolean) => void;
  onSelectNew: () => void;
  onClearSelection: () => void;
  onConfirm: () => void;
  onClose: () => void;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A UUID in a code cell is unreadable in a table; show a stub, keep the rest
 * in the tooltip. Codes from a current export are already short. */
function shortCode(code: string): string {
  return UUID_PATTERN.test(code) ? `${code.slice(0, 8)}…` : code;
}

export function ExcelPreviewDialog({
  preview,
  fileName,
  selectedPersonRefs,
  selectedMarriageRefs,
  selectedPersonCount,
  selectedMarriageCount,
  canConfirm,
  busy,
  onTogglePerson,
  onToggleMarriage,
  onSelectNew,
  onClearSelection,
  onConfirm,
  onClose,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();

  const digits = (value: string | number) => formatLocaleDigits(value, locale);

  const code = (value: string) => (
    <span className={styles.previewCode} title={value}>
      {digits(shortCode(value))}
    </span>
  );

  /** A code cell reads as the name it points at, with the code as a subtitle. */
  const reference = (label: string | null, ref: string | null) => {
    if (!ref) return <span className={styles.previewMuted}>—</span>;
    if (!label) return code(ref);
    return (
      <span className={styles.previewRef}>
        <span>{label}</span>
        {code(ref)}
      </span>
    );
  };

  const personDate = (value: string | null) =>
    value ? digits(formatDateForLocale(value, locale)) : "—";

  const genderLabel = (gender: string) =>
    gender === "female" ? t("gender.female") : t("gender.male");

  const rowStatus = (row: {
    already_exists: boolean;
    existing_label?: string | null;
    duplicate_of_ref: string | null;
    warning?: string | null;
  }) => {
    if (row.already_exists) {
      return (
        <span className={styles.previewBadgeExisting}>
          {row.existing_label
            ? t("excelPreviewExistingAs", { label: row.existing_label })
            : t("excelPreviewExisting")}
        </span>
      );
    }
    if (row.duplicate_of_ref) {
      return (
        <span className={styles.previewBadgeDuplicate}>
          {t("excelPreviewDuplicate", { ref: shortCode(row.duplicate_of_ref) })}
        </span>
      );
    }
    if (row.warning) {
      return (
        <span className={styles.previewStatusStack}>
          <span className={styles.previewBadgeWarning}>
            {t("excelPreviewWarning")}
          </span>
          <span className={styles.previewWarningText}>{digits(row.warning)}</span>
        </span>
      );
    }
    return <span className={styles.previewBadgeNew}>{t("excelPreviewNew")}</span>;
  };

  return (
    <div
      className={styles.previewOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-preview-title"
    >
      <div className={styles.previewModal}>
        <header className={shared.panelHeader}>
          <div>
            <h2 id="excel-preview-title">{t("excelPreviewTitle")}</h2>
            <p className={shared.support}>
              {t("excelPreviewSupport", {
                file: fileName || "—",
                people: digits(preview.persons.length),
                marriages: digits(preview.marriages.length),
              })}
            </p>
          </div>
          <button
            type="button"
            className={shared.iconBtn}
            onClick={onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>

        <p className={styles.previewHint}>{t("excelPreviewHint")}</p>

        {preview.errors.length > 0 ? (
          <div className={styles.previewErrors} role="alert">
            <h3>{t("excelPreviewErrors")}</h3>
            <p className={styles.previewErrorsLead}>
              {t("excelPreviewErrorsLead", {
                count: digits(preview.errors.length),
              })}
            </p>
            <ul>
              {preview.errors.map((error) => (
                <li key={error}>{digits(error)}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.previewOk}>{t("excelPreviewReady")}</p>
        )}

        <div className={styles.previewToolbar}>
          <p className={styles.previewSelected}>
            {t("excelPreviewSelected", {
              people: digits(selectedPersonCount),
              marriages: digits(selectedMarriageCount),
            })}
          </p>
          <div className={styles.previewToolbarActions}>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onSelectNew}
            >
              {t("excelPreviewSelectNew")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onClearSelection}
            >
              {t("excelPreviewClear")}
            </Button>
          </div>
        </div>

        <section className={styles.previewSection}>
          <h3>{t("excelPreviewPersons")}</h3>
          {preview.persons.length === 0 ? (
            <p className={shared.empty}>{t("excelPreviewEmptyPersons")}</p>
          ) : (
            <div className={styles.previewTableWrap}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th className={styles.previewCheckCol}>
                      {t("excelCols.select")}
                    </th>
                    <th>{t("excelCols.row")}</th>
                    <th>{t("excelCols.name")}</th>
                    <th>{t("excelCols.gender")}</th>
                    <th>{t("excelCols.birthDate")}</th>
                    <th>{t("excelCols.parents")}</th>
                    <th>{t("excelCols.marriageRef")}</th>
                    <th>{t("excelCols.ref")}</th>
                    <th>{t("excelCols.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.persons.map((person) => {
                    const importable = isImportablePerson(person);
                    const fullName = [person.name, person.family_name]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <tr
                        key={`${person.row_number}-${person.ref}`}
                        className={
                          person.already_exists
                            ? styles.previewRowExisting
                            : person.duplicate_of_ref
                              ? styles.previewRowDuplicate
                              : person.warning
                                ? styles.previewRowWarning
                                : undefined
                        }
                      >
                        <td className={styles.previewCheckCol}>
                          <input
                            type="checkbox"
                            checked={selectedPersonRefs.has(person.ref)}
                            disabled={busy || !importable}
                            aria-label={fullName || person.ref}
                            onChange={(event) =>
                              onTogglePerson(person.ref, event.target.checked)
                            }
                          />
                        </td>
                        <td className={styles.previewMuted}>
                          {digits(person.row_number)}
                        </td>
                        <td className={styles.previewName}>{fullName}</td>
                        <td>{genderLabel(person.gender)}</td>
                        <td>{personDate(person.birth_date)}</td>
                        <td>
                          <span className={styles.previewParents}>
                            {reference(person.parent1_label, person.parent1_ref)}
                            {person.parent2_ref
                              ? reference(
                                  person.parent2_label,
                                  person.parent2_ref,
                                )
                              : null}
                          </span>
                        </td>
                        <td>
                          {reference(person.marriage_label, person.marriage_ref)}
                        </td>
                        <td className={styles.previewMuted}>
                          {code(person.ref)}
                        </td>
                        <td>{rowStatus(person)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.previewSection}>
          <h3>{t("excelPreviewMarriages")}</h3>
          {preview.marriages.length === 0 ? (
            <p className={shared.empty}>{t("excelPreviewEmptyMarriages")}</p>
          ) : (
            <div className={styles.previewTableWrap}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th className={styles.previewCheckCol}>
                      {t("excelCols.select")}
                    </th>
                    <th>{t("excelCols.row")}</th>
                    <th>{t("excelCols.spouseA")}</th>
                    <th>{t("excelCols.spouseB")}</th>
                    <th>{t("excelCols.marriedAt")}</th>
                    <th>{t("excelCols.divorcedAt")}</th>
                    <th>{t("excelCols.ref")}</th>
                    <th>{t("excelCols.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.marriages.map((marriage) => {
                    const importable = isImportableMarriage(marriage);
                    const couple = [
                      marriage.spouse_a_label,
                      marriage.spouse_b_label,
                    ]
                      .filter(Boolean)
                      .join(" × ");
                    return (
                      <tr
                        key={`${marriage.row_number}-${marriage.ref}`}
                        className={
                          marriage.already_exists
                            ? styles.previewRowExisting
                            : marriage.duplicate_of_ref
                              ? styles.previewRowDuplicate
                              : marriage.warning
                                ? styles.previewRowWarning
                                : undefined
                        }
                      >
                        <td className={styles.previewCheckCol}>
                          <input
                            type="checkbox"
                            checked={selectedMarriageRefs.has(marriage.ref)}
                            disabled={busy || !importable}
                            aria-label={couple || marriage.ref}
                            onChange={(event) =>
                              onToggleMarriage(marriage.ref, event.target.checked)
                            }
                          />
                        </td>
                        <td className={styles.previewMuted}>
                          {digits(marriage.row_number)}
                        </td>
                        <td>
                          {reference(
                            marriage.spouse_a_label,
                            marriage.spouse_a_ref,
                          )}
                        </td>
                        <td>
                          {reference(
                            marriage.spouse_b_label,
                            marriage.spouse_b_ref,
                          )}
                        </td>
                        <td>{personDate(marriage.married_at)}</td>
                        <td>{personDate(marriage.divorced_at)}</td>
                        <td className={styles.previewMuted}>
                          {code(marriage.ref)}
                        </td>
                        <td>{rowStatus(marriage)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!canConfirm && preview.valid ? (
          <p className={styles.previewNoneSelected}>
            {t("excelPreviewNoneSelected")}
          </p>
        ) : null}

        <div className={styles.previewActions}>
          <Button
            loading={busy}
            disabled={busy || !canConfirm}
            onClick={onConfirm}
          >
            {busy ? t("working") : t("excelPreviewConfirm")}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
