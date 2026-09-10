"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { listRoles } from "@/lib/auth/client";
import { AuthApiError, Permissions, type AppRole } from "@/lib/auth/types";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/Feedback";
import { OverflowMarquee } from "@/components/ui/OverflowMarquee";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./RolesView.module.css";

const linkButton = `${buttonStyles.base} ${buttonStyles.primary}`;

export function RolesListView() {
  const t = useTranslations("roles");
  const { status, hasPermission } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canCreate = hasPermission(Permissions.ROLE_CREATE);
  const canUpdate = hasPermission(Permissions.ROLE_UPDATE);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.ROLE_READ)) {
      router.replace("/dashboard");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const page = await listRoles();
        if (!cancelled) setRoles(page.items);
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
  }, [status, hasPermission, router, t]);

  return (
    <Page>
      <PageHeader
        title={t("title")}
        support={t("support")}
        actions={
          canCreate ? (
            <Link className={linkButton} href="/dashboard/roles/new">
              {t("new")}
            </Link>
          ) : null
        }
      />

      {loading ? <p className={styles.empty}>{t("loading")}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && !error && roles.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : null}

      {roles.length > 0 ? (
        <Panel delay={1}>
          <ul className={styles.list}>
            {roles.map((role) => (
              <li key={role.id} className={styles.row}>
                <div>
                  <p className={styles.name}>
                    <OverflowMarquee title={role.name}>{role.name}</OverflowMarquee>
                  </p>
                  <p className={styles.meta}>
                    {t("permissionCount", { count: role.permission_ids.length })}
                    {" · "}
                    {t("userCount", { count: role.user_count ?? 0 })}
                  </p>
                </div>
                {canUpdate ? (
                  <Link
                    className={styles.link}
                    href={`/dashboard/roles/${role.id}`}
                  >
                    {t("manage")}
                  </Link>
                ) : (
                  <span className={styles.meta}>{role.id}</span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </Page>
  );
}
