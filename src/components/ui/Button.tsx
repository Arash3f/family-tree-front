import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { Link } from "@/i18n/navigation";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "ghost"
  | "subtle"
  | "danger"
  | "dangerGhost"
  | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container's inline size. */
  block?: boolean;
  /**
   * Show a spinner and block interaction. Kept separate from `disabled` so a
   * busy button still reads as enabled to assistive tech, via `aria-busy`.
   */
  loading?: boolean;
  /** Leading icon, placed before the label on the inline axis. */
  icon?: ReactNode;
  /** Escape hatch for layout-only classes from the calling stylesheet. */
  className?: string;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    styles.base,
    styles[variant],
    size !== "md" ? styles[size] : null,
    block ? styles.block : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : icon}
      {children}
    </button>
  );
}

/**
 * A link that looks like a button, for navigation actions such as "new user".
 * Three list views were each assembling `base + primary` by hand.
 */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block,
  icon,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const classes = [
    styles.base,
    styles[variant],
    size !== "md" ? styles[size] : null,
    block ? styles.block : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link className={classes} href={href}>
      {icon}
      {children}
    </Link>
  );
}
