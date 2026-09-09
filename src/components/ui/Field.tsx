"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { Select, optionsFromChildren } from "./Select";
import styles from "./Field.module.css";

type FieldShellProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Rendered next to the label, e.g. an "optional" marker or a counter. */
  aside?: ReactNode;
  className?: string;
  /**
   * Receives the ids to wire onto the control. Using a render prop keeps
   * `aria-describedby` correct without the caller having to invent ids.
   */
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
    className: string;
  }) => ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required,
  aside,
  className,
  children,
}: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <span className={styles.labelRow}>
        <label htmlFor={id}>
          {label}
          {required ? (
            <span className={styles.required} aria-hidden>
              {" *"}
            </span>
          ) : null}
        </label>
        {aside ? <span className={styles.optional}>{aside}</span> : null}
      </span>
      {children({
        id,
        describedBy,
        invalid: Boolean(error),
        className: [styles.control, error ? styles.invalid : null]
          .filter(Boolean)
          .join(" "),
      })}
      {error ? (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type Common = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  aside?: ReactNode;
  fieldClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  aside,
  fieldClassName,
  required,
  ...rest
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id">) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      aside={aside}
      required={required}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid, className }) => (
        <input
          {...rest}
          id={id}
          required={required}
          className={className}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  fieldClassName,
  required,
  ...rest
}: Common &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id">) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid, className }) => (
        <textarea
          {...rest}
          id={id}
          required={required}
          className={className}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  aside,
  fieldClassName,
  required,
  children,
  filterable,
  filterPlaceholder,
  filterEmptyLabel,
  ...rest
}: Common &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> & {
    filterable?: boolean;
    filterPlaceholder?: string;
    filterEmptyLabel?: string;
  }) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      aside={aside}
      required={required}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid, className }) => (
        <Select
          {...rest}
          options={optionsFromChildren(children)}
          id={id}
          required={required}
          className={className}
          describedBy={describedBy}
          invalid={invalid}
          filterable={filterable}
          filterPlaceholder={filterPlaceholder}
          filterEmptyLabel={filterEmptyLabel}
        >
          {children}
        </Select>
      )}
    </Field>
  );
}
