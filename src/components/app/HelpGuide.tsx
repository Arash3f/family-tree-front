"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { HiOutlineBookOpen } from "react-icons/hi2";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import themeStyles from "@/components/theme/ThemeToggle.module.css";
import styles from "./HelpGuide.module.css";

/** Dashboard / account areas. */
const APP_TOPICS = [
  "dashboard",
  "profile",
  "trees",
  "treeSettings",
  "tickets",
  "users",
  "roles",
  "limits",
] as const;

/** Pedigree canvas and tree workspace. */
const PEDIGREE_TOPICS = [
  "canvas",
  "search",
  "people",
  "marriages",
  "parents",
  "fold",
  "timeline",
  "relations",
  "birthdays",
  "excel",
  "export",
  "viewTools",
  "treeTicket",
] as const;

type Props = {
  /** Opens scrolled to the pedigree block when true. */
  focusPedigree?: boolean;
  /** Extra class on the trigger button (e.g. pedigree toolbar). */
  className?: string;
};

export function HelpGuide({ focusPedigree = false, className }: Props) {
  const t = useTranslations("help");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const pedigreeRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => setMounted(true), []);

  useFocusTrap(dialogRef, open, () => setOpen(false));
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !focusPedigree) return;
    const frame = window.requestAnimationFrame(() => {
      if (pedigreeRef.current) {
        pedigreeRef.current.open = true;
        pedigreeRef.current.scrollIntoView({ block: "start" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, focusPedigree]);

  const scrollToSection = (id: string) => {
    const root = dialogRef.current;
    if (!root) return;
    const target = root.querySelector(`#${id}`);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const panel =
    mounted &&
    open &&
    createPortal(
      <div className={styles.root} role="presentation">
        <button
          type="button"
          className={styles.backdrop}
          aria-label={t("close")}
          onClick={() => setOpen(false)}
        />
        <div
          ref={dialogRef}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {t("title")}
            </h2>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
            >
              {t("close")}
            </button>
          </header>

          <p className={styles.lead}>{t("lead")}</p>

          <nav className={styles.jump} aria-label={t("jumpLabel")}>
            <button
              type="button"
              className={styles.jumpLink}
              onClick={() => scrollToSection("help-section-app")}
            >
              {t("sections.app")}
            </button>
            <button
              type="button"
              className={styles.jumpLink}
              onClick={() => scrollToSection("help-section-pedigree")}
            >
              {t("sections.pedigree")}
            </button>
          </nav>

          <details
            id="help-section-app"
            className={styles.section}
            open={!focusPedigree}
          >
            <summary className={styles.sectionSummary}>
              <span className={styles.sectionTitle}>{t("sections.app")}</span>
              <span className={styles.sectionHint}>{t("sections.appLead")}</span>
            </summary>
            <div className={styles.accordionList}>
              {APP_TOPICS.map((key) => (
                <details key={key} className={styles.topic}>
                  <summary className={styles.topicSummary}>
                    {t(`app.${key}.title`)}
                  </summary>
                  <p className={styles.itemBody}>{t(`app.${key}.body`)}</p>
                </details>
              ))}
            </div>
          </details>

          <details
            id="help-section-pedigree"
            ref={pedigreeRef}
            className={styles.section}
            open={focusPedigree}
          >
            <summary className={styles.sectionSummary}>
              <span className={styles.sectionTitle}>
                {t("sections.pedigree")}
              </span>
              <span className={styles.sectionHint}>
                {t("sections.pedigreeLead")}
              </span>
            </summary>
            <div className={styles.accordionList}>
              {PEDIGREE_TOPICS.map((key) => (
                <details key={key} className={styles.topic}>
                  <summary className={styles.topicSummary}>
                    {t(`pedigree.${key}.title`)}
                  </summary>
                  <p className={styles.itemBody}>{t(`pedigree.${key}.body`)}</p>
                </details>
              ))}
            </div>
          </details>
        </div>
      </div>,
      document.body,
    );

  const triggerClass = [
    themeStyles.toggle,
    styles.triggerHelp,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        aria-label={t("open")}
        title={t("open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <HiOutlineBookOpen aria-hidden />
      </button>
      {panel}
    </>
  );
}
