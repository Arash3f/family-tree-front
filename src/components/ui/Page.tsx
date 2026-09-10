"use client";

import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { OverflowMarquee } from "@/components/ui/OverflowMarquee";
import styles from "./Page.module.css";

export function Page({
  children,
  /** Caps the column for pages that hold a single short form. */
  narrow,
  className,
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[styles.page, narrow ? styles.pageNarrow : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  support,
  actions,
  back,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  support?: ReactNode;
  actions?: ReactNode;
  /** Breadcrumb-style link to the parent list. */
  back?: { href: string; label: ReactNode };
}) {
  return (
    <header className={styles.header}>
      {back ? (
        <Link className={styles.back} href={back.href}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
            <path
              d="M14 6l-6 6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {back.label}
        </Link>
      ) : null}
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <div className={styles.headerRow}>
        <h1 className={styles.title}>
          <OverflowMarquee
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </OverflowMarquee>
        </h1>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {support ? <p className={styles.support}>{support}</p> : null}
    </header>
  );
}

export function Panel({
  title,
  support,
  actions,
  children,
  /** Staggers the entrance animation; use ascending values down the page. */
  delay,
  flush,
  quiet,
  className,
}: {
  title?: ReactNode;
  support?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  delay?: 1 | 2 | 3;
  flush?: boolean;
  quiet?: boolean;
  className?: string;
}) {
  const classes = [
    styles.panel,
    flush ? styles.panelFlush : null,
    quiet ? styles.panelQuiet : null,
    delay ? styles[`delay${delay}`] : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      {title || actions ? (
        <div className={styles.panelHeader}>
          <div>
            {title ? <h2 className={styles.panelTitle}>{title}</h2> : null}
            {support ? <p className={styles.panelSupport}>{support}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
