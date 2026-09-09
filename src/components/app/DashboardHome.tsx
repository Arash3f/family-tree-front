"use client";

import { useTranslations } from "next-intl";
import {
  HiOutlineCalendarDays,
  HiOutlineChatBubbleLeftRight,
  HiOutlineMap,
  HiOutlineShare,
  HiOutlineShieldCheck,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "./DashboardHome.module.css";

const FEATURES = [
  { key: "trees", Icon: HiOutlineShare },
  { key: "people", Icon: HiOutlineUserGroup },
  { key: "relations", Icon: HiOutlineMap },
  { key: "timeline", Icon: HiOutlineCalendarDays },
  { key: "access", Icon: HiOutlineShieldCheck },
  { key: "tickets", Icon: HiOutlineChatBubbleLeftRight },
] as const;

export function DashboardHome() {
  const t = useTranslations("dashboard");
  const { user } = useAuth();

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {t("welcome", { name: user?.fullname ?? "" })}
        </h1>
        <p className={styles.support}>{t("welcomeSupport")}</p>
      </header>

      <ul className={styles.features}>
        {FEATURES.map(({ key, Icon }) => (
          <li key={key} className={styles.feature}>
            <span className={styles.iconWrap} aria-hidden>
              <Icon className={styles.icon} />
            </span>
            <div className={styles.copy}>
              <h2 className={styles.featureTitle}>{t(`features.${key}.title`)}</h2>
              <p className={styles.featureBody}>{t(`features.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
