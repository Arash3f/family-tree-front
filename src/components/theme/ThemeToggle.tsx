"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { HiMoon, HiSun } from "react-icons/hi2";
import styles from "./ThemeToggle.module.css";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={t("themeToggle")}
      title={isDark ? t("themeLight") : t("themeDark")}
      aria-pressed={mounted ? isDark : undefined}
      onClick={() => {
        if (!mounted) return;
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? <HiSun aria-hidden /> : <HiMoon aria-hidden />}
    </button>
  );
}
