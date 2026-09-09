import type { ReactNode } from "react";

import styles from "./Feedback.module.css";

export type AlertTone = "info" | "success" | "warning" | "error";

const ALERT_PATHS: Record<AlertTone, string> = {
  info: "M12 8h.01M11 12h1v5h1",
  success: "M20 6L9 17l-5-5",
  warning: "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  error: "M12 8v5M12 16h.01",
};

/** Errors and warnings interrupt; info and success are announced politely. */
const ALERT_ROLE: Record<AlertTone, "alert" | "status"> = {
  info: "status",
  success: "status",
  warning: "alert",
  error: "alert",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const toneClass = {
    info: styles.info,
    success: styles.success,
    warning: styles.warning,
    error: styles.error,
  }[tone];

  return (
    <div
      className={[styles.alert, toneClass, className].filter(Boolean).join(" ")}
      role={ALERT_ROLE[tone]}
    >
      <span className={styles.alertIcon} aria-hidden>
        <svg viewBox="0 0 24 24" width="100%" height="100%">
          {tone !== "warning" && tone !== "success" ? (
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          ) : null}
          <path
            d={ALERT_PATHS[tone]}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className={styles.alertBody}>
        {title ? <strong className={styles.alertTitle}>{title}</strong> : null}
        <span>{children}</span>
      </div>
    </div>
  );
}

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "male"
  | "female";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: styles.badgeNeutral,
  accent: styles.badgeAccent,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  male: styles.badgeMale,
  female: styles.badgeFemale,
};

export function Badge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: BadgeTone;
  /** Small leading dot, for live or status-style badges. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[styles.badge, BADGE_TONES[tone], className]
        .filter(Boolean)
        .join(" ")}
    >
      {dot ? <span className={styles.dot} aria-hidden /> : null}
      {children}
    </span>
  );
}
