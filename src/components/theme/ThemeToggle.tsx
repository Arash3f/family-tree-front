"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { HiMoon, HiSun } from "react-icons/hi2";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateMyPreferences } from "@/lib/auth/client";
import type { PreferredTheme } from "@/lib/auth/types";
import styles from "./ThemeToggle.module.css";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";
  const { status, patchUser } = useAuth();

  const toggle = () => {
    if (!mounted) return;
    const next: PreferredTheme = isDark ? "light" : "dark";
    setTheme(next);
    if (status === "authenticated") {
      void updateMyPreferences({ preferred_theme: next })
        .then(() => {
          patchUser({ preferred_theme: next });
        })
        .catch(() => {
          /* keep local theme; prefs can be retried from profile */
        });
    }
  };

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={t("themeToggle")}
      title={isDark ? t("themeLight") : t("themeDark")}
      aria-pressed={mounted ? isDark : undefined}
      onClick={toggle}
    >
      {isDark ? <HiSun aria-hidden /> : <HiMoon aria-hidden />}
    </button>
  );
}
