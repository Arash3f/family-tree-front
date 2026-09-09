"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  deleteRole,
  getRole,
  listPermissions,
  updateRole,
} from "@/lib/auth/client";
import {
  getApiErrorMessage,
  Permissions,
  isAssignableSystemPermission,
  type AppPermission,
  type AppRole,
} from "@/lib/auth/types";
import { Link, useRouter } from "@/i18n/navigation";
import { expandSelectedPermissionIds } from "@/lib/auth/permission-bundles";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import { RolePermissionPicker } from "./RolePermissionPicker";
import styles from "./RolesView.module.css";

type Props = {
  roleId: string;
};

export function RoleDetailView({ roleId }: Props) {
  const t = useTranslations("roles");
  const { showError, showSuccess, confirm } = useFeedback();
  const { status, hasPermission } = useAuth();
  const router = useRouter();
  const [target, setTarget] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canUpdate = hasPermission(Permissions.ROLE_UPDATE);
  const canDelete = hasPermission(Permissions.ROLE_DELETE);
  const canReadPermissions = hasPermission(Permissions.PERMISSION_READ);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.ROLE_READ)) {
      router.replace("/dashboard");
      return;
    }
    if (!canUpdate) {
      router.replace("/dashboard/roles");
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const role = await getRole(roleId);
        setTarget(role);
        setName(role.name);
        setSelectedIds(new Set(role.permission_ids));

        if (canReadPermissions) {
          const page = await listPermissions();
          setPermissions(
            page.items.filter((permission) =>
              isAssignableSystemPermission(permission.name),
            ),
          );
        }
      } catch (err) {
        const message = getApiErrorMessage(err, t("loadError"));
        setLoadError(message);
        showError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    status,
    hasPermission,
    canUpdate,
    canReadPermissions,
    roleId,
    router,
    t,
    showError,
  ]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const nextIds = Array.from(
        expandSelectedPermissionIds(selectedIds, permissions),
      );
      const prevIds = target?.permission_ids ?? [];
      const permissionsChanged =
        nextIds.length !== prevIds.length ||
        nextIds.some((id) => !prevIds.includes(id));

      const payload: {
        role_id: string;
        name?: string;
        permission_ids?: string[];
      } = { role_id: roleId };

      if (name.trim() && name.trim() !== target?.name) {
        payload.name = name.trim();
      }
      if (permissionsChanged) {
        payload.permission_ids = nextIds;
      }

      const updated = await updateRole(payload);
      setTarget(updated);
      setName(updated.name);
      setSelectedIds(new Set(updated.permission_ids));
      showSuccess(t("saveSuccess"));
    } catch (err) {
      showError(getApiErrorMessage(err, t("saveError")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm(t("deleteConfirm"), {
      confirmLabel: t("delete"),
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteRole(roleId);
      router.replace("/dashboard/roles");
    } catch (err) {
      showError(getApiErrorMessage(err, t("deleteError")));
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className={styles.empty}>{t("loading")}</p>;
  }

  if (!target) {
    return (
      <Page>
        <Alert tone="error">{loadError ?? t("notFound")}</Alert>
        <Link className={styles.link} href="/dashboard/roles">
          {t("back")}
        </Link>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/roles", label: t("back") }}
        title={t("editTitle", { name: target.name })}
        support={t("editSupport")}
      />

      <Panel delay={1}>
        <Form onSubmit={onSave}>
          <TextField
            label={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={saving || deleting}
            autoComplete="off"
          />

          <FormRow>
            {!canReadPermissions ? (
              <div className={styles.permGroup}>
                <p className={styles.permLabel}>{t("permissions")}</p>
                <p className={styles.empty}>{t("permissionsNeedRead")}</p>
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
                disabled={saving || deleting}
                resetKey={
                  target
                    ? `${target.id}:${[...target.permission_ids].sort().join(",")}`
                    : roleId
                }
              />
            )}
          </FormRow>

          <FormActions
            secondary={
              canDelete ? (
                <Button
                  variant="danger"
                  loading={deleting}
                  disabled={saving || deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? t("working") : t("delete")}
                </Button>
              ) : null
            }
          >
            <Button type="submit" loading={saving} disabled={saving || deleting}>
              {saving ? t("saving") : t("save")}
            </Button>
          </FormActions>
        </Form>
      </Panel>
    </Page>
  );
}
