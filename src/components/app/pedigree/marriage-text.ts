import { formatLocaleDigits } from "@/lib/localeDigits";
import { durationInYears, formatDateForLocale } from "@/lib/pedigree/dates";
import type { Marriage } from "@/lib/auth/types";

/**
 * "1990 → 2004 · 14 years". The duration is dropped when the dates cannot be
 * compared, so a marriage with an unparsable date still shows what is known.
 */
export function marriagePeriodText(
  marriage: Pick<Marriage, "married_at" | "divorced_at">,
  locale: string,
  durationLabel: (years: number) => string,
): string {
  const dates = `${formatLocaleDigits(formatDateForLocale(marriage.married_at, locale), locale)}${
    marriage.divorced_at
      ? ` → ${formatLocaleDigits(formatDateForLocale(marriage.divorced_at, locale), locale)}`
      : ""
  }`;
  const years = durationInYears(marriage.married_at, marriage.divorced_at);
  if (years === null) return dates;
  return `${dates} · ${durationLabel(years)}`;
}
