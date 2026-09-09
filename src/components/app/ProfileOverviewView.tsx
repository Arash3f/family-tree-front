"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./ProfileView.module.css";

const SECTIONS = [
  { href: "/dashboard/profile/permissions", key: "navPermissions" as const },
  { href: "/dashboard/profile/password", key: "navPassword" as const },
  { href: "/dashboard/profile/sessions", key: "navSessions" as const },
];

export function ProfileOverviewView() {
  const t = useTranslations("profile");
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Page>
      <PageHeader title={t("title")} support={t("support")} />

      <Panel delay={1}>
        <dl className={styles.list}>
          <div>
            <dt>{t("fullname")}</dt>
            <dd>{user.fullname}</dd>
          </div>
          <div>
            <dt>{t("username")}</dt>
            <dd>{user.username}</dd>
          </div>
          <div>
            <dt>{t("email")}</dt>
            <dd>{user.email?.trim() ? user.email : t("notSet")}</dd>
          </div>
          <div>
            <dt>{t("phone")}</dt>
            <dd>{user.phone?.trim() ? user.phone : t("notSet")}</dd>
          </div>
          <div>
            <dt>{t("role")}</dt>
            <dd>{user.role_name ?? t("noRole")}</dd>
          </div>
          <div>
            <dt>{t("accountType")}</dt>
            <dd>
              {user.account_type === "paid" ? t("accountPaid") : t("accountFree")}
            </dd>
          </div>
          <div className={styles.listWide}>
            <dt>{t("userId")}</dt>
            <dd className={styles.mono}>{user.id}</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        delay={2}
        title={t("sectionsTitle")}
        support={t("sectionsSupport")}
      >
        <ul className={styles.sectionLinks}>
          {SECTIONS.map((section) => (
            <li key={section.href}>
              <Link href={section.href}>{t(section.key)}</Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  );
}
