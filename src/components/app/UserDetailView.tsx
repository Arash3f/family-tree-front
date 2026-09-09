"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  clearSession,
  deleteUser,
  getUser,
  listRoles,
  listUserSessions,
  revokeAllUserSessions,
  revokeUserSession,
  updateUser,
} from "@/lib/auth/client";
import {
  AuthApiError,
  Permissions,
  type AppRole,
  type AppUser,
  type UserSession,
} from "@/lib/auth/types";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Alert, Badge } from "@/components/ui/Feedback";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./UsersView.module.css";

type Props = {
  userId: string;
};

type UserDetailData = {
  user: AppUser;
  sessions: UserSession[];
  roles: AppRole[] | null;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function UserDetailView({ userId }: Props) {
  const t = useTranslations("users");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { status, user: me, hasPermission } = useAuth();
  const router = useRouter();
  const [target, setTarget] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [username, setUsername] = useState("");
  const [fullname, setFullname] = useState("");
  const [roleId, setRoleId] = useState("");
  const [accountType, setAccountType] = useState<"free" | "paid">("free");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const canUpdate = hasPermission(Permissions.USER_UPDATE);
  const canDelete = hasPermission(Permissions.USER_DELETE);
  const canReadRoles = hasPermission(Permissions.ROLE_READ);
  const isSelf = me?.id === userId;

  const fetchDetail = useCallback(async (): Promise<UserDetailData> => {
    // Roles do not depend on the user record, so they ride along instead of
    // waiting for it.
    const [user, sessionList, rolePage] = await Promise.all([
      getUser(userId),
      canUpdate ? listUserSessions(userId) : Promise.resolve([]),
      canReadRoles ? listRoles() : Promise.resolve(null),
    ]);
    return { user, sessions: sessionList, roles: rolePage?.items ?? null };
  }, [userId, canUpdate, canReadRoles]);

  const applyDetail = useCallback((data: UserDetailData) => {
    setTarget(data.user);
    setUsername(data.user.username);
    setFullname(data.user.fullname);
    setRoleId(data.user.role_id ?? "");
    setAccountType(data.user.account_type === "paid" ? "paid" : "free");
    setSessions(data.sessions);
    if (data.roles) setRoles(data.roles);
  }, []);

  // Kept awaitable so the revoke handlers can hold their busy state until the
  // refreshed record lands.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyDetail(await fetchDetail());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [fetchDetail, applyDetail, t]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.USER_READ)) {
      router.replace("/dashboard");
      return;
    }
    if (!canUpdate) {
      router.replace("/dashboard/users");
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        applyDetail(await fetchDetail());
      } catch (err) {
        setError(err instanceof AuthApiError ? err.message : t("loadError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [status, hasPermission, canUpdate, router, fetchDetail, applyDetail, t]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: {
        user_id: string;
        username?: string;
        fullname?: string;
        password?: string;
        re_password?: string;
        role_id?: string | null;
        account_type?: "free" | "paid";
      } = { user_id: userId };

      if (username.trim() && username.trim() !== target?.username) {
        payload.username = username.trim();
      }
      if (fullname.trim() && fullname.trim() !== target?.fullname) {
        payload.fullname = fullname.trim();
      }
      if (roleId !== (target?.role_id ?? "")) {
        payload.role_id = roleId || null;
      }
      if (accountType !== (target?.account_type ?? "free")) {
        payload.account_type = accountType;
      }
      if (password) {
        payload.password = password;
        payload.re_password = rePassword;
      }

      const updated = await updateUser(payload);
      setTarget(updated);
      setUsername(updated.username);
      setFullname(updated.fullname);
      setRoleId(updated.role_id ?? "");
      setAccountType(updated.account_type === "paid" ? "paid" : "free");
      setPassword("");
      setRePassword("");
      setMessage(t("saveSuccess"));
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isSelf) return;
    const ok = await confirm(t("deleteConfirm"), {
      confirmLabel: t("delete"),
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteUser(userId);
      router.replace("/dashboard/users");
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("deleteError"));
      setDeleting(false);
    }
  };

  const handleRevoke = async (session: UserSession) => {
    const ok = await confirm(t("revokeConfirm"), {
      confirmLabel: t("revokeSession"),
    });
    if (!ok) return;
    setRevokingId(session.id);
    try {
      await revokeUserSession(userId, session.id);
      if (session.is_current && me?.id === userId) {
        clearSession();
        router.replace("/login");
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("loadError"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    const ok = await confirm(t("revokeAllConfirm"), {
      confirmLabel: t("revokeAll"),
    });
    if (!ok) return;
    setRevokingId("all");
    try {
      await revokeAllUserSessions(userId);
      if (me?.id === userId) {
        clearSession();
        router.replace("/login");
        return;
      }
      await load();
      setMessage(t("revokeAllSuccess"));
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("loadError"));
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return <p className={styles.empty}>{t("loading")}</p>;
  }

  if (!target) {
    return (
      <Page>
        <Alert tone="error">{error ?? t("notFound")}</Alert>
        <Link className={styles.link} href="/dashboard/users">
          {t("back")}
        </Link>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/users", label: t("back") }}
        title={t("editTitle", { name: target.fullname })}
        support={t("editSupport")}
      />

      <Panel delay={1}>
        <Form onSubmit={onSave}>
          <TextField
            label={t("fullname")}
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
            required
            disabled={saving || deleting}
          />

          <TextField
            label={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={saving || deleting}
          />

          {roles.length > 0 ? (
            <SelectField
              label={t("role")}
              hint={isSelf ? t("selfRoleHint") : undefined}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={saving || deleting || isSelf}
            >
              <option value="">{t("noRole")}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField
              label={t("role")}
              hint={isSelf ? t("selfRoleHint") : undefined}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={saving || deleting || isSelf}
              placeholder={t("roleIdPlaceholder")}
            />
          )}

          <SelectField
            label={t("accountType")}
            value={accountType}
            onChange={(e) =>
              setAccountType(e.target.value === "paid" ? "paid" : "free")
            }
            disabled={saving || deleting}
          >
            <option value="free">{t("accountFree")}</option>
            <option value="paid">{t("accountPaid")}</option>
          </SelectField>

          <TextField
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={256}
            disabled={saving || deleting}
          />
          <TextField
            label={t("rePassword")}
            type="password"
            autoComplete="new-password"
            value={rePassword}
            onChange={(e) => setRePassword(e.target.value)}
            minLength={8}
            maxLength={256}
            disabled={saving || deleting}
          />

          {error || message || (canDelete && isSelf) ? (
            <FormRow>
              {error ? <Alert tone="error">{error}</Alert> : null}
              {message ? <Alert tone="success">{message}</Alert> : null}
              {canDelete && isSelf ? (
                <span className={styles.hint}>{t("selfDeleteHint")}</span>
              ) : null}
            </FormRow>
          ) : null}

          <FormActions
            secondary={
              canDelete && !isSelf ? (
                <Button
                  variant="danger"
                  loading={deleting}
                  disabled={saving || deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? t("working") : t("delete")}
                </Button>
              ) : undefined
            }
          >
            <Button type="submit" loading={saving} disabled={saving || deleting}>
              {saving ? t("saving") : t("save")}
            </Button>
          </FormActions>
        </Form>
      </Panel>

      <Panel
        delay={2}
        title={t("sessionsTitle")}
        support={t("sessionsSupport")}
        actions={
          <Button
            variant="dangerGhost"
            size="sm"
            loading={revokingId === "all"}
            disabled={revokingId !== null || sessions.length === 0 || deleting}
            onClick={() => void handleRevokeAll()}
          >
            {revokingId === "all" ? t("working") : t("revokeAll")}
          </Button>
        }
      >
        {sessions.length === 0 ? (
          <p className={styles.empty}>{t("noSessions")}</p>
        ) : (
          <ul className={styles.sessionList}>
            {sessions.map((session) => (
              <li key={session.id} className={styles.sessionItem}>
                <div>
                  <p className={styles.name}>
                    {session.user_agent || t("unknownDevice")}
                    {session.is_current ? (
                      <Badge tone="accent">{t("currentSession")}</Badge>
                    ) : null}
                  </p>
                  <p className={styles.meta}>
                    {session.ip_address || t("unknownIp")} ·{" "}
                    {formatDate(session.created_at, locale)}
                  </p>
                </div>
                <Button
                  variant="dangerGhost"
                  size="sm"
                  loading={revokingId === session.id}
                  disabled={revokingId === session.id || deleting}
                  onClick={() => void handleRevoke(session)}
                >
                  {revokingId === session.id ? t("working") : t("revokeSession")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Page>
  );
}
