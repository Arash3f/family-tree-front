"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  DEFAULT_DIAL_CODE,
  DIAL_CODES,
  dialCodeLabel,
} from "@/lib/auth/country-dial-codes";
import { createUser, listRoles } from "@/lib/auth/client";
import { AuthApiError, Permissions, type AppRole } from "@/lib/auth/types";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Field, SelectField, TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./UsersView.module.css";

export function UserCreateView() {
  const t = useTranslations("users");
  const tRegister = useTranslations("register");
  const locale = useLocale();
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [accountType, setAccountType] = useState<"free" | "paid">("free");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesPending, setRolesPending] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReadRoles = hasPermission(Permissions.ROLE_READ);
  // Without read access no request is ever made, so nothing is pending.
  const loadingRoles = canReadRoles && rolesPending;

  const dialOptions = useMemo(
    () =>
      DIAL_CODES.map((entry) => ({
        value: entry.code,
        label: dialCodeLabel(entry, locale),
      })),
    [locale],
  );

  useEffect(() => {
    if (!hasPermission(Permissions.USER_CREATE)) {
      router.replace("/dashboard/users");
      return;
    }

    if (!canReadRoles) return;

    let cancelled = false;
    (async () => {
      setRolesPending(true);
      try {
        const page = await listRoles();
        if (!cancelled) setRoles(page.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof AuthApiError ? err.message : t("loadError"));
        }
      } finally {
        if (!cancelled) setRolesPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPermission, canReadRoles, router, t]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const user = await createUser({
        username: username.trim(),
        fullname: fullname.trim(),
        password,
        re_password: rePassword,
        email: email.trim() || null,
        phone: phoneDigits || null,
        country_code: phoneDigits ? countryCode : null,
        role_id: roleId || null,
        account_type: accountType,
      });
      router.replace(`/dashboard/users/${user.id}`);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("createError"));
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/users", label: t("back") }}
        title={t("createTitle")}
        support={t("createSupport")}
      />

      <Panel delay={1}>
        <Form onSubmit={onSubmit}>
          <TextField
            label={t("fullname")}
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
            required
            disabled={busy}
            autoComplete="name"
          />

          <TextField
            label={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={busy}
            autoComplete="off"
          />

          <TextField
            label={t("email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            autoComplete="email"
            aside={tRegister("optional")}
          />

          <div className={styles.phoneRow}>
            <SelectField
              label={tRegister("countryCode")}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              disabled={busy}
              filterable
              filterPlaceholder={tRegister("countrySearch")}
              filterEmptyLabel={tRegister("countryEmpty")}
              aside={tRegister("optional")}
            >
              {dialOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <TextField
              label={t("phone")}
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
              placeholder={tRegister("phonePlaceholder")}
              aside={tRegister("optional")}
            />
          </div>

          <TextField
            label={t("password")}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={256}
            disabled={busy}
          />

          <TextField
            label={t("rePassword")}
            type="password"
            autoComplete="new-password"
            value={rePassword}
            onChange={(e) => setRePassword(e.target.value)}
            required
            minLength={8}
            maxLength={256}
            disabled={busy}
          />

          {!canReadRoles ? (
            <TextField
              label={t("role")}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={busy}
              placeholder={t("roleIdPlaceholder")}
            />
          ) : loadingRoles ? (
            <Field label={t("role")} hint={t("loadingRoles")}>
              {() => null}
            </Field>
          ) : (
            <SelectField
              label={t("role")}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={busy}
            >
              <option value="">{t("noRole")}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </SelectField>
          )}

          <SelectField
            label={t("accountType")}
            value={accountType}
            onChange={(e) =>
              setAccountType(e.target.value === "paid" ? "paid" : "free")
            }
            disabled={busy}
          >
            <option value="free">{t("accountFree")}</option>
            <option value="paid">{t("accountPaid")}</option>
          </SelectField>

          {error ? (
            <FormRow>
              <Alert tone="error">{error}</Alert>
            </FormRow>
          ) : null}

          <FormActions>
            <Button type="submit" loading={busy} disabled={busy}>
              {busy ? t("creating") : t("createSubmit")}
            </Button>
          </FormActions>
        </Form>
      </Panel>
    </Page>
  );
}
