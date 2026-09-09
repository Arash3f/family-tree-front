"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { formatLocaleDigits } from "@/lib/localeDigits";
import type { TimelineBounds } from "@/lib/pedigree/dates";
import { Button } from "@/components/ui/Button";
import styles from "./TimelineBar.module.css";

/** Debounce graph filtering while the user scrubs the timeline slider. */
const TIMELINE_DEBOUNCE_MS = 72;
/** Too many birth ticks slows layout on large trees. */
const MAX_BIRTH_TICKS = 96;

type Props = {
  bounds: TimelineBounds;
  year: number;
  visibleCount: number;
  totalCount: number;
  onYearChange: (year: number) => void;
};

function yearTicks(minYear: number, maxYear: number): number[] {
  const span = maxYear - minYear;
  if (span <= 0) return [minYear];
  const step =
    span <= 12 ? 1 : span <= 40 ? 5 : span <= 100 ? 10 : span <= 200 ? 20 : 50;
  const ticks: number[] = [minYear];
  const start = Math.ceil((minYear + 1) / step) * step;
  for (let y = start; y < maxYear; y += step) ticks.push(y);
  if (ticks[ticks.length - 1] !== maxYear) ticks.push(maxYear);
  return ticks;
}

function sampleBirthYears(birthYears: number[]): number[] {
  if (birthYears.length <= MAX_BIRTH_TICKS) return birthYears;
  const step = Math.ceil(birthYears.length / MAX_BIRTH_TICKS);
  return birthYears.filter((_, index) => index % step === 0);
}

export function TimelineBar({
  bounds,
  year,
  visibleCount,
  totalCount,
  onYearChange,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const { minYear, maxYear, birthYears } = bounds;
  const [displayYear, setDisplayYear] = useState(year);
  const [committedYear, setCommittedYear] = useState(year);
  const [narrow, setNarrow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The thumb leads while dragging and `year` only catches up when the debounce
  // fires, so an outside change is adopted solely when the prop itself moves.
  if (year !== committedYear) {
    setCommittedYear(year);
    setDisplayYear(year);
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 719.98px)");
    const sync = () => {
      setNarrow(mq.matches);
      if (!mq.matches) setExpanded(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, []);

  const commitYear = useCallback(
    (nextYear: number) => {
      setDisplayYear(nextYear);
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      onYearChange(nextYear);
    },
    [onYearChange],
  );

  const scheduleYearChange = useCallback(
    (nextYear: number) => {
      setDisplayYear(nextYear);
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        onYearChange(nextYear);
      }, TIMELINE_DEBOUNCE_MS);
    },
    [onYearChange],
  );

  const ticks = useMemo(
    () => yearTicks(minYear, maxYear),
    [minYear, maxYear],
  );
  const birthTicks = useMemo(() => sampleBirthYears(birthYears), [birthYears]);
  const span = Math.max(1, maxYear - minYear);
  const atPresent = displayYear >= maxYear;
  const collapsed = narrow && !expanded;
  const yearText = formatLocaleDigits(displayYear, locale);
  const visibleText = t("timelineVisible", {
    visible: formatLocaleDigits(visibleCount, locale),
    total: formatLocaleDigits(totalCount, locale),
  });

  return (
    <div
      className={collapsed ? `${styles.bar} ${styles.collapsed}` : styles.bar}
      role="group"
      aria-label={t("timelineLabel")}
    >
      {narrow ? (
        <button
          type="button"
          className={styles.summary}
          aria-expanded={expanded}
          aria-controls="pedigree-timeline-body"
          onClick={() => setExpanded((open) => !open)}
        >
          <span className={styles.summaryMain}>
            <span className={styles.title}>{t("timelineLabel")}</span>
            <span className={styles.yearReadout} aria-live="polite">
              {yearText}
            </span>
          </span>
          <span className={styles.summaryMeta}>
            <span className={styles.count}>{visibleText}</span>
            <HiOutlineChevronDown
              className={styles.summaryChevron}
              aria-hidden
            />
          </span>
        </button>
      ) : (
        <div className={styles.meta}>
          <span className={styles.title}>{t("timelineLabel")}</span>
          <span className={styles.yearReadout} aria-live="polite">
            {yearText}
          </span>
          <span className={styles.count}>{visibleText}</span>
        </div>
      )}

      {!collapsed ? (
        <div id="pedigree-timeline-body" className={styles.body}>
          <div className={styles.trackWrap}>
            <div className={styles.ticks} aria-hidden>
              {birthTicks.map((birthYear) => (
                <span
                  key={birthYear}
                  className={styles.birthTick}
                  style={{
                    insetInlineStart: `${((birthYear - minYear) / span) * 100}%`,
                  }}
                />
              ))}
            </div>

            <input
              className={styles.range}
              type="range"
              min={minYear}
              max={maxYear}
              step={1}
              value={displayYear}
              onChange={(event) =>
                scheduleYearChange(Number(event.target.value))
              }
              aria-valuemin={minYear}
              aria-valuemax={maxYear}
              aria-valuenow={displayYear}
              aria-valuetext={yearText}
              aria-label={t("timelineScrub")}
            />

            <div className={styles.labels} aria-hidden>
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className={styles.label}
                  style={{
                    insetInlineStart: `${((tick - minYear) / span) * 100}%`,
                  }}
                >
                  {formatLocaleDigits(tick, locale)}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              variant="ghost"
              size="sm"
              disabled={displayYear <= minYear}
              onClick={() => commitYear(minYear)}
            >
              {t("timelineStart")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={atPresent}
              onClick={() => commitYear(maxYear)}
            >
              {t("timelinePresent")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
