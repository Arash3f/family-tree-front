"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { HiOutlineQuestionMarkCircle } from "react-icons/hi2";
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

const UPDATES = ["u1", "u2", "u3", "u4"] as const;

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
  const pedigreeRef = useRef<HTMLElement>(null);

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
      pedigreeRef.current?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, focusPedigree]);

  const scrollToSection = (id: string) => {
    const root = dialogRef.current;
    if (!root) return;
    const target = root.querySelector(`#${id}`);
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
            <button
              type="button"
              className={styles.jumpLink}
              onClick={() => scrollToSection("help-section-updates")}
            >
              {t("sections.updates")}
            </button>
          </nav>

          <section
            id="help-section-app"
            className={styles.section}
            aria-labelledby={`${titleId}-app-title`}
          >
            <h3 id={`${titleId}-app-title`} className={styles.sectionTitle}>
              {t("sections.app")}
            </h3>
            <p className={styles.sectionLead}>{t("sections.appLead")}</p>
            <ul className={styles.list}>
              {APP_TOPICS.map((key) => (
                <li key={key} className={styles.item}>
                  <p className={styles.itemTitle}>{t(`app.${key}.title`)}</p>
                  <p className={styles.itemBody}>{t(`app.${key}.body`)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section
            id="help-section-pedigree"
            ref={pedigreeRef}
            className={styles.section}
            aria-labelledby={`${titleId}-pedigree-title`}
          >
            <h3 id={`${titleId}-pedigree-title`} className={styles.sectionTitle}>
              {t("sections.pedigree")}
            </h3>
            <p className={styles.sectionLead}>{t("sections.pedigreeLead")}</p>
            <ul className={styles.list}>
              {PEDIGREE_TOPICS.map((key) => (
                <li key={key} className={styles.item}>
                  <p className={styles.itemTitle}>{t(`pedigree.${key}.title`)}</p>
                  <p className={styles.itemBody}>{t(`pedigree.${key}.body`)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section
            id="help-section-updates"
            className={styles.section}
            aria-labelledby={`${titleId}-updates-title`}
          >
            <h3 id={`${titleId}-updates-title`} className={styles.sectionTitle}>
              {t("sections.updates")}
            </h3>
            <ul className={styles.updates}>
              {UPDATES.map((key) => (
                <li key={key} className={styles.item}>
                  <span className={styles.updateDate}>
                    {t(`updates.${key}.date`)}
                  </span>
                  <p className={styles.itemTitle}>{t(`updates.${key}.title`)}</p>
                  <p className={styles.itemBody}>{t(`updates.${key}.body`)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>,
      document.body,
    );

  const triggerClass = [themeStyles.toggle, className].filter(Boolean).join(" ");

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
        <HiOutlineQuestionMarkCircle aria-hidden />
      </button>
      {panel}
    </>
  );
}
