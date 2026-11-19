"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  decideOAuthConsent,
  fetchOAuthConsentRequest,
} from "@/lib/auth/client";
import { AuthApiError, type OAuthConsentRequest } from "@/lib/auth/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./ProfileView.module.css";

export function OAuthConsentView() {
  const t = useTranslations("oauth");
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request");

  const [detail, setDetail] = useState<OAuthConsentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError(t("missingRequest"));
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        setDetail(await fetchOAuthConsentRequest(requestId));
      } catch (err) {
        setError(err instanceof AuthApiError ? err.message : t("loadError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId, t]);

  const decide = async (approve: boolean) => {
    if (!requestId) return;
    setBusy(true);
    setError(null);
    try {
      const { redirect_to } = await decideOAuthConsent(requestId, approve);
      window.location.assign(redirect_to);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("decideError"));
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title={t("title")} support={t("support")} />

      {loading ? <p className={styles.empty}>{t("loading")}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {detail ? (
        <Panel delay={1}>
          <dl className={styles.list}>
            <div>
              <dt>{t("client")}</dt>
              <dd>{detail.client_name}</dd>
            </div>
            <div className={styles.listWide}>
              <dt>{t("clientId")}</dt>
              <dd className={styles.mono}>{detail.client_id}</dd>
            </div>
            <div className={styles.listWide}>
              <dt>{t("resource")}</dt>
              <dd className={styles.mono}>{detail.resource}</dd>
            </div>
            <div>
              <dt>{t("scope")}</dt>
              <dd>{detail.scope}</dd>
            </div>
          </dl>

          <p className={styles.sessionSecondary} style={{ marginTop: "1rem" }}>
            {t("permissionNote")}
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginTop: "1.25rem",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="primary"
              loading={busy}
              disabled={busy}
              onClick={() => void decide(true)}
            >
              {busy ? t("working") : t("approve")}
            </Button>
            <Button
              variant="dangerGhost"
              disabled={busy}
              onClick={() => void decide(false)}
            >
              {t("deny")}
            </Button>
          </div>
        </Panel>
      ) : null}
    </Page>
  );
}
