"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { HiOutlineEnvelope } from "react-icons/hi2";
import { ButtonLink } from "@/components/ui/Button";
import styles from "./LoginForm.module.css";

const SUPPORT_EMAIL = "arash.alfooneh@gmail.com";

export function AuthSwitch({
  prompt,
  action,
  href,
}: {
  prompt: string;
  action: string;
  href: "/login" | "/register";
}) {
  return (
    <div className={styles.switch}>
      <p className={styles.divider}>{prompt}</p>
      <ButtonLink href={href} variant="ghost" size="lg" block>
        {action}
      </ButtonLink>
    </div>
  );
}

export function SupportCard({
  context,
  username,
}: {
  context: "login" | "register";
  username?: string;
}) {
  const t = useTranslations("authSupport");
  const titleId = useId();
  const subject = encodeURIComponent(t("mailSubject"));
  const body = encodeURIComponent(
    t("mailBody", { username: username?.trim() || "—" }),
  );

  return (
    <aside className={styles.helpCard} aria-labelledby={titleId}>
      <span className={styles.helpIcon} aria-hidden>
        <HiOutlineEnvelope />
      </span>
      <div className={styles.helpBody}>
        <p id={titleId} className={styles.helpTitle}>
          {t(`${context}Title`)}
        </p>
        <p className={styles.helpText}>{t(`${context}Text`)}</p>
        <a
          className={styles.mailLink}
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
        >
          {SUPPORT_EMAIL}
        </a>
      </div>
    </aside>
  );
}
