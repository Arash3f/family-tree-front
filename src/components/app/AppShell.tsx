"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { Button } from "@/components/ui/Button";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import { Permissions } from "@/lib/auth/types";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { DashboardBackdrop } from "./DashboardBackdrop";
import styles from "./AppShell.module.css";

type Props = {
  children: ReactNode;
};

/** Mirrors the `min-width: 920px` branch in AppShell.module.css. */
const DESKTOP_QUERY = "(min-width: 920px)";

/**
 * Below the breakpoint the sidebar is an off-canvas drawer, and whether it is
 * open has to be known in JS as well as CSS: a drawer parked with `transform`
 * is invisible but still focusable, so it needs `inert` when closed.
 */
function useIsDesktopNav(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia(DESKTOP_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    // The server cannot know the viewport. Assuming mobile keeps the drawer
    // inert in the first paint, which is the safe direction to be wrong in.
    () => false,
  );
}

export function AppShell({ children }: Props) {
  const t = useTranslations("app");
  const { confirm } = useFeedback();
  const { user, logout, logoutAll, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<"logout" | "logoutAll" | null>(null);
  const navId = useId();
  const sidebarRef = useRef<HTMLElement>(null);
  const isDesktopNav = useIsDesktopNav();
  const drawerOpen = menuOpen && !isDesktopNav;

  // Crossing the desktop breakpoint must drop the leftover open flag, otherwise
  // shrinking back to a drawer would reopen it.
  if (isDesktopNav && menuOpen) {
    setMenuOpen(false);
  }

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useFocusTrap(sidebarRef, drawerOpen, closeMenu);
  useScrollLock(drawerOpen);

  const canReadUsers = hasPermission(Permissions.USER_READ);
  const canReadRoles = hasPermission(Permissions.ROLE_READ);
  const canReadTickets = hasPermission(Permissions.TICKET_READ);
  const canReadTrees = hasPermission(Permissions.TREE_READ);

  const handleLogout = async () => {
    setBusy("logout");
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(null);
    }
  };

  const handleLogoutAll = async () => {
    const confirmed = await confirm(t("logoutAllConfirm"), {
      confirmLabel: t("logoutAll"),
    });
    if (!confirmed) return;

    setBusy("logoutAll");
    try {
      await logoutAll();
      router.replace("/login");
    } finally {
      setBusy(null);
    }
  };

  const homeActive = pathname === "/dashboard";
  const profileRootActive = pathname === "/dashboard/profile";
  const profilePermissionsActive = pathname.startsWith(
    "/dashboard/profile/permissions",
  );
  const profilePasswordActive = pathname.startsWith("/dashboard/profile/password");
  const profileSessionsActive = pathname.startsWith("/dashboard/profile/sessions");
  const profileGroupOpen =
    profileRootActive ||
    profilePermissionsActive ||
    profilePasswordActive ||
    profileSessionsActive;
  const usersActive = pathname.startsWith("/dashboard/users");
  const rolesActive = pathname.startsWith("/dashboard/roles");
  const ticketsActive = pathname.startsWith("/dashboard/tickets");
  const treesActive = pathname.startsWith("/dashboard/trees");
  const wideMain =
    /^\/dashboard\/trees\/[^/]+$/.test(pathname) ||
    /^\/dashboard\/trees\/[^/]+\/settings$/.test(pathname);
  const treeWorkspace =
    /^\/dashboard\/trees\/[^/]+$/.test(pathname);

  return (
    <div
      className={treeWorkspace ? `${styles.shell} ${styles.shellFill}` : styles.shell}
    >
      {!treeWorkspace ? <DashboardBackdrop /> : null}
      <header className={styles.topbar} data-app-topbar>
        <button
          type="button"
          className={styles.menuBtn}
          aria-expanded={menuOpen}
          aria-controls={navId}
          aria-label={menuOpen ? t("menuClose") : t("menuOpen")}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span aria-hidden />
          <span aria-hidden />
          <span aria-hidden />
        </button>

        <Link className={styles.brand} href="/dashboard" onClick={closeMenu}>
          {t("brand")}
        </Link>

        <div className={styles.topControls}>
          <span className={styles.userChip} title={user?.fullname}>
            {user?.fullname}
          </span>
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {drawerOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={t("menuClose")}
          onClick={closeMenu}
        />
      ) : null}

      <aside
        id={navId}
        ref={sidebarRef}
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
        inert={!isDesktopNav && !menuOpen}
      >
        <nav className={styles.nav} aria-label={t("navLabel")}>
          <Link
            href="/dashboard"
            className={homeActive ? styles.navActive : undefined}
            aria-current={homeActive ? "page" : undefined}
            onClick={closeMenu}
          >
            {t("home")}
          </Link>

          <div
            className={`${styles.navGroup}${profileGroupOpen ? ` ${styles.navGroupOpen}` : ""}`}
          >
            <Link
              href="/dashboard/profile"
              className={`${styles.navParent}${profileRootActive ? ` ${styles.navActive}` : ""}`}
              aria-current={profileRootActive ? "page" : undefined}
              onClick={closeMenu}
            >
              {t("profile")}
            </Link>
            <div className={styles.navSub} aria-label={t("profile")}>
              <Link
                href="/dashboard/profile/permissions"
                className={profilePermissionsActive ? styles.navActive : undefined}
                aria-current={profilePermissionsActive ? "page" : undefined}
                onClick={closeMenu}
              >
                {t("profilePermissions")}
              </Link>
              <Link
                href="/dashboard/profile/password"
                className={profilePasswordActive ? styles.navActive : undefined}
                aria-current={profilePasswordActive ? "page" : undefined}
                onClick={closeMenu}
              >
                {t("profilePassword")}
              </Link>
              <Link
                href="/dashboard/profile/sessions"
                className={profileSessionsActive ? styles.navActive : undefined}
                aria-current={profileSessionsActive ? "page" : undefined}
                onClick={closeMenu}
              >
                {t("profileSessions")}
              </Link>
            </div>
          </div>

          {canReadTrees ? (
            <Link
              href="/dashboard/trees"
              className={treesActive ? styles.navActive : undefined}
              aria-current={treesActive ? "page" : undefined}
              onClick={closeMenu}
            >
              {t("trees")}
            </Link>
          ) : null}
          {canReadUsers ? (
            <Link
              href="/dashboard/users"
              className={usersActive ? styles.navActive : undefined}
              aria-current={usersActive ? "page" : undefined}
              onClick={closeMenu}
            >
              {t("users")}
            </Link>
          ) : null}
          {canReadRoles ? (
            <Link
              href="/dashboard/roles"
              className={rolesActive ? styles.navActive : undefined}
              aria-current={rolesActive ? "page" : undefined}
              onClick={closeMenu}
            >
              {t("roles")}
            </Link>
          ) : null}
          {canReadTickets ? (
            <Link
              href="/dashboard/tickets"
              className={ticketsActive ? styles.navActive : undefined}
              aria-current={ticketsActive ? "page" : undefined}
              onClick={closeMenu}
            >
              {t("tickets")}
            </Link>
          ) : null}
        </nav>

        <div className={styles.sessionActions}>
          <Button
            variant="ghost"
            className={styles.sessionBtn}
            loading={busy === "logout"}
            disabled={busy !== null}
            onClick={() => {
              closeMenu();
              void handleLogout();
            }}
          >
            {busy === "logout" ? t("working") : t("logout")}
          </Button>
          <Button
            variant="dangerGhost"
            className={styles.sessionBtn}
            loading={busy === "logoutAll"}
            disabled={busy !== null}
            onClick={() => {
              closeMenu();
              void handleLogoutAll();
            }}
          >
            {busy === "logoutAll" ? t("working") : t("logoutAll")}
          </Button>
        </div>
      </aside>

      <main
        className={[
          styles.main,
          wideMain ? styles.mainWide : "",
          treeWorkspace ? styles.mainFill : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </main>
    </div>
  );
}
