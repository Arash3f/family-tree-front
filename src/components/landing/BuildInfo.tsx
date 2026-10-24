"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fetchHealth } from "@/lib/api";
import { formatLocaleDigits } from "@/lib/localeDigits";
import styles from "./BuildInfo.module.css";

/** Built into the bundle from `package.json` — see `next.config.ts`. */
const FRONT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/**
 * Which build the visitor is looking at: the frontend release from the bundle
 * and the API release from `GET /health`.
 *
 * The API version is read at runtime rather than written here, because the two
 * are deployed separately — a screen recording then names the versions that are
 * actually serving it instead of whatever was true when the page was written.
 */
export function BuildInfo() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [apiVersion, setApiVersion] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const health = await fetchHealth(controller.signal);
        if (health?.version) setApiVersion(health.version);
      } catch {
        // No version line beats a wrong one; the status pill reports outages.
      }
    })();

    return () => controller.abort();
  }, []);

  if (!FRONT_VERSION) return null;

  const front = formatLocaleDigits(FRONT_VERSION, locale);

  return (
    <p className={styles.build} dir="auto">
      {apiVersion
        ? t("buildVersions", {
            front,
            back: formatLocaleDigits(apiVersion, locale),
          })
        : t("buildVersionsFrontOnly", { front })}
    </p>
  );
}
