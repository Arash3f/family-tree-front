"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useAuthStore } from "@/stores/auth-store";

/**
 * After login / bootstrap, applies the signed-in user's saved locale and theme.
 * LocaleSwitcher / ThemeToggle persist changes separately via the API.
 */
export function UserPreferencesSync() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const appliedKey = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      appliedKey.current = null;
      return;
    }

    const key = `${user.id}:${user.preferred_locale ?? ""}:${user.preferred_theme ?? ""}`;
    if (appliedKey.current === key) return;
    appliedKey.current = key;

    if (
      user.preferred_theme &&
      user.preferred_theme !== theme
    ) {
      setTheme(user.preferred_theme);
    }

    if (
      user.preferred_locale &&
      user.preferred_locale !== locale
    ) {
      router.replace(pathname, {
        locale: user.preferred_locale as AppLocale,
      });
    }
  }, [status, user, locale, pathname, router, setTheme, theme]);

  return null;
}
