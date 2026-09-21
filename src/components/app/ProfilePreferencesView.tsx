"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateMyPreferences } from "@/lib/auth/client";
import {
  AuthApiError,
  type PreferredLocale,
  type PreferredTheme,
} from "@/lib/auth/types";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";

export function ProfilePreferencesView() {
  const t = useTranslations("profile");
  const tNav = useTranslations("nav");
  const { user, patchUser } = useAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [preferredLocale, setPreferredLocale] = useState<PreferredLocale>(
    () =>
      user?.preferred_locale ??
      (locale === "fa" ? "fa" : "en"),
  );
  const [preferredTheme, setPreferredTheme] = useState<PreferredTheme>(
    () =>
      user?.preferred_theme ??
      (theme === "light" || theme === "dark" || theme === "system"
        ? theme
        : "system"),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await updateMyPreferences({
        preferred_locale: preferredLocale,
        preferred_theme: preferredTheme,
      });
      patchUser({
        preferred_locale: preferredLocale,
        preferred_theme: preferredTheme,
      });
      setTheme(preferredTheme);
      if (preferredLocale !== locale) {
        router.replace(pathname, { locale: preferredLocale });
      }
      setMessage(t("preferencesSuccess"));
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : t("preferencesError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <PageHeader
        back={{ href: "/dashboard/profile", label: t("back") }}
        title={t("preferencesTitle")}
        support={t("preferencesSupport")}
      />

      <Panel delay={1}>
        <Form columns="single" onSubmit={handleSubmit}>
          <SelectField
            label={t("preferredLocale")}
            value={preferredLocale}
            onChange={(e) =>
              setPreferredLocale(e.target.value as PreferredLocale)
            }
            disabled={busy}
          >
            <option value="en">{tNav("langEn")}</option>
            <option value="fa">{tNav("langFa")}</option>
          </SelectField>
          <SelectField
            label={t("preferredTheme")}
            value={preferredTheme}
            onChange={(e) =>
              setPreferredTheme(e.target.value as PreferredTheme)
            }
            disabled={busy}
          >
            <option value="light">{t("themeLight")}</option>
            <option value="dark">{t("themeDark")}</option>
            <option value="system">{t("themeSystem")}</option>
          </SelectField>
          {error || message ? (
            <FormRow>
              {error ? <Alert tone="error">{error}</Alert> : null}
              {message ? <Alert tone="success">{message}</Alert> : null}
            </FormRow>
          ) : null}
          <FormActions>
            <Button type="submit" loading={busy} disabled={busy}>
              {busy ? t("saving") : t("savePreferences")}
            </Button>
          </FormActions>
        </Form>
      </Panel>
    </Page>
  );
}
