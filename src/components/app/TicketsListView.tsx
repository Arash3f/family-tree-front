"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { listFamilyTrees, listTickets } from "@/lib/auth/client";
import {
  AuthApiError,
  Permissions,
  ticketQueueRole,
  type FamilyTree,
  type TicketCategory,
  type TicketStatus,
  type TicketSummary,
} from "@/lib/auth/types";
import { Link, useRouter } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./TicketsView.module.css";

type TicketScope = "all" | "mine" | "incoming";

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusTone(status: TicketStatus) {
  if (status === "open") return styles.toneOpen;
  if (status === "in_progress") return styles.toneProgress;
  return styles.toneClosed;
}

function statusBadgeClass(status: TicketStatus) {
  if (status === "open") return styles.badgeOpen;
  if (status === "in_progress") return styles.badgeProgress;
  return styles.badgeClosed;
}

const STATUS_OPTIONS: Array<TicketStatus | "all"> = [
  "all",
  "open",
  "in_progress",
  "closed",
];

const CATEGORY_OPTIONS: Array<TicketCategory | "all"> = [
  "all",
  "general",
  "account",
  "technical",
  "bug",
  "feature_request",
  "other",
];

const SCOPE_OPTIONS: TicketScope[] = ["all", "mine", "incoming"];

const NO_TREES: FamilyTree[] = [];

export function TicketsListView() {
  const t = useTranslations("tickets");
  const locale = useLocale();
  const { status, user, hasPermission } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [fetchedTrees, setFetchedTrees] = useState<FamilyTree[]>([]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | "all">(
    "all",
  );
  const [treeFilter, setTreeFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<TicketScope>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canCreate = hasPermission(Permissions.TICKET_CREATE);
  const canSystemReply = hasPermission(Permissions.TICKET_REPLY);
  const canReadTrees = hasPermission(Permissions.TREE_READ);
  const trees = canReadTrees ? fetchedTrees : NO_TREES;
  const canManageTreeTickets = trees.some((tree) =>
    (tree.my_permissions ?? []).includes("ticket_manage"),
  );
  const canQueue = canSystemReply || canManageTreeTickets;

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.TICKET_READ)) {
      router.replace("/dashboard");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const page = await listTickets({
          status: statusFilter === "all" ? null : statusFilter,
          category: categoryFilter === "all" ? null : categoryFilter,
          familyTreeId: treeFilter === "all" ? null : treeFilter,
        });
        if (!cancelled) setTickets(page.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof AuthApiError ? err.message : t("loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    status,
    categoryFilter,
    hasPermission,
    router,
    statusFilter,
    t,
    treeFilter,
  ]);

  useEffect(() => {
    if (status !== "authenticated" || !canReadTrees) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listFamilyTrees();
        if (!cancelled) setFetchedTrees(items);
      } catch {
        if (!cancelled) setFetchedTrees([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, canReadTrees]);

  const visibleTickets = useMemo(() => {
    if (!canQueue || !user) return tickets;
    if (scopeFilter === "mine") {
      return tickets.filter(
        (ticket) => ticketQueueRole(ticket, user.id) === "mine",
      );
    }
    if (scopeFilter === "incoming") {
      return tickets.filter(
        (ticket) => ticketQueueRole(ticket, user.id) === "incoming",
      );
    }
    return tickets;
  }, [canQueue, scopeFilter, tickets, user]);

  const emptyMessage = (() => {
    if (!canQueue || scopeFilter === "all") return t("empty");
    if (scopeFilter === "mine") return t("emptyMine");
    return t("emptyIncoming");
  })();

  const showSecondaryFilters = canReadTrees && trees.length > 0;

  return (
    <Page>
      <PageHeader
        title={t("title")}
        support={canQueue ? t("supportManage") : t("support")}
        actions={
          canCreate ? (
            <ButtonLink href="/dashboard/tickets/new">{t("new")}</ButtonLink>
          ) : null
        }
      />

      <div className={styles.toolbar} role="search" aria-label={t("filterBarLabel")}>
        {canQueue ? (
          <div
            className={styles.scopeTrack}
            role="tablist"
            aria-label={t("scopeLabel")}
          >
            {SCOPE_OPTIONS.map((scope) => {
              const selected = scopeFilter === scope;
              const label =
                scope === "all"
                  ? t("filterAll")
                  : scope === "mine"
                    ? t("scopeMine")
                    : t("scopeIncoming");
              return (
                <button
                  key={scope}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={
                    selected
                      ? `${styles.scopeTab} ${styles.scopeTabActive}`
                      : styles.scopeTab
                  }
                  onClick={() => setScopeFilter(scope)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          className={styles.statusChips}
          role="group"
          aria-label={t("filterLabel")}
        >
          {STATUS_OPTIONS.map((status) => {
            const selected = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={selected}
                className={
                  selected
                    ? `${styles.statusChip} ${styles.statusChipActive}`
                    : styles.statusChip
                }
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? t("filterAll") : t(`status.${status}`)}
              </button>
            );
          })}
        </div>

        <div className={styles.filterBar}>
          <SelectField
            fieldClassName={styles.filterField}
            label={t("categoryFilterLabel")}
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as TicketCategory | "all")
            }
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category === "all"
                  ? t("filterAll")
                  : t(`category.${category}`)}
              </option>
            ))}
          </SelectField>

          {showSecondaryFilters ? (
            <SelectField
              fieldClassName={styles.filterField}
              label={t("treeFilterLabel")}
              value={treeFilter}
              onChange={(e) => setTreeFilter(e.target.value)}
            >
              <option value="all">{t("filterAll")}</option>
              {trees.map((tree) => (
                <option key={tree.id} value={tree.id}>
                  {tree.name}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>
      </div>

      {loading ? <p className={styles.empty}>{t("loading")}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && !error && visibleTickets.length === 0 ? (
        <Panel quiet className={styles.emptyPanel}>
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>{emptyMessage}</p>
            <p className={styles.emptyHint}>{t("emptyHint")}</p>
            {canCreate ? (
              <ButtonLink href="/dashboard/tickets/new">{t("new")}</ButtonLink>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {visibleTickets.length > 0 ? (
        <Panel
          delay={1}
          title={t("resultCount", { count: visibleTickets.length })}
        >
          <ul className={styles.ticketList}>
            {visibleTickets.map((ticket) => {
              const role = ticketQueueRole(ticket, user?.id);
              const actionLabel =
                ticket.viewer_can_manage &&
                role === "incoming" &&
                ticket.status !== "closed"
                  ? t("replyAction")
                  : t("open");
              const metaParts = [
                t(`category.${ticket.category}`),
                ticket.family_tree_name,
                formatDate(ticket.updated_at ?? ticket.created_at, locale),
              ].filter(Boolean);

              return (
                <li key={ticket.id}>
                  <Link
                    className={`${styles.ticketCard} ${statusTone(ticket.status)}`}
                    href={`/dashboard/tickets/${ticket.id}`}
                  >
                    <div className={styles.ticketBody}>
                      <div className={styles.ticketTop}>
                        <p className={styles.ticketTitle}>{ticket.title}</p>
                        <span className={styles.ticketAction}>{actionLabel}</span>
                      </div>

                      <div className={styles.badgeRow}>
                        <span
                          className={`${styles.badge} ${statusBadgeClass(ticket.status)}`}
                        >
                          {t(`status.${ticket.status}`)}
                        </span>
                        {ticket.viewer_can_manage || canQueue ? (
                          <span
                            className={`${styles.badge} ${
                              role === "mine"
                                ? styles.badgeMine
                                : role === "staff"
                                  ? styles.badgeStaff
                                  : styles.badgeIncoming
                            }`}
                          >
                            {role === "mine"
                              ? t("roleMine")
                              : role === "staff"
                                ? t("roleStaff")
                                : t("roleIncoming")}
                          </span>
                        ) : null}
                      </div>

                      <p className={styles.ticketMeta}>{metaParts.join(" · ")}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </Page>
  );
}
