"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { getApiDocsUrl } from "@/lib/api";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Link } from "@/i18n/navigation";
import styles from "./Header.module.css";

const DESKTOP_MQ = "(min-width: 920px)";
const SECTION_IDS = ["features", "updates", "architecture", "author"] as const;
type SectionId = (typeof SECTION_IDS)[number];
const emptySubscribe = () => () => {};

function readHeaderOffset() {
  const pad = Number.parseFloat(
    getComputedStyle(document.documentElement).scrollPaddingTop,
  );
  return Number.isFinite(pad) ? pad : 88;
}

export function Header() {
  const t = useTranslations("nav");
  const brand = useTranslations("hero");
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const panelId = useId();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingSectionRef = useRef<SectionId | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    const measureActive = (): SectionId | null => {
      const marker = window.scrollY + readHeaderOffset() + 12;
      let current: SectionId | null = null;

      for (const id of SECTION_IDS) {
        const section = document.getElementById(id);
        if (!section) continue;
        const top = section.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) current = id;
      }

      return current;
    };

    const updateActive = () => {
      frame = 0;
      const current = measureActive();
      const pending = pendingSectionRef.current;

      if (pending) {
        const pendingIdx = SECTION_IDS.indexOf(pending);
        const currentIdx = current ? SECTION_IDS.indexOf(current) : -1;
        if (currentIdx >= pendingIdx) {
          pendingSectionRef.current = null;
          setActiveSection(current);
        } else {
          setActiveSection(pending);
        }
        return;
      }

      setActiveSection(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActive);
    };

    const onScrollEnd = () => {
      pendingSectionRef.current = null;
      updateActive();
    };

    const tryInit = () => {
      if (cancelled) return;
      const ready = SECTION_IDS.some((id) => document.getElementById(id));
      if (!ready) {
        frame = window.requestAnimationFrame(tryInit);
        return;
      }
      updateActive();
    };

    tryInit();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("hashchange", onScroll);
    window.addEventListener("scrollend", onScrollEnd);

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("hashchange", onScroll);
      window.removeEventListener("scrollend", onScrollEnd);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const main = document.getElementById("main");
    const footer = document.querySelector("footer");
    main?.setAttribute("inert", "");
    footer?.setAttribute("inert", "");

    const panel = panelRef.current;
    const menuButton = menuBtnRef.current;
    const focusables = panel
      ? Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
      : [];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!window.matchMedia("(pointer: coarse)").matches) {
      first?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || focusables.length === 0) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      window.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  const scrollToSection = (id: SectionId) => {
    pendingSectionRef.current = id;
    setActiveSection(id);
    close();

    requestAnimationFrame(() => {
      const section = document.getElementById(id);
      if (!section) return;

      section.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    });
  };

  const navItems = SECTION_IDS.map((id) => ({
    id,
    href: `#${id}`,
    label: t(id),
  }));

  const sectionLinkProps = (id: SectionId) => ({
    className: activeSection === id ? styles.active : undefined,
    "aria-current": activeSection === id ? ("true" as const) : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      scrollToSection(id);
    },
  });

  const menuOverlay =
    mounted &&
    open &&
    createPortal(
      <>
        <div
          className={styles.backdrop}
          onClick={close}
          aria-hidden="false"
        />
        <div
          ref={panelRef}
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label={t("menuOpen")}
        >
          <nav className={styles.navMobile} aria-label={t("primary")}>
            {navItems.map(({ id, href, label }) => (
              <a key={id} href={href} {...sectionLinkProps(id)}>
                {label}
              </a>
            ))}
            <a
              className={styles.docs}
              href={getApiDocsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              {t("apiDocs")}
            </a>
            <Link className={styles.signIn} href="/login" onClick={close}>
              {t("signIn")}
            </Link>
          </nav>
          <div className={styles.panelControls}>
            <LocaleSwitcher />
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <a className={styles.skip} href="#main">
        {t("skipToContent")}
      </a>
      <header className={`${styles.header} ${open ? styles.headerOpen : ""}`}>
        <Link
          className={styles.brand}
          href="/#top"
          onClick={() => {
            pendingSectionRef.current = null;
            setActiveSection(null);
            close();
          }}
        >
          {brand("brand")}
        </Link>

        <nav className={styles.navDesktop} aria-label={t("primary")}>
          {navItems.map(({ id, href, label }) => (
            <a key={id} href={href} {...sectionLinkProps(id)}>
              {label}
            </a>
          ))}
          <a
            className={styles.docs}
            href={getApiDocsUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("apiDocs")}
          </a>
          <Link className={styles.signIn} href="/login">
            {t("signIn")}
          </Link>
        </nav>

        <div className={styles.controls}>
          <div className={styles.desktopOnly}>
            <LocaleSwitcher />
          </div>
          <ThemeToggle />
          <button
            ref={menuBtnRef}
            type="button"
            className={`${styles.menuBtn} ${open ? styles.menuBtnOpen : ""}`}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? t("menuClose") : t("menuOpen")}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
          </button>
        </div>
      </header>
      {menuOverlay}
    </>
  );
}
