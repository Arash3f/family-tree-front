"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineCalendarDays,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineLockClosed,
  HiOutlineXMark,
} from "react-icons/hi2";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian_en from "react-date-object/locales/gregorian_en";
import type { Person } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { resolvePersonPhotoUrl } from "@/lib/media";
import { gregorianToJalali, parseIsoDate } from "@/lib/pedigree/dates";
import { personDisplayName } from "@/lib/pedigree/layout";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import styles from "./BirthdayCalendar.module.css";

type BirthdayEntry = {
  person: Person;
  month: number;
  day: number;
};

type Props = {
  people: Person[];
  canViewBirthDate: boolean;
  onSelectPerson: (personId: string) => void;
  /** Controlled open state for callers that open the calendar from a menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the toolbar trigger when the calendar is opened from elsewhere. */
  hideTrigger?: boolean;
};

function birthKey(month: number, day: number): string {
  return `${month}-${day}`;
}

function monthDayFromBirth(
  birthDate: string | null | undefined,
  isFa: boolean,
): { month: number; day: number } | null {
  const iso = parseIsoDate(birthDate);
  if (!iso) return null;
  if (!isFa) return { month: iso.month, day: iso.day };
  const jalali = gregorianToJalali(new Date(iso.year, iso.month - 1, iso.day));
  return { month: jalali.month, day: jalali.day };
}

function formatMonthDay(month: number, day: number, isFa: boolean): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return isFa ? `${mm}/${dd}` : `${mm}-${dd}`;
}

function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

function genderClass(
  gender: Person["gender"],
): string | null {
  if (gender === "female") return styles.female;
  if (gender === "male") return styles.male;
  return null;
}

/** Ordinal day-of-year proxy for month/day (non-leap approx) for upcoming sort. */
function monthDayOrdinal(month: number, day: number): number {
  return month * 32 + day;
}

function daysUntil(
  fromMonth: number,
  fromDay: number,
  toMonth: number,
  toDay: number,
): number {
  const from = monthDayOrdinal(fromMonth, fromDay);
  const to = monthDayOrdinal(toMonth, toDay);
  if (to >= from) return to - from;
  return to + 32 * 12 + 1 - from;
}

function makeCursor(isFa: boolean): DateObject {
  return new DateObject({
    calendar: isFa ? persian : gregorian,
    locale: isFa ? persian_fa : gregorian_en,
  });
}

function weekDayLabels(isFa: boolean): string[] {
  const sample = makeCursor(isFa);
  return sample.weekDays.map((day) => day.shortName || day.name.slice(0, 1));
}

type MonthCell = {
  day: number | null;
  key: string | null;
  isToday: boolean;
  isSelected: boolean;
  hits: BirthdayEntry[];
};

function buildMonthCells(
  cursor: DateObject,
  today: DateObject,
  selectedDay: string | null,
  byDay: Map<string, BirthdayEntry[]>,
): MonthCell[] {
  const first = new DateObject(cursor).toFirstOfMonth();
  const daysInMonth = first.month.length;
  const pad = first.weekDay.index;
  const month = first.month.number;
  const sameMonthAsToday =
    today.year === first.year && today.month.number === month;

  const cells: MonthCell[] = [];
  for (let i = 0; i < pad; i += 1) {
    cells.push({
      day: null,
      key: null,
      isToday: false,
      isSelected: false,
      hits: [],
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = birthKey(month, day);
    cells.push({
      day,
      key,
      isToday: sameMonthAsToday && today.day === day,
      isSelected: selectedDay === key,
      hits: byDay.get(key) ?? [],
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({
      day: null,
      key: null,
      isToday: false,
      isSelected: false,
      hits: [],
    });
  }
  return cells;
}

function PersonAvatar({
  person,
  className,
}: {
  person: Person;
  className: string;
}) {
  const photo = resolvePersonPhotoUrl(person.photo_url, person.photo_object_key);
  return (
    <span
      className={[className, genderClass(person.gender)].filter(Boolean).join(" ")}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" />
      ) : (
        personInitials(person.name)
      )}
    </span>
  );
}

const emptySubscribe = () => () => {};

export function BirthdayCalendarButton({
  people,
  canViewBirthDate,
  onSelectPerson,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const isFa = locale === "fa";
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
  };
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [cursor, setCursor] = useState(() => makeCursor(isFa));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useScrollLock(open);
  useFocusTrap(dialogRef, open, () => setOpen(false));

  const today = useMemo(() => makeCursor(isFa), [isFa]);
  const labels = useMemo(() => weekDayLabels(isFa), [isFa]);

  const entries = useMemo(() => {
    if (!canViewBirthDate) return [] as BirthdayEntry[];
    const list: BirthdayEntry[] = [];
    for (const person of people) {
      const parts = monthDayFromBirth(person.birth_date, isFa);
      if (!parts) continue;
      list.push({ person, month: parts.month, day: parts.day });
    }
    return list;
  }, [people, canViewBirthDate, isFa]);

  const byDay = useMemo(() => {
    const map = new Map<string, BirthdayEntry[]>();
    for (const entry of entries) {
      const key = birthKey(entry.month, entry.day);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [entries]);

  const spotlight = useMemo(() => {
    const todayM = today.month.number;
    const todayD = today.day;
    const ranked = [...entries]
      .map((entry) => ({
        entry,
        until: daysUntil(todayM, todayD, entry.month, entry.day),
      }))
      .sort(
        (a, b) =>
          a.until - b.until ||
          a.entry.person.name.localeCompare(b.entry.person.name),
      );
    return ranked.find((row) => row.until <= 14) ?? null;
  }, [entries, today]);

  const monthEntries = useMemo(() => {
    const month = cursor.month.number;
    return entries
      .filter((entry) => entry.month === month)
      .sort(
        (a, b) => a.day - b.day || a.person.name.localeCompare(b.person.name),
      );
  }, [entries, cursor]);

  const selectedEntries = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const listEntries = selectedDay ? selectedEntries : monthEntries;
  const cells = useMemo(
    () => buildMonthCells(cursor, today, selectedDay, byDay),
    [cursor, today, selectedDay, byDay],
  );

  const monthTitle = cursor.month.name;

  const close = () => setOpen(false);
  const toggleOpen = () => setOpen(!open);

  const shiftMonth = (delta: number) => {
    setCursor((current) => new DateObject(current).add(delta, "month"));
    setSelectedDay(null);
  };

  const selectPerson = (personId: string) => {
    onSelectPerson(personId);
    close();
  };

  const dialog =
    open && mounted
      ? createPortal(
          <div className={styles.overlay}>
            <button
              type="button"
              className={styles.backdrop}
              aria-label={t("close")}
              onClick={close}
            />
            <div
              ref={dialogRef}
              className={styles.panel}
              role="dialog"
              aria-modal="true"
              aria-label={t("birthdayCalendar")}
            >
              <div className={styles.sheetHandle} aria-hidden />

              <header className={styles.panelHeader}>
                <div className={styles.panelTitleText}>
                  <h3>{t("birthdayCalendar")}</h3>
                  {canViewBirthDate ? (
                    <p>
                      {entries.length > 0
                        ? t("birthdayCalendarCount", {
                            count: formatLocaleDigits(entries.length, locale),
                          })
                        : t("birthdayCalendarSupport")}
                    </p>
                  ) : null}
                </div>
                <div className={styles.panelHeaderActions}>
                  {!canViewBirthDate ? (
                    <span
                      className={styles.lockBadge}
                      title={t("noAccessHint")}
                      aria-label={t("noAccess")}
                    >
                      <HiOutlineLockClosed aria-hidden />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label={t("close")}
                    onClick={close}
                  >
                    <HiOutlineXMark aria-hidden />
                  </button>
                </div>
              </header>

              {!canViewBirthDate ? (
                <div className={styles.lockedState}>
                  <span className={styles.lockedIcon}>
                    <HiOutlineLockClosed aria-hidden />
                  </span>
                  <p>{t("birthdayCalendarLocked")}</p>
                </div>
              ) : (
                <div className={styles.body}>
                  {spotlight ? (
                    <button
                      type="button"
                      className={[
                        styles.spotlight,
                        spotlight.until === 0 ? styles.spotlightToday : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => selectPerson(spotlight.entry.person.id)}
                    >
                      <PersonAvatar
                        person={spotlight.entry.person}
                        className={styles.spotlightAvatar}
                      />
                      <span className={styles.spotlightText}>
                        <span className={styles.spotlightName}>
                          {personDisplayName(spotlight.entry.person)}
                        </span>
                        <span className={styles.spotlightMeta}>
                          {spotlight.until === 0
                            ? t("birthdayToday")
                            : t("birthdayInDays", {
                                days: formatLocaleDigits(
                                  spotlight.until,
                                  locale,
                                ),
                              })}
                        </span>
                      </span>
                      <span className={styles.spotlightDate}>
                        {formatLocaleDigits(
                          formatMonthDay(
                            spotlight.entry.month,
                            spotlight.entry.day,
                            isFa,
                          ),
                          locale,
                        )}
                      </span>
                    </button>
                  ) : null}

                  <div className={styles.monthBar}>
                    <button
                      type="button"
                      className={styles.monthNav}
                      aria-label={t("birthdayPrevMonth")}
                      onClick={() => shiftMonth(-1)}
                    >
                      {isFa ? (
                        <HiOutlineChevronRight aria-hidden />
                      ) : (
                        <HiOutlineChevronLeft aria-hidden />
                      )}
                    </button>
                    <h4 className={styles.monthTitle}>{monthTitle}</h4>
                    <button
                      type="button"
                      className={styles.monthNav}
                      aria-label={t("birthdayNextMonth")}
                      onClick={() => shiftMonth(1)}
                    >
                      {isFa ? (
                        <HiOutlineChevronLeft aria-hidden />
                      ) : (
                        <HiOutlineChevronRight aria-hidden />
                      )}
                    </button>
                  </div>

                  <div className={styles.weekRow} aria-hidden>
                    {labels.map((label, index) => (
                      <span key={`wd-${index}`} className={styles.weekDay}>
                        {label}
                      </span>
                    ))}
                  </div>

                  <div className={styles.grid} role="grid">
                    {cells.map((cell, index) => {
                      if (cell.day == null || cell.key == null) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className={styles.cellEmpty}
                          />
                        );
                      }
                      const hasBirthday = cell.hits.length > 0;
                      const lead = cell.hits[0];
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          role="gridcell"
                          aria-selected={cell.isSelected}
                          aria-current={cell.isToday ? "date" : undefined}
                          className={[
                            styles.cell,
                            cell.isToday ? styles.cellToday : null,
                            cell.isSelected ? styles.cellSelected : null,
                            hasBirthday ? styles.cellBirthday : null,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() =>
                            setSelectedDay((prev) =>
                              prev === cell.key ? null : cell.key,
                            )
                          }
                        >
                          <span className={styles.cellDay}>
                            {formatLocaleDigits(cell.day, locale)}
                          </span>
                          {hasBirthday && lead ? (
                            <span className={styles.cellMark}>
                              <PersonAvatar
                                person={lead.person}
                                className={styles.cellAvatar}
                              />
                              {cell.hits.length > 1 ? (
                                <span className={styles.cellCount}>
                                  {formatLocaleDigits(
                                    cell.hits.length,
                                    locale,
                                  )}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className={styles.cellMarkSpacer} aria-hidden />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <section className={styles.listSection}>
                    <div className={styles.listHeading}>
                      <h4>
                        {selectedDay
                          ? t("birthdayOnDay")
                          : t("birthdayThisMonth")}
                      </h4>
                      {selectedDay ? (
                        <button
                          type="button"
                          className={styles.clearDay}
                          onClick={() => setSelectedDay(null)}
                        >
                          {t("birthdayShowMonth")}
                        </button>
                      ) : null}
                    </div>
                    {listEntries.length === 0 ? (
                      <p className={styles.empty}>{t("birthdayEmpty")}</p>
                    ) : (
                      <ul className={styles.list}>
                        {listEntries.map((entry) => (
                          <li key={entry.person.id}>
                            <button
                              type="button"
                              onClick={() => selectPerson(entry.person.id)}
                            >
                              <PersonAvatar
                                person={entry.person}
                                className={styles.listAvatar}
                              />
                              <span className={styles.personText}>
                                <span className={styles.personName}>
                                  {personDisplayName(entry.person)}
                                </span>
                                <span className={styles.personMeta}>
                                  {formatLocaleDigits(
                                    formatMonthDay(
                                      entry.month,
                                      entry.day,
                                      isFa,
                                    ),
                                    locale,
                                  )}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={styles.root}>
      {hideTrigger ? null : (
        <button
          type="button"
          className={[styles.trigger, open ? styles.triggerOpen : null]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t("birthdayCalendar")}
          title={t("birthdayCalendarHint")}
          onClick={toggleOpen}
        >
          <HiOutlineCalendarDays aria-hidden />
          {canViewBirthDate && entries.length > 0 ? (
            <span className={styles.count}>
              {formatLocaleDigits(entries.length, locale)}
            </span>
          ) : !canViewBirthDate ? (
            <HiOutlineLockClosed className={styles.triggerLock} aria-hidden />
          ) : null}
        </button>
      )}
      {dialog}
    </div>
  );
}

