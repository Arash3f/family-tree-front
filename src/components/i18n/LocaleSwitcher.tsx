"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateMyPreferences } from "@/lib/auth/client";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import styles from "./LocaleSwitcher.module.css";

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { status, patchUser } = useAuth();

  const switchTo = (next: AppLocale) => {
    if (next === locale || pending) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
    if (status === "authenticated") {
      void updateMyPreferences({ preferred_locale: next })
        .then(() => {
          patchUser({ preferred_locale: next });
        })
        .catch(() => {
          /* keep local switch; prefs can be retried from profile */
        });
    }
  };

  return (
    <div className={styles.group} role="group" aria-label={t("language")}>
      <button
        type="button"
        className={locale === "en" ? styles.active : styles.btn}
        aria-pressed={locale === "en"}
        aria-current={locale === "en" ? "true" : undefined}
        disabled={pending}
        onClick={() => switchTo("en")}
      >
        {t("langEn")}
      </button>
      <button
        type="button"
        className={locale === "fa" ? styles.active : styles.btn}
        aria-pressed={locale === "fa"}
        aria-current={locale === "fa" ? "true" : undefined}
        disabled={pending}
        onClick={() => switchTo("fa")}
      >
        {t("langFa")}
      </button>
    </div>
  );
}
