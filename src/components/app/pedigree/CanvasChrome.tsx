"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  HiOutlineArrowUturnLeft,
  HiOutlineEllipsisVertical,
  HiOutlineMap,
  HiOutlineTicket,
} from "react-icons/hi2";
import type { Person } from "@/lib/auth/types";
import { BirthdayCalendarButton } from "./LazyBirthdayCalendar";
import styles from "./CanvasChrome.module.css";

type Props = {
  /** Already-formatted "{n} people" label for the fixed counter chip. */
  peopleLabel: string;
  persons: Person[];
  canViewBirthDate: boolean;
  birthdayOpen: boolean;
  onBirthdayOpenChange: (open: boolean) => void;
  onSelectPerson: (personId: string) => void;
  /** `null` hides the tool — the caller owns the permission / state checks. */
  onCreateTicket: (() => void) | null;
  onExitBranch: (() => void) | null;
  onExitPathfinding: (() => void) | null;
  onShowPathPanel: (() => void) | null;
};

/**
 * Fixed canvas chrome — the three standing tools (people count, birthday
 * calendar, ticket) in the frame corner, plus the route tools that appear
 * while a branch or a path is shown.
 *
 * On a phone the standing tools fold behind a ⋮ trigger and the route tools
 * move to an icon-only dock at the bottom of the frame, so neither strip
 * covers the tree.
 *
 * @param props - Labels, data and handlers of the chrome tools; a `null`
 *   handler drops its tool from the strip.
 *
 * @returns The chrome column and, on a phone, the bottom route dock.
 */
export function CanvasChrome({
  peopleLabel,
  persons,
  canViewBirthDate,
  birthdayOpen,
  onBirthdayOpenChange,
  onSelectPerson,
  onCreateTicket,
  onExitBranch,
  onExitPathfinding,
  onShowPathPanel,
}: Props) {
  const t = useTranslations("pedigree");
  const [phone, setPhone] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 719.98px)");
    const sync = () => {
      setPhone(mq.matches);
      if (!mq.matches) setToolsOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const standingVisible = !phone || toolsOpen;

  const routeTools = (
    <>
      {onExitBranch ? (
        <button
          type="button"
          className={phone ? `${styles.pathBtn} ${styles.pathBtnIcon}` : styles.pathBtn}
          title={t("branchPreviewExit")}
          aria-label={t("branchPreviewExit")}
          onClick={onExitBranch}
        >
          <HiOutlineArrowUturnLeft aria-hidden />
          {phone ? null : <span>{t("branchPreviewExit")}</span>}
        </button>
      ) : null}
      {onExitPathfinding ? (
        <button
          type="button"
          className={phone ? `${styles.pathBtn} ${styles.pathBtnIcon}` : styles.pathBtn}
          title={t("exitPathfinding")}
          aria-label={t("exitPathfinding")}
          onClick={onExitPathfinding}
        >
          <HiOutlineArrowUturnLeft aria-hidden />
          {phone ? null : <span>{t("exitPathfinding")}</span>}
        </button>
      ) : null}
      {onShowPathPanel ? (
        <button
          type="button"
          className={phone ? `${styles.pathBtn} ${styles.pathBtnIcon}` : styles.pathBtn}
          title={t("showPathfindingPanel")}
          aria-label={t("showPathfindingPanel")}
          onClick={onShowPathPanel}
        >
          <HiOutlineMap aria-hidden />
          {phone ? null : <span>{t("showPathfindingPanel")}</span>}
        </button>
      ) : null}
    </>
  );

  const hasRouteTools = Boolean(onExitBranch || onExitPathfinding || onShowPathPanel);

  return (
    <>
      <div className={styles.corner}>
        {phone ? (
          <button
            type="button"
            className={toolsOpen ? `${styles.toolsToggle} ${styles.toolsToggleOpen}` : styles.toolsToggle}
            aria-expanded={toolsOpen}
            aria-label={toolsOpen ? t("canvasToolsHide") : t("canvasToolsShow")}
            title={toolsOpen ? t("canvasToolsHide") : t("canvasToolsShow")}
            onClick={() => setToolsOpen((open) => !open)}
          >
            <HiOutlineEllipsisVertical aria-hidden />
          </button>
        ) : null}

        {standingVisible ? (
          <div className={styles.standing}>
            <div className={styles.personCount} title={peopleLabel} aria-label={peopleLabel}>
              {peopleLabel}
            </div>
            <BirthdayCalendarButton
              prominent
              people={persons}
              canViewBirthDate={canViewBirthDate}
              open={birthdayOpen}
              onOpenChange={(open) => {
                // The calendar covers the screen on a phone — fold the strip
                // back so it is not waiting underneath.
                if (open) setToolsOpen(false);
                onBirthdayOpenChange(open);
              }}
              onSelectPerson={onSelectPerson}
            />
            {onCreateTicket ? (
              <button
                type="button"
                className={styles.ticketBtn}
                title={t("createTicket")}
                aria-label={t("createTicket")}
                onClick={onCreateTicket}
              >
                <HiOutlineTicket aria-hidden />
                <span>{t("createTicket")}</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {phone ? null : routeTools}
      </div>

      {phone && hasRouteTools ? (
        <div className={styles.routeDock}>{routeTools}</div>
      ) : null}
    </>
  );
}
