"use client";

import { useMemo, useState } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { FiCalendar } from "react-icons/fi";
import { useTranslations } from "next-intl";

import { parseIsoDate } from "@/lib/pedigree/dates";
import { toLatinDigits } from "@/lib/localeDigits";
import styles from "./DateField.module.css";

import "react-multi-date-picker/styles/layouts/prime.css";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  placeholder?: string;
  id?: string;
};

type ChangeMeta = {
  isTyping?: boolean;
  input?: { value?: string } | null;
};

function parseApiValue(value: string, isFa: boolean): DateObject | undefined {
  const iso = parseIsoDate(value.trim());
  if (!iso) return undefined;
  const date = new DateObject({
    calendar: gregorian,
    year: iso.year,
    month: iso.month,
    day: iso.day,
  });
  if (isFa) date.convert(persian);
  return date;
}

function numericPart(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (value && typeof value === "object" && "number" in value) {
    return numericPart((value as { number: unknown }).number);
  }
  const parsed = Number(toLatinDigits(String(value ?? "").trim()));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
}

function formatApiValue(date: DateObject): string {
  if (date.isValid === false) return "";
  const copy = new DateObject(date);
  const calendarName =
    typeof copy.calendar === "object" && copy.calendar && "name" in copy.calendar
      ? String((copy.calendar as { name?: string }).name)
      : "";
  if (calendarName !== "gregorian") {
    copy.convert(gregorian);
  }
  copy.setLocale(gregorian_en);
  const year = numericPart(copy.year);
  const month = numericPart(copy.month);
  const day = numericPart(copy.day);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return parseIsoDate(iso) ? iso : "";
}

/** True when the typed string looks like a finished date, not a mid-keystroke. */
function looksComplete(raw: string, isFa: boolean): boolean {
  const text = toLatinDigits(raw.trim());
  if (!text) return false;
  if (isFa) return /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text);
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(text);
}

function hasUnexpectedChars(raw: string, isFa: boolean): boolean {
  const text = toLatinDigits(raw.trim());
  if (!text) return false;
  if (isFa) return /[^\d\/]/.test(text);
  return /[^\d\-]/.test(text);
}

function firstSelected(
  selected: DateObject | DateObject[] | null | undefined,
): DateObject | null {
  if (!selected) return null;
  const picked = Array.isArray(selected) ? selected[0] : selected;
  return picked ?? null;
}

export function DateField({
  value,
  onChange,
  locale,
  disabled = false,
  required = false,
  clearable = false,
  placeholder,
  id,
}: DateFieldProps) {
  const t = useTranslations("pedigree");
  const isFa = locale === "fa";
  const calendar = isFa ? persian : gregorian;
  const pickerLocale = isFa ? persian_fa : gregorian_en;
  const format = isFa ? "YYYY/MM/DD" : "YYYY-MM-DD";
  const [error, setError] = useState<string | null>(null);

  const pickerValue = useMemo(
    () => parseApiValue(value, isFa),
    [value, isFa],
  );

  const invalidMessage = t("dateInvalid", {
    example: placeholder || t("dateHint"),
  });

  // Drop a stale error once the parent commits a valid ISO again (calendar pick
  // or a corrected type-in that already propagated).
  const shownError =
    value && parseIsoDate(value) ? null : error;

  const commit = (selected: DateObject | DateObject[] | null | undefined) => {
    const picked = firstSelected(selected);
    if (!picked) {
      setError(null);
      onChange("");
      return;
    }
    const iso = formatApiValue(picked);
    if (!iso) {
      setError(invalidMessage);
      return;
    }
    setError(null);
    onChange(iso);
  };

  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <DatePicker
          id={id}
          value={pickerValue}
          onChange={(selected, meta) => {
            const { isTyping, input } = (meta ?? {}) as ChangeMeta;

            if (!isTyping) {
              commit(selected);
              return;
            }

            const raw = String(input?.value ?? "").trim();
            if (!raw) {
              setError(null);
              onChange("");
              return;
            }

            if (hasUnexpectedChars(raw, isFa)) {
              setError(invalidMessage);
              return false;
            }

            // Let the user finish typing 1379/0… without yelling yet.
            if (!looksComplete(raw, isFa)) {
              setError(null);
              return;
            }

            const picked = firstSelected(selected);
            const iso = picked ? formatApiValue(picked) : "";
            if (!iso) {
              setError(invalidMessage);
              return false;
            }

            setError(null);
            onChange(iso);
          }}
          calendar={calendar}
          locale={pickerLocale}
          format={format}
          calendarPosition="bottom-start"
          arrow={false}
          editable
          disabled={disabled}
          required={required}
          digits={isFa ? PERSIAN_DIGITS : undefined}
          containerClassName={styles.container}
          inputClass={[styles.input, shownError ? styles.inputInvalid : null]
            .filter(Boolean)
            .join(" ")}
          placeholder={placeholder}
          className={`${styles.picker} rmdp-prime`}
          portal
          fixMainPosition
          zIndex={3000}
        />
        <span className={styles.icon} aria-hidden>
          <FiCalendar />
        </span>
        {clearable && value && !disabled ? (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              setError(null);
              onChange("");
            }}
            aria-label={t("dateClear")}
          >
            ×
          </button>
        ) : null}
      </div>
      {shownError ? (
        <span className={styles.error} role="alert">
          {shownError}
        </span>
      ) : null}
    </div>
  );
}
