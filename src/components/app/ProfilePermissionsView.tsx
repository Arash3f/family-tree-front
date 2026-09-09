"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import { groupPermissionsByModule } from "@/lib/auth/permission-modules";
import { isAssignableSystemPermission } from "@/lib/auth/types";
import styles from "./ProfileView.module.css";

export function ProfilePermissionsView() {
  const t = useTranslations("profile");
  const tPerm = useTranslations("permissions");
  const tModules = useTranslations("permissionModules");
  const locale = useLocale();
  const { user } = useAuth();

  if (!user) return null;

  const source =
    user.permission_details.length > 0
      ? user.permission_details
      : user.permissions.map((name) => ({
          name,
          description_en: "",
          description_fa: "",
        }));
  // A permission can arrive twice when it is granted by both the role and a
  // direct assignment; the name is the identity, so the later copy is a repeat.
  const details = [...new Map(source.map((p) => [p.name, p])).values()].filter(
    (permission) => isAssignableSystemPermission(permission.name),
  );
  const groups = groupPermissionsByModule(details);

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/profile", label: t("back") }}
        title={t("permissionsTitle")}
        support={t("permissionsSupport")}
      />

      <Panel delay={1}>
        {details.length === 0 ? (
          <p className={styles.empty}>{t("noPermissions")}</p>
        ) : (
          <div className={styles.permModules}>
            {groups.map((group) => (
              <section key={group.module} className={styles.permModule}>
                <h2 className={styles.permModuleTitle}>
                  {tModules.has(group.module)
                    ? tModules(group.module)
                    : group.module}
                </h2>
                <ul className={styles.permList}>
                  {group.permissions.map((permission) => {
                    const label = tPerm.has(permission.name)
                      ? tPerm(permission.name)
                      : permission.name;
                    const description =
                      locale === "fa"
                        ? permission.description_fa
                        : permission.description_en;

                    return (
                      <li key={permission.name} className={styles.permRow}>
                        <span className={styles.permName}>{label}</span>
                        {description ? (
                          <span className={styles.permDescription}>
                            {description}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
