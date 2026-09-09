"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { AuthApiError } from "@/lib/auth/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import styles from "./LoginForm.module.css";

const SUPPORT_EMAIL = "arash.alfooneh@gmail.com";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

function EmailLink(chunks: ReactNode) {
  return (
    <a className={styles.mailLink} href={`mailto:${SUPPORT_EMAIL}`}>
      {chunks}
    </a>
  );
}

export function LoginForm() {
  const t = useTranslations("login");
  const { status, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = username.trim().length > 0 && password.length > 0;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(safeNextPath(searchParams.get("next")));
    }
  }, [status, router, searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      await login(username.trim(), password);
      router.replace(safeNextPath(searchParams.get("next")));
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.status === 401 ? t("invalidCredentials") : err.message);
      } else {
        setError(t("genericError"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className={styles.page}>
        <div className={styles.gate} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Link className={styles.homeLink} href="/">
          {t("backHome")}
        </Link>
        <div className={styles.toolbarControls}>
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <div className={styles.stage}>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <p className={styles.brand}>{t("brand")}</p>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.support}>{t("support")}</p>

          <TextField
            label={t("username")}
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            disabled={submitting}
          />

          <TextField
            label={t("password")}
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={submitting}
          />

          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className={styles.actions}>
            <Button
              type="submit"
              size="lg"
              block
              disabled={!canSubmit}
              loading={submitting}
            >
              {submitting ? t("submitting") : t("submit")}
            </Button>
            <ButtonLink href="/register" variant="subtle" size="lg" block>
              {t("goRegister")}
            </ButtonLink>
          </div>

          <p className={styles.forgot}>
            {t.rich("forgotPassword", { email: EmailLink })}
          </p>
        </form>
      </div>
    </div>
  );
}
