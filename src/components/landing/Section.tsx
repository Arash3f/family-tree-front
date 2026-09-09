import type { ReactNode } from "react";
import styles from "./Section.module.css";

type Props = {
  id: string;
  /**
   * Section ordinal shown in the eyebrow. Pass it already localised — the
   * landing sections number themselves in the reader's digits.
   */
  ordinal?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Staggers the entrance so sections do not all animate on the same frame. */
  delay?: number;
  /** Drops the hairline above the section. The first section under the hero
   * sits on the hero's own gradient, which already reads as a boundary. */
  seamless?: boolean;
  children: ReactNode;
};

export function Section({
  id,
  ordinal,
  eyebrow,
  title,
  subtitle,
  delay = 0,
  seamless = false,
  children,
}: Props) {
  const headingId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`${styles.section} ${seamless ? styles.seamless : ""}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className={styles.inner}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>
            {ordinal ? (
              <span className={styles.ordinal} aria-hidden>
                {ordinal}
              </span>
            ) : null}
            {eyebrow}
          </p>
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </section>
  );
}
