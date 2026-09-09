"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchHealth, type HealthStatus } from "@/lib/api";
import styles from "./ApiStatus.module.css";

export function ApiStatus() {
  const t = useTranslations("hero");
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const result = await fetchHealth();
        if (!active || result == null) return;
        setHealth(result);
      } catch {
        // Ignore teardown races / unexpected fetch failures.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!health) {
    return (
      <span
        className={`${styles.pill} ${styles.pending}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {t("apiChecking")}
      </span>
    );
  }

  const label =
    health.status === "ok"
      ? t("apiOnline")
      : health.status === "degraded"
        ? t("apiDegraded")
        : t("apiOffline");

  const tone =
    health.status === "ok"
      ? styles.ok
      : health.status === "degraded"
        ? styles.degraded
        : styles.offline;

  return (
    <span className={`${styles.pill} ${tone}`} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden />
      {label}
    </span>
  );
}
