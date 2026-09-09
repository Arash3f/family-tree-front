import { useId, type FormHTMLAttributes, type ReactNode } from "react";

import styles from "./Form.module.css";

function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export type FormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "className"> & {
  /**
   * `auto` lets the fields pair up whenever the container is wide enough.
   * `single` forces one column, for forms short enough that a second column
   * would leave a field sitting next to an empty cell.
   */
  columns?: "auto" | "single";
  className?: string;
};

export function Form({
  columns = "auto",
  className,
  children,
  ...rest
}: FormProps) {
  return (
    <form
      {...rest}
      className={cx(
        styles.form,
        columns === "single" && styles.formSingle,
        className,
      )}
    >
      {children}
    </form>
  );
}

/** A cell spanning the full form width: textareas, alerts, notes, pickers. */
export function FormRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(styles.row, className)}>{children}</div>;
}

export function FormSection({
  title,
  support,
  children,
  className,
}: {
  title: ReactNode;
  support?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();

  return (
    <section
      role="group"
      aria-labelledby={titleId}
      className={cx(styles.section, className)}
    >
      <div className={styles.sectionHead}>
        <h3 id={titleId} className={styles.sectionTitle}>
          {title}
        </h3>
        {support ? <p className={styles.sectionSupport}>{support}</p> : null}
      </div>
      <div className={styles.sectionGrid}>{children}</div>
    </section>
  );
}

/**
 * The form footer. `secondary` is pushed to the opposite edge, which is where
 * a delete belongs — far from the save the user is aiming at.
 */
export function FormActions({
  children,
  secondary,
  className,
}: {
  children: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  if (!secondary) {
    return <div className={cx(styles.actions, className)}>{children}</div>;
  }

  return (
    <div className={cx(styles.actions, styles.actionsSpread, className)}>
      <div className={styles.actionsGroup}>{children}</div>
      <div className={styles.actionsGroup}>{secondary}</div>
    </div>
  );
}
