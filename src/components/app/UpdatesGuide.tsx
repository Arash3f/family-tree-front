"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { HiOutlineSparkles } from "react-icons/hi2";
import { UpdatesPagination } from "@/components/updates/UpdatesPagination";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import {
  UPDATE_KEYS,
  UPDATES_PAGE_SIZE,
  type UpdateKey,
} from "@/lib/updates";
import themeStyles from "@/components/theme/ThemeToggle.module.css";
import styles from "./HelpGuide.module.css";

const emptySubscribe = () => () => {};

type Props = {
  /** Extra class on the trigger button (e.g. pedigree toolbar). */
  className?: string;
};

export function UpdatesGuide({ className }: Props) {
  const t = useTranslations("help");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, open, () => setOpen(false));
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const totalPages = Math.max(
    1,
    Math.ceil(UPDATE_KEYS.length / UPDATES_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * UPDATES_PAGE_SIZE;
  const visible = UPDATE_KEYS.slice(
    start,
    start + UPDATES_PAGE_SIZE,
  ) as UpdateKey[];
  const slots = Array.from(
    { length: UPDATES_PAGE_SIZE },
    (_, index) => visible[index] ?? null,
  );

  const panel =
    mounted &&
    open &&
    createPortal(
      <div className={styles.root} role="presentation">
        <button
          type="button"
          className={styles.backdrop}
          aria-label={t("close")}
          onClick={() => setOpen(false)}
        />
        <div
          ref={dialogRef}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {t("updatesTitle")}
            </h2>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
            >
              {t("close")}
            </button>
          </header>

          <p className={styles.lead}>{t("updatesLead")}</p>

          <ul className={`${styles.updates} ${styles.updatesPaged}`}>
            {slots.map((key, index) =>
              key ? (
                <li key={key} className={styles.item}>
                  <span className={styles.updateDate}>
                    {t(`updates.${key}.date`)}
                  </span>
                  <p className={styles.itemTitle}>{t(`updates.${key}.title`)}</p>
                  <p className={styles.itemBody}>{t(`updates.${key}.body`)}</p>
                </li>
              ) : (
                <li
                  key={`empty-${index}`}
                  className={`${styles.item} ${styles.itemEmpty}`}
                  aria-hidden
                />
              ),
            )}
          </ul>
          <UpdatesPagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>,
      document.body,
    );

  const triggerClass = [
    themeStyles.toggle,
    styles.triggerUpdates,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        aria-label={t("openUpdates")}
        title={t("openUpdates")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <HiOutlineSparkles aria-hidden />
      </button>
      {panel}
    </>
  );
}
