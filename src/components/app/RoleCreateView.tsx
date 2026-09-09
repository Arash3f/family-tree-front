"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { createRole, listPermissions } from "@/lib/auth/client";
import {
  AuthApiError,
  Permissions,
  isAssignableSystemPermission,
  type AppPermission,
} from "@/lib/auth/types";
import { useRouter } from "@/i18n/navigation";
import { expandSelectedPermissionIds } from "@/lib/auth/permission-bundles";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import { RolePermissionPicker } from "./RolePermissionPicker";
import styles from "./RolesView.module.css";

export function RoleCreateView() {
  const t = useTranslations("roles");
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [permsPending, setPermsPending] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReadPermissions = hasPermission(Permissions.PERMISSION_READ);
  // Without read access no request is ever made, so nothing is pending.
  const loadingPerms = canReadPermissions && permsPending;

  useEffect(() => {
    if (!hasPermission(Permissions.ROLE_CREATE)) {
      router.replace("/dashboard/roles");
      return;
    }

    if (!canReadPermissions) return;

    let cancelled = false;
    (async () => {
      setPermsPending(true);
      try {
        const page = await listPermissions();
        if (!cancelled) {
          setPermissions(
            page.items.filter((permission) =>
              isAssignableSystemPermission(permission.name),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof AuthApiError ? err.message : t("loadError"));
        }
      } finally {
        if (!cancelled) setPermsPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPermission, canReadPermissions, router, t]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const permissionIds = Array.from(
        expandSelectedPermissionIds(selectedIds, permissions),
      );
      const role = await createRole({
        name: name.trim(),
        permission_ids: permissionIds,
      });
      router.replace(`/dashboard/roles/${role.id}`);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("createError"));
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/roles", label: t("back") }}
        title={t("createTitle")}
        support={t("createSupport")}
      />

      <Panel delay={1}>
        <Form onSubmit={onSubmit}>
          <TextField
            label={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={busy}
            autoComplete="off"
          />

          <FormRow>
            {!canReadPermissions ? (
              <div className={styles.permGroup}>
                <p className={styles.permLabel}>{t("permissions")}</p>
                <p className={styles.empty}>{t("permissionsNeedRead")}</p>
              </div>
            ) : loadingPerms ? (
              <div className={styles.permGroup}>
                <p className={styles.permLabel}>{t("permissions")}</p>
                <p className={styles.empty}>{t("loadingPermissions")}</p>
              </div>
            ) : permissions.length === 0 ? (
              <div className={styles.permGroup}>
                <p className={styles.permLabel}>{t("permissions")}</p>
                <p className={styles.empty}>{t("noPermissions")}</p>
              </div>
            ) : (
              <RolePermissionPicker
                permissions={permissions}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                disabled={busy}
                resetKey="create"
              />
            )}
          </FormRow>

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
