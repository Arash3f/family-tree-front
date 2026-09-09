"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { changeOwnPassword } from "@/lib/auth/client";
import { AuthApiError } from "@/lib/auth/types";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";

export function ProfilePasswordView() {
  const t = useTranslations("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordBusy(true);
    try {
      await changeOwnPassword({
        current_password: currentPassword,
        new_password: newPassword,
        re_password: rePassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setRePassword("");
      setPasswordMessage(t("passwordSuccess"));
    } catch (err) {
      setPasswordError(
        err instanceof AuthApiError ? err.message : t("passwordError"),
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <Page narrow>
      <PageHeader
        back={{ href: "/dashboard/profile", label: t("back") }}
        title={t("passwordTitle")}
        support={t("passwordSupport")}
      />

      <Panel delay={1}>
        {/* Passwords stay in one column: pairing "current" beside "new" reads
            as a single choice rather than two. */}
        <Form columns="single" onSubmit={handlePassword}>
          <TextField
            label={t("currentPassword")}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={passwordBusy}
          />
          <TextField
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            maxLength={256}
            disabled={passwordBusy}
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
            disabled={passwordBusy}
          />
          {passwordError || passwordMessage ? (
            <FormRow>
              {passwordError ? (
                <Alert tone="error">{passwordError}</Alert>
              ) : null}
              {passwordMessage ? (
                <Alert tone="success">{passwordMessage}</Alert>
              ) : null}
            </FormRow>
          ) : null}
          <FormActions>
            <Button
              type="submit"
              loading={passwordBusy}
              disabled={passwordBusy}
            >
              {passwordBusy ? t("saving") : t("savePassword")}
            </Button>
          </FormActions>
        </Form>
      </Panel>
    </Page>
  );
}
