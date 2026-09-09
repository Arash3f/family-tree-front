"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { AuthApiError, getApiErrorMessage } from "@/lib/auth/types";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  DEFAULT_DIAL_CODE,
  DIAL_CODES,
  dialCodeLabel,
} from "@/lib/auth/country-dial-codes";
import { Link, useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import styles from "./LoginForm.module.css";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const ERROR_PASSWORD_MISMATCH = 1402;
const ERROR_USERNAME_TAKEN = 1405;
const ERROR_EMAIL_TAKEN = 1406;

type FieldErrors = {
  username?: string;
  password?: string;
  confirmPassword?: string;
  email?: string;
};

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

function matchesErrorCode(
  error: AuthApiError,
  code: number,
  name: string,
): boolean {
  if (error.errorCode === code || error.errorCode === name) return true;
  return Number(error.errorCode) === code;
}

export function RegisterForm() {
  const t = useTranslations("register");
  const locale = useLocale();
  const { status, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const dialOptions = useMemo(
    () =>
      DIAL_CODES.map((entry) => ({
        value: entry.code,
        label: dialCodeLabel(entry, locale),
      })),
    [locale],
  );

  const canSubmit =
    username.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(safeNextPath(searchParams.get("next")));
    }
  }, [status, router, searchParams]);

  const clearField = (key: keyof FieldErrors) => {
    setFieldError((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    const nextFieldError: FieldErrors = {};
    const usernameTrimmed = username.trim();

    if (usernameTrimmed.length < 3) {
      nextFieldError.username = t("usernameTooShort");
    } else if (!USERNAME_PATTERN.test(usernameTrimmed)) {
      nextFieldError.username = t("usernameInvalid");
    }

    if (password.length < 8) {
      nextFieldError.password = t("passwordTooShort");
    }

    if (confirmPassword.length < 8) {
      nextFieldError.confirmPassword = t("passwordTooShort");
    } else if (password !== confirmPassword) {
      nextFieldError.confirmPassword = t("passwordMismatch");
    }

    const emailTrimmed = email.trim();
    if (emailTrimmed && !EMAIL_PATTERN.test(emailTrimmed)) {
      nextFieldError.email = t("invalidEmail");
    }

    setFieldError(nextFieldError);
    setError(null);
    if (Object.keys(nextFieldError).length > 0) return;

    setSubmitting(true);

    try {
      const phoneDigits = phone.replace(/\D/g, "");
      await register({
        username: usernameTrimmed,
        password,
        re_password: confirmPassword,
        email: emailTrimmed || null,
        phone: phoneDigits || null,
        country_code: phoneDigits ? countryCode : null,
      });
      router.replace(safeNextPath(searchParams.get("next")));
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (matchesErrorCode(err, ERROR_USERNAME_TAKEN, "USERNAME_ALREADY_EXISTS")) {
          setFieldError({ username: t("usernameTaken") });
        } else if (
          matchesErrorCode(err, ERROR_EMAIL_TAKEN, "EMAIL_ALREADY_EXISTS")
        ) {
          setFieldError({ email: t("emailTaken") });
        } else if (
          matchesErrorCode(
            err,
            ERROR_PASSWORD_MISMATCH,
            "PASSWORD_CONFIRMATION_MISMATCH",
          )
        ) {
          setFieldError({ confirmPassword: t("passwordMismatch") });
        } else {
          setError(getApiErrorMessage(err, t("genericError")));
        }
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
            onChange={(event) => {
              setUsername(event.target.value);
              clearField("username");
              setError(null);
            }}
            required
            minLength={3}
            maxLength={50}
            pattern="[a-zA-Z0-9_.\-]+"
            disabled={submitting}
            error={fieldError.username}
          />

          <TextField
            label={t("password")}
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearField("password");
              setError(null);
            }}
            required
            minLength={8}
            maxLength={256}
            disabled={submitting}
            error={fieldError.password}
          />

          <TextField
            label={t("confirmPassword")}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearField("confirmPassword");
              setError(null);
            }}
            required
            minLength={8}
            maxLength={256}
            disabled={submitting}
            error={fieldError.confirmPassword}
          />

          <TextField
            label={t("email")}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearField("email");
              setError(null);
            }}
            disabled={submitting}
            aside={t("optional")}
            error={fieldError.email}
          />

          <div className={styles.phoneRow}>
            <SelectField
              label={t("countryCode")}
              name="countryCode"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              disabled={submitting}
              filterable
              filterPlaceholder={t("countrySearch")}
              filterEmptyLabel={t("countryEmpty")}
              aside={t("optional")}
            >
              {dialOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <TextField
              label={t("phone")}
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              dir="ltr"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={submitting}
              placeholder={t("phonePlaceholder")}
              aside={t("optional")}
            />
          </div>

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
            <ButtonLink href="/login" variant="subtle" size="lg" block>
              {t("goLogin")}
            </ButtonLink>
          </div>
        </form>
      </div>
    </div>
  );
}
