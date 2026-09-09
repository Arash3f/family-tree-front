const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;
const EASTERN_ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert Western digits in a string to Persian digits. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]!);
}

/** Convert Persian / Eastern Arabic digits to ASCII 0-9. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit as (typeof PERSIAN_DIGITS)[number])))
    .replace(/[٠-٩]/g, (digit) => String(EASTERN_ARABIC_DIGITS.indexOf(digit)));
}

/** Format a number (or numeric string) with locale-appropriate digits. */
export function formatLocaleDigits(
  value: string | number,
  locale: string,
): string {
  const text = String(value);
  return locale === "fa" ? toPersianDigits(text) : text;
}
