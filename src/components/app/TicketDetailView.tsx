"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  addTicketMessage,
  getTicket,
  updateTicketStatus,
} from "@/lib/auth/client";
import {
  AuthApiError,
  Permissions,
  ticketQueueRole,
  type TicketDetail,
  type TicketStatus,
} from "@/lib/auth/types";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./TicketsView.module.css";

type Props = {
  ticketId: string;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status: TicketStatus) {
  if (status === "open") return styles.badgeOpen;
  if (status === "in_progress") return styles.badgeProgress;
  return styles.badgeClosed;
}

const ALL_STATUSES: TicketStatus[] = ["open", "in_progress", "closed"];

export function TicketDetailView({ ticketId }: Props) {
  const t = useTranslations("tickets");
  const locale = useLocale();
  const { status, user, hasPermission } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [statusDraft, setStatusDraft] = useState<TicketStatus>("open");
  const [loading, setLoading] = useState(true);
  const [replyBusy, setReplyBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastMessageRef = useRef<HTMLElement | null>(null);
  const replyPanelRef = useRef<HTMLElement | null>(null);
  const lastMessageId = ticket?.messages.at(-1)?.id ?? null;

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.TICKET_READ)) {
      router.replace("/dashboard");
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTicket(ticketId);
        setTicket(data);
        setStatusDraft(data.status);
      } catch (err) {
        setError(err instanceof AuthApiError ? err.message : t("loadError"));
        setTicket(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [status, hasPermission, router, ticketId, t]);

  useEffect(() => {
    if (!lastMessageId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = replyPanelRef.current ?? lastMessageRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ticket?.id, lastMessageId]);

  const onReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticket || ticket.status === "closed") return;
    const body = reply.trim();
    if (!body || replyBusy) return;
    setReply("");
    setReplyBusy(true);
    setError(null);
    try {
      const created = await addTicketMessage(ticketId, body);
      setTicket((current) =>
        current
          ? {
              ...current,
              messages: [...current.messages, created],
              updated_at: created.created_at ?? current.updated_at,
            }
          : current,
      );
    } catch (err) {
      setReply((current) => current || body);
      setError(err instanceof AuthApiError ? err.message : t("replyError"));
    } finally {
      setReplyBusy(false);
    }
  };

  const onStatusSave = async () => {
    if (!ticket || statusDraft === ticket.status) return;
    setStatusBusy(true);
    setError(null);
    try {
      const updated = await updateTicketStatus(ticketId, statusDraft);
      setTicket((current) =>
        current
          ? {
              ...current,
              status: updated.status,
              updated_at: updated.updated_at,
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("statusError"));
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return <p className={styles.empty}>{t("loading")}</p>;
  }

  if (!ticket) {
    return (
      <Page narrow>
        <PageHeader
          back={{ href: "/dashboard/tickets", label: t("back") }}
          title={t("notFound")}
        />
        <Alert tone="error">{error ?? t("notFound")}</Alert>
      </Page>
    );
  }

  const closed = ticket.status === "closed";
  const isOwner = ticket.created_by_user_id === user?.id;
  const canReply = ticket.viewer_can_manage || isOwner;
  const canManage = ticket.viewer_can_manage;
  const queueRole = ticketQueueRole(ticket, user?.id);

  const messageAuthorLabel = (authorUserId: string) => {
    const mine = authorUserId === user?.id;
    const fromRequester = authorUserId === ticket.created_by_user_id;
    if (mine) {
      return isOwner ? t("you") : t("youAsSupport");
    }
    if (fromRequester) return t("requester");
    return t("supportStaff");
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/tickets", label: t("back") }}
        title={ticket.title}
      />

      <Panel delay={1}>
        <div className={styles.badgeRow}>
          {canManage ? (
            <span
              className={`${styles.badge} ${
                queueRole === "mine"
                  ? styles.badgeMine
                  : queueRole === "staff"
                    ? styles.badgeStaff
                    : styles.badgeIncoming
              }`}
            >
              {queueRole === "mine"
                ? t("roleMine")
                : queueRole === "staff"
                  ? t("roleStaff")
                  : t("roleIncoming")}
            </span>
          ) : null}
          <span className={`${styles.badge} ${statusClass(ticket.status)}`}>
            {t(`status.${ticket.status}`)}
          </span>
          <span className={`${styles.badge} ${styles.badgeCategory}`}>
            {t(`category.${ticket.category}`)}
          </span>
        </div>

        <dl className={styles.metaGrid}>
          {ticket.family_tree_name ? (
            <div className={styles.metaItem}>
              <dt>{t("relatedTree")}</dt>
              <dd>{ticket.family_tree_name}</dd>
            </div>
          ) : null}
          <div className={styles.metaItem}>
            <dt>{t("createdAt")}</dt>
            <dd>{formatDate(ticket.created_at, locale)}</dd>
          </div>
        </dl>

        {canManage ? (
          <>
            <p className={styles.roleHint}>
              {queueRole === "mine"
                ? t("roleMineHint")
                : queueRole === "staff"
                  ? t("roleStaffHint")
                  : t("roleIncomingHint")}
            </p>
            <div className={styles.statusBar}>
              <SelectField
                fieldClassName={styles.statusField}
                label={t("changeStatus")}
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as TicketStatus)}
                disabled={statusBusy}
              >
                {ALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </SelectField>
              <Button
                variant="ghost"
                loading={statusBusy}
                disabled={statusBusy || statusDraft === ticket.status}
                onClick={() => void onStatusSave()}
              >
                {statusBusy ? t("saving") : t("saveStatus")}
              </Button>
            </div>
          </>
        ) : null}
      </Panel>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Panel delay={2} title={t("threadLabel")}>
        <div className={styles.thread}>
          {ticket.messages.map((message, index) => {
            const mine = message.author_user_id === user?.id;
            const isLast = index === ticket.messages.length - 1;
            return (
              <article
                key={message.id}
                ref={isLast ? lastMessageRef : undefined}
                className={`${styles.message} ${mine ? styles.messageMine : ""}`}
              >
                <div className={styles.messageMeta}>
                  <span>{messageAuthorLabel(message.author_user_id)}</span>
                  <span>{formatDate(message.created_at, locale)}</span>
                </div>
                <p className={styles.messageBody}>{message.body}</p>
              </article>
            );
          })}
        </div>
      </Panel>

      {canReply ? (
        <section
          ref={replyPanelRef}
          className={styles.replyPanel}
          aria-label={t("replySectionTitle")}
        >
          <div className={styles.replyPanelHeader}>
            <h2 className={styles.sectionTitle}>{t("replySectionTitle")}</h2>
            <p className={styles.replyPanelSupport}>
              {closed ? t("closedHint") : t("replySectionSupport")}
            </p>
          </div>
          <Form
            columns="single"
            className={styles.replyForm}
            onSubmit={onReply}
          >
            <TextAreaField
              label={t("replyLabel")}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              required
              disabled={closed}
              placeholder={closed ? t("closedHint") : t("replyPlaceholder")}
            />
            <FormActions>
              <Button
                type="submit"
                loading={replyBusy}
                disabled={replyBusy || closed}
              >
                {replyBusy ? t("sending") : t("sendReply")}
              </Button>
            </FormActions>
          </Form>
        </section>
      ) : null}
    </Page>
  );
}
