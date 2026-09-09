"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { listRoles, listUsers } from "@/lib/auth/client";
import { AuthApiError, Permissions, type AppUser } from "@/lib/auth/types";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/Feedback";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./UsersView.module.css";

const linkButton = `${buttonStyles.base} ${buttonStyles.primary}`;

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function UsersListView() {
  const t = useTranslations("users");
  const locale = useLocale();
  const { status, hasPermission } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canCreate = hasPermission(Permissions.USER_CREATE);
  const canUpdate = hasPermission(Permissions.USER_UPDATE);
  const canReadRoles = hasPermission(Permissions.ROLE_READ);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.USER_READ)) {
      router.replace("/dashboard");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Users carry only a role id, so the role list rides along to resolve
        // names.
        const [page, rolePage] = await Promise.all([
          listUsers(),
          canReadRoles ? listRoles() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setUsers(page.items);
        if (rolePage) {
          setRoleNames(
            Object.fromEntries(
              rolePage.items.map((role) => [role.id, role.name]),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof AuthApiError ? err.message : t("loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, hasPermission, canReadRoles, router, t]);

  const roleLabel = (roleId: string | null) => {
    if (!roleId) return t("noRole");
    return roleNames[roleId] ?? "—";
  };

  return (
    <Page>
      <PageHeader
        title={t("title")}
        support={t("support")}
        actions={
          canCreate ? (
            <Link className={linkButton} href="/dashboard/users/new">
              {t("new")}
            </Link>
          ) : null
        }
      />

      {loading ? <p className={styles.empty}>{t("loading")}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && !error && users.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : null}

      {!loading && !error && users.length > 0 ? (
        <Panel delay={1}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("username")}</th>
                  <th scope="col">{t("fullname")}</th>
                  <th scope="col">{t("role")}</th>
                  <th scope="col">{t("lastSession")}</th>
                  <th scope="col">
                    <span className={styles.srOnly}>{t("manage")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className={styles.cellName} data-label={t("username")}>
                      {user.username}
                    </td>
                    <td data-label={t("fullname")}>{user.fullname}</td>
                    <td data-label={t("role")}>
                      {roleLabel(user.role_id ?? null)}
                    </td>
                    <td
                      className={styles.cellMuted}
                      data-label={t("lastSession")}
                    >
                      {formatDate(user.last_session_at ?? null, locale)}
                    </td>
                    <td className={styles.tableAction}>
                      {canUpdate ? (
                        <Link
                          className={styles.link}
                          href={`/dashboard/users/${user.id}`}
                        >
                          {t("manage")}
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </Page>
  );
}
