"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  clearSession,
  fetchMySessions,
  revokeMySession,
} from "@/lib/auth/client";
import { AuthApiError, type UserSession } from "@/lib/auth/types";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Alert, Badge } from "@/components/ui/Feedback";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./ProfileView.module.css";

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ProfileSessionsView() {
  const t = useTranslations("profile");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Kept awaitable so the revoke handler can hold its busy state until the
  // refreshed list lands.
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      setSessions(await fetchMySessions());
    } catch (err) {
      setSessionsError(
        err instanceof AuthApiError ? err.message : t("sessionsLoadError"),
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void (async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        setSessions(await fetchMySessions());
      } catch (err) {
        setSessionsError(
          err instanceof AuthApiError ? err.message : t("sessionsLoadError"),
        );
      } finally {
        setSessionsLoading(false);
      }
    })();
  }, [t]);

  const handleRevoke = async (session: UserSession) => {
    const confirmed = await confirm(
      session.is_current ? t("revokeCurrentConfirm") : t("revokeConfirm"),
      { confirmLabel: t("revokeSession") },
    );
    if (!confirmed) return;

    setRevokingId(session.id);
    try {
      await revokeMySession(session.id);
      if (session.is_current) {
        clearSession();
        router.replace("/login");
        return;
      }
      await loadSessions();
      await refreshUser();
    } catch (err) {
      setSessionsError(
        err instanceof AuthApiError ? err.message : t("sessionsLoadError"),
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/profile", label: t("back") }}
        title={t("sessionsTitle")}
        support={t("sessionsSupport")}
      />

      {sessionsLoading ? <p className={styles.empty}>{t("loading")}</p> : null}
      {sessionsError ? <Alert tone="error">{sessionsError}</Alert> : null}

      {!sessionsLoading && sessions.length === 0 ? (
        <p className={styles.empty}>{t("noSessions")}</p>
      ) : null}

      {sessions.length > 0 ? (
        <Panel delay={1}>
          <ul className={styles.sessionList}>
            {sessions.map((session) => (
              <li key={session.id} className={styles.sessionItem}>
                <div className={styles.sessionMeta}>
                  <p className={styles.sessionPrimary}>
                    {session.user_agent || t("unknownDevice")}
                    {session.is_current ? (
                      <Badge tone="accent">{t("currentSession")}</Badge>
                    ) : null}
                  </p>
                  <p className={styles.sessionSecondary}>
                    {session.ip_address || t("unknownIp")} ·{" "}
                    {formatDate(session.created_at, locale)}
                  </p>
                  <p className={styles.sessionSecondary}>
                    {t("expires")}: {formatDate(session.expires_at, locale)}
                  </p>
                </div>
                <Button
                  variant="dangerGhost"
                  size="sm"
                  loading={revokingId === session.id}
                  disabled={revokingId === session.id}
                  onClick={() => void handleRevoke(session)}
                >
                  {revokingId === session.id ? t("working") : t("revokeSession")}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </Page>
  );
}
