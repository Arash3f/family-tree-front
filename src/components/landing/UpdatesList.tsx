"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  UPDATE_KEYS,
  UPDATES_PAGE_SIZE,
  type UpdateKey,
} from "@/lib/updates";
import { UpdatesPagination } from "@/components/updates/UpdatesPagination";
import styles from "./Updates.module.css";

export function UpdatesList() {
  const t = useTranslations("updates");
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(UPDATE_KEYS.length / UPDATES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * UPDATES_PAGE_SIZE;
  const visible = UPDATE_KEYS.slice(start, start + UPDATES_PAGE_SIZE) as UpdateKey[];
  const slots = Array.from(
    { length: UPDATES_PAGE_SIZE },
    (_, index) => visible[index] ?? null,
  );

  return (
    <>
      <ol className={styles.list}>
        {slots.map((key, index) =>
          key ? (
            <li key={key} className={styles.item}>
              <time className={styles.date} dateTime={t(`items.${key}.iso`)}>
                {t(`items.${key}.date`)}
              </time>
              <h3 className={styles.itemTitle}>{t(`items.${key}.title`)}</h3>
              <p className={styles.itemBody}>{t(`items.${key}.body`)}</p>
            </li>
          ) : (
            <li
              key={`empty-${index}`}
              className={`${styles.item} ${styles.itemEmpty}`}
              aria-hidden
            />
          ),
        )}
      </ol>
      <UpdatesPagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </>
  );
}
