/** API dates are always Gregorian ISO `YYYY-MM-DD`. */

import { toLatinDigits } from "@/lib/localeDigits";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;
const JALALI_DATE_RE = /^(\d{3,4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/;

export type DateParts = { year: number; month: number; day: number };

function partsFromMatch(
  match: RegExpMatchArray,
): DateParts | null {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function parseIsoDate(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = toLatinDigits(value.trim()).match(ISO_DATE_RE);
  if (!match) return null;
  return partsFromMatch(match);
}

export function parseJalaliDate(
  value: string | null | undefined,
): DateParts | null {
  if (!value) return null;
  const match = toLatinDigits(value.trim()).match(JALALI_DATE_RE);
  if (!match) return null;
  return partsFromMatch(match);
}

export function parseJalaliYear(value: string | null | undefined): number | null {
  return parseJalaliDate(value)?.year ?? null;
}

/** Gregorian calendar date to Jalali. */
export function gregorianToJalali(date = new Date()): DateParts {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const gDayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gDayCount[gm - 1]!;
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

function yearsBetween(from: DateParts, until: DateParts): number {
  let age = until.year - from.year;
  if (
    until.month < from.month ||
    (until.month === from.month && until.day < from.day)
  ) {
    age -= 1;
  }
  return age < 0 ? 0 : age;
}

export function formatJalaliDate(value: DateParts): string {
  const month = String(value.month).padStart(2, "0");
  const day = String(value.day).padStart(2, "0");
  return `${value.year}/${month}/${day}`;
}

export function formatIsoDate(value: DateParts): string {
  const month = String(value.month).padStart(2, "0");
  const day = String(value.day).padStart(2, "0");
  return `${value.year}-${month}-${day}`;
}

function toLocalDate(parts: DateParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day);
}

function partsFromDate(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function todayIso(now = new Date()): string {
  return formatIsoDate(partsFromDate(now));
}

export function todayJalali(now = new Date()): string {
  return formatJalaliDate(gregorianToJalali(now));
}

function parseApiDate(value: string | null | undefined): DateParts | null {
  return parseIsoDate(value);
}

export function isoToJalaliParts(
  value: string | null | undefined,
): DateParts | null {
  const iso = parseIsoDate(value);
  if (!iso) return null;
  return gregorianToJalali(toLocalDate(iso));
}

/** Display an API ISO date in the active UI calendar. */
export function formatDateForLocale(
  value: string | null | undefined,
  locale: string,
): string {
  if (!value) return "";
  if (locale === "fa") {
    const jalali = isoToJalaliParts(value);
    if (!jalali) return value;
    return formatJalaliDate(jalali);
  }
  const iso = parseIsoDate(value);
  return iso ? formatIsoDate(iso) : value;
}

function calendarYearFromIso(
  value: string | null | undefined,
  locale: string,
): number | null {
  if (locale === "fa") return isoToJalaliParts(value)?.year ?? null;
  return parseIsoDate(value)?.year ?? null;
}

export function currentCalendarYear(locale: string, now = new Date()): number {
  return locale === "fa" ? gregorianToJalali(now).year : now.getFullYear();
}

function calendarPartsFromIso(
  value: string | null | undefined,
  locale: string,
): DateParts | null {
  if (locale === "fa") return isoToJalaliParts(value);
  return parseIsoDate(value);
}

function endOfCalendarYear(year: number, locale: string): DateParts {
  return locale === "fa"
    ? { year, month: 12, day: 30 }
    : { year, month: 12, day: 31 };
}

/** Age in completed years. Uses death date when present, otherwise today. */
export function ageInYears(
  birthDate: string | null | undefined,
  untilDate?: string | null,
  now = new Date(),
): number | null {
  const birth = parseApiDate(birthDate);
  if (!birth) return null;
  const until = parseApiDate(untilDate) ?? partsFromDate(now);
  return yearsBetween(birth, until);
}

/** Age at a UI-calendar year (timeline scrub). Frozen at death if already deceased. */
export function ageInYearsAtYear(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined,
  year: number | null | undefined,
  locale = "en",
  now = new Date(),
): number | null {
  const birth = calendarPartsFromIso(birthDate, locale);
  if (!birth) return null;

  const today = locale === "fa" ? gregorianToJalali(now) : partsFromDate(now);
  const asOf = year ?? today.year;
  const death = calendarPartsFromIso(deathDate, locale);

  let until: DateParts;
  if (death && death.year <= asOf) {
    until = death;
  } else if (asOf >= today.year) {
    until = today;
  } else {
    until = endOfCalendarYear(asOf, locale);
  }
  return yearsBetween(birth, until);
}

/** Completed years from a start date until an end date, or today. */
export function durationInYears(
  fromDate: string | null | undefined,
  untilDate?: string | null,
  now = new Date(),
): number | null {
  const from = parseApiDate(fromDate);
  if (!from) return null;
  const until = parseApiDate(untilDate) ?? partsFromDate(now);
  return yearsBetween(from, until);
}

/** Compare two ISO date strings. Missing dates sort last. */
export function compareJalaliDates(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

/** Approximate current Jalali year without a calendar library. */
export function currentJalaliYear(now = new Date()): number {
  return gregorianToJalali(now).year;
}

export type TimelineBounds = {
  minYear: number;
  maxYear: number;
  /** Distinct birth years present in the tree (for tick marks). */
  birthYears: number[];
};

export function computeTimelineBounds(
  birthDates: Array<string | null | undefined>,
  locale = "en",
): TimelineBounds | null {
  const years: number[] = [];
  for (const value of birthDates) {
    const year = calendarYearFromIso(value, locale);
    if (year !== null) years.push(year);
  }
  if (years.length === 0) return null;

  const unique = [...new Set(years)].sort((a, b) => a - b);
  const minYear = unique[0]!;
  const maxYear = Math.max(unique[unique.length - 1]!, currentCalendarYear(locale));
  return { minYear, maxYear, birthYears: unique };
}

export function isBornByYear(
  birthDate: string | null | undefined,
  year: number,
  locale = "en",
): boolean {
  const birthYear = calendarYearFromIso(birthDate, locale);
  if (birthYear === null) return true;
  return birthYear <= year;
}

/** True when an event date has been reached in the timeline year. */
export function isReachedByYear(
  isoDate: string | null | undefined,
  year: number,
  locale = "en",
): boolean {
  const eventYear = calendarYearFromIso(isoDate, locale);
  if (eventYear === null) return true;
  return eventYear <= year;
}
