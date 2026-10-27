"use client";

import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import {
  RENEWAL_NOTICE_DAYS,
  UPGRADE_REQUEST_HREF,
} from "@/lib/auth/account-limits";
import { fetchMyUsage } from "@/lib/auth/client";
import { Permissions, type AccountUsage } from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { formatDateForLocale } from "@/lib/pedigree/dates";
import styles from "./PlanUsageCard.module.css";

type MeterProps = {
  label: string;
  used: number;
  /** Absent on a paid plan: the count is shown without a ceiling. */
  limit?: number;
};

function UsageMeter({ label, used, limit }: MeterProps) {
  const t = useTranslations("dashboard.usage");
  const locale = useLocale();
  const digits = (value: number) => formatLocaleDigits(value, locale);
  const ratio = limit ? Math.min(1, used / limit) : 0;

  return (
    <li className={styles.meter}>
      <div className={styles.meterHead}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={styles.meterValue}>
          {limit
            ? t("ofLimit", { used: digits(used), limit: digits(limit) })
            : t("unlimited", { used: digits(used) })}
        </span>
      </div>
      {limit ? (
        <div
          className={styles.track}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
        >
          <span
            className={`${styles.fill} ${ratio >= 1 ? styles.full : ratio >= 0.75 ? styles.near : ""}`}
            style={{ inlineSize: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * The caller's plan and what their own trees hold against it: a meter per
 * quota on a free account, plain counts on a paid one, and a renewal banner
 * in the last days of a paid plan.
 */
export function PlanUsageCard() {
  const t = useTranslations("dashboard.usage");
  const locale = useLocale();
  const { user, hasPermission } = useAuth();
  const titleId = useId();
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [failed, setFailed] = useState(false);
  // The plan changes on the server (an admin upgrade, a lapse), so read it
  // fresh rather than trusting the profile cached at sign-in.
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (failed) {
    return <Alert tone="error">{t("loadError")}</Alert>;
  }
  if (!usage) return null;

  const { limited, free_limits: limits, days_left: daysLeft } = usage;
  const canRequest = hasPermission(Permissions.TICKET_CREATE);
  const expiring = daysLeft !== null && daysLeft <= RENEWAL_NOTICE_DAYS;

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {t("title")}
          </h2>
          <p className={styles.plan}>
            <span className={`${styles.badge} ${limited ? "" : styles.paid}`}>
              {limited ? t("free") : t("paid")}
            </span>
            {!limited ? (
              <span className={styles.until}>
                {usage.paid_until
                  ? t("paidUntil", {
                      date: formatLocaleDigits(
                        formatDateForLocale(usage.paid_until, locale),
                        locale,
                      ),
                    })
                  : t("paidOpenEnded")}
              </span>
            ) : null}
          </p>
        </div>
        <div className={styles.actions}>
          {limited && canRequest ? (
            <ButtonLink href={UPGRADE_REQUEST_HREF} size="sm">
              {t("upgrade")}
            </ButtonLink>
          ) : null}
          <ButtonLink href="/pricing" variant="ghost" size="sm">
            {t("seePlans")}
          </ButtonLink>
        </div>
      </header>

      {expiring ? (
        <Alert tone="info">
          <span className={styles.expiring}>
            {daysLeft <= 1
              ? t("expiringToday")
              : t("expiring", { count: formatLocaleDigits(daysLeft, locale) })}
            {canRequest ? (
              <ButtonLink href={UPGRADE_REQUEST_HREF} size="sm">
                {t("renew")}
              </ButtonLink>
            ) : null}
          </span>
        </Alert>
      ) : null}

      <ul className={styles.meters}>
        <UsageMeter
          label={t("trees")}
          used={usage.owned_trees}
          limit={limited ? limits.owned_trees : undefined}
        />
        {usage.trees.flatMap((tree) => [
          <UsageMeter
            key={`${tree.tree_id}-people`}
            label={t("people", { tree: tree.name })}
            used={tree.persons}
            limit={limited ? limits.persons_per_tree : undefined}
          />,
          <UsageMeter
            key={`${tree.tree_id}-marriages`}
            label={t("marriages", { tree: tree.name })}
            used={tree.marriages}
            limit={limited ? limits.marriages_per_tree : undefined}
          />,
        ])}
      </ul>
      {usage.trees.length === 0 ? (
        <p className={styles.empty}>{t("noTrees")}</p>
      ) : null}
    </section>
  );
}
