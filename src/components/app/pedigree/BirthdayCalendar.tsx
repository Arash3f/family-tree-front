"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineCalendarDays,
  HiOutlineLockClosed,
  HiOutlineXMark,
} from "react-icons/hi2";
import { Calendar } from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian_en from "react-date-object/locales/gregorian_en";
import type { Person } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
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
  const [cursor, setCursor] = useState(
    () =>
      new DateObject({
        calendar: isFa ? persian : gregorian,
        locale: isFa ? persian_fa : gregorian_en,
      }),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useScrollLock(open);
  useFocusTrap(dialogRef, open, () => setOpen(false));

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

  const close = () => setOpen(false);

  const toggleOpen = () => setOpen(!open);

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
              <header className={styles.panelHeader}>
                <div>
                  <h3>{t("birthdayCalendar")}</h3>
                  {canViewBirthDate ? (
                    <p>{t("birthdayCalendarSupport")}</p>
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
                <>
                  <div className={styles.calendarWrap}>
                    <Calendar
                      value={cursor}
                      onChange={(value) => {
                        if (value instanceof DateObject) {
                          setCursor(value);
                          setSelectedDay(
                            birthKey(value.month.number, value.day),
                          );
                        }
                      }}
                      onMonthChange={(date) => {
                        setCursor(date);
                        setSelectedDay(null);
                      }}
                      calendar={isFa ? persian : gregorian}
                      locale={isFa ? persian_fa : gregorian_en}
                      hideYear
                      disableYearPicker
                      mapDays={({ date }) => {
                        const key = birthKey(date.month.number, date.day);
                        const hits = byDay.get(key);
                        if (!hits?.length) return {};
                        return {
                          className: styles.birthdayDay,
                        };
                      }}
                    />
                  </div>

                  <section className={styles.listBlock}>
                    <h4>
                      {selectedDay
                        ? t("birthdayOnDay")
                        : t("birthdayThisMonth")}
                    </h4>
                    <div className={styles.listScroll}>
                      {listEntries.length === 0 ? (
                        <p className={styles.empty}>{t("birthdayEmpty")}</p>
                      ) : (
                        <ul className={styles.list}>
                          {listEntries.map((entry) => (
                            <li key={entry.person.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectPerson(entry.person.id);
                                  close();
                                }}
                              >
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
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                </>
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
