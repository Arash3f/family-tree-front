"use client";

import { useLocale, useTranslations } from "next-intl";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import { formatLocaleDigits } from "@/lib/localeDigits";
import styles from "./UpdatesPagination.module.css";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function UpdatesPagination({ page, totalPages, onPageChange }: Props) {
  const t = useTranslations("updates");
  const locale = useLocale();

  if (totalPages <= 1) return null;

  const current = formatLocaleDigits(page + 1, locale);
  const total = formatLocaleDigits(totalPages, locale);
  const rtl = locale === "fa";
  const PrevIcon = rtl ? HiChevronRight : HiChevronLeft;
  const NextIcon = rtl ? HiChevronLeft : HiChevronRight;

  return (
    <nav className={styles.pager} aria-label={t("paginationLabel")}>
      <button
        type="button"
        className={styles.step}
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
        aria-label={t("prevPage")}
      >
        <PrevIcon aria-hidden />
      </button>

      <div className={styles.dots} role="group">
        {Array.from({ length: totalPages }, (_, index) => {
          const active = index === page;
          return (
            <button
              key={index}
              type="button"
              className={active ? `${styles.dot} ${styles.dotActive}` : styles.dot}
              aria-label={t("pageStatus", {
                current: formatLocaleDigits(index + 1, locale),
                total,
              })}
              aria-current={active ? "page" : undefined}
              onClick={() => onPageChange(index)}
            />
          );
        })}
      </div>

      <button
        type="button"
        className={styles.step}
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
        aria-label={t("nextPage")}
      >
        <NextIcon aria-hidden />
      </button>

      <p className={styles.srStatus} aria-live="polite">
        {t("pageStatus", { current, total })}
      </p>
    </nav>
  );
}
