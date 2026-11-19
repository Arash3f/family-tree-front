"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  createMcpToken,
  fetchMcpStatus,
  fetchMcpTokens,
  revokeMcpToken,
} from "@/lib/auth/client";
import { AuthApiError, type McpStatus, type McpToken } from "@/lib/auth/types";
import { getApiBaseUrl } from "@/lib/api";
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

function resolveMcpEndpoint(status: McpStatus | null): string {
  if (status?.endpoint && /^https?:\/\//i.test(status.endpoint)) {
    return status.endpoint.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const base = getApiBaseUrl();
    if (/^https?:\/\//i.test(base)) {
      return `${base.replace(/\/$/, "")}/mcp`;
    }
    return `${window.location.origin}${base.replace(/\/$/, "")}/mcp`;
  }
  return status?.endpoint || "/mcp";
}

export function ProfileMcpView() {
  const t = useTranslations("profile");
  const locale = useLocale();
  const { confirm } = useFeedback();

  const [status, setStatus] = useState<McpStatus | null>(null);
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Cursor / Claude");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "snippet" | null>(null);

  const endpoint = useMemo(() => resolveMcpEndpoint(status), [status]);

  const connectSnippet = useMemo(() => {
    const tokenPlaceholder = freshToken || "ftmcp_YOUR_TOKEN";
    return JSON.stringify(
      {
        mcpServers: {
          "family-tree": {
            url: endpoint,
            headers: {
              Authorization: `Bearer ${tokenPlaceholder}`,
            },
          },
        },
      },
      null,
      2,
    );
  }, [endpoint, freshToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await fetchMcpStatus();
      setStatus(nextStatus);
      if (nextStatus.enabled) {
        setTokens(await fetchMcpTokens());
      } else {
        setTokens([]);
      }
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("mcpLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setFreshToken(null);
    try {
      const created = await createMcpToken({
        name: name.trim() || "MCP token",
        expires_in_days: status?.default_expires_days ?? 90,
      });
      setFreshToken(created.token);
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("mcpCreateError"));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: McpToken) => {
    const confirmed = await confirm(t("mcpRevokeConfirm"), {
      confirmLabel: t("mcpRevoke"),
    });
    if (!confirmed) return;
    setRevokingId(token.id);
    try {
      await revokeMcpToken(token.id);
      if (freshToken?.startsWith(token.token_prefix)) {
        setFreshToken(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("mcpLoadError"));
    } finally {
      setRevokingId(null);
    }
  };

  const copyText = async (value: string, kind: "token" | "snippet") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(t("mcpCopyError"));
    }
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/profile", label: t("back") }}
        title={t("mcpTitle")}
        support={t("mcpSupport")}
      />

      {loading ? <p className={styles.empty}>{t("loading")}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && status && !status.enabled ? (
        <Alert tone="warning">{t("mcpDisabled")}</Alert>
      ) : null}

      {!loading && status?.enabled ? (
        <>
          <Panel delay={1} title={t("mcpEndpointTitle")} support={t("mcpEndpointSupport")}>
            <p className={styles.mono}>{endpoint}</p>
            <p className={styles.sessionSecondary}>
              {t("mcpToolsLabel")}: {status.tools.join(", ")}
            </p>
          </Panel>

          <Panel delay={2} title={t("mcpCreateTitle")} support={t("mcpCreateSupport")}>
            <div className={styles.sessionItem}>
              <label className={styles.sessionMeta} htmlFor="mcp-token-name">
                <span className={styles.sessionSecondary}>{t("mcpTokenName")}</span>
                <input
                  id="mcp-token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  className={styles.mono}
                  style={{
                    width: "100%",
                    marginTop: "0.35rem",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "8px",
                    border: "1px solid var(--line, #d5dedb)",
                    background: "var(--surface, #fff)",
                  }}
                />
              </label>
              <Button
                variant="primary"
                size="sm"
                loading={creating}
                disabled={creating || tokens.length >= status.max_active_tokens}
                onClick={() => void handleCreate()}
              >
                {creating ? t("working") : t("mcpCreate")}
              </Button>
            </div>
            {tokens.length >= status.max_active_tokens ? (
              <p className={styles.sessionSecondary}>{t("mcpLimitReached")}</p>
            ) : null}
          </Panel>

          {freshToken ? (
            <Panel delay={3} title={t("mcpFreshTitle")} support={t("mcpFreshSupport")}>
              <Alert tone="warning">{t("mcpFreshWarning")}</Alert>
              <p className={styles.mono} style={{ wordBreak: "break-all" }}>
                {freshToken}
              </p>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void copyText(freshToken, "token")}
              >
                {copied === "token" ? t("mcpCopied") : t("mcpCopyToken")}
              </Button>
            </Panel>
          ) : null}

          <Panel delay={4} title={t("mcpSnippetTitle")} support={t("mcpSnippetSupport")}>
            <pre
              className={styles.mono}
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                fontSize: "0.85rem",
              }}
            >
              {connectSnippet}
            </pre>
            <div style={{ marginTop: "0.75rem" }}>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void copyText(connectSnippet, "snippet")}
              >
                {copied === "snippet" ? t("mcpCopied") : t("mcpCopySnippet")}
              </Button>
            </div>
          </Panel>

          <Panel delay={5} title={t("mcpListTitle")} support={t("mcpListSupport")}>
            {tokens.length === 0 ? (
              <p className={styles.empty}>{t("mcpNoTokens")}</p>
            ) : (
              <ul className={styles.sessionList}>
                {tokens.map((token) => (
                  <li key={token.id} className={styles.sessionItem}>
                    <div className={styles.sessionMeta}>
                      <p className={styles.sessionPrimary}>
                        {token.name}{" "}
                        <Badge tone="accent">{token.token_prefix}…</Badge>
                      </p>
                      <p className={styles.sessionSecondary}>
                        {t("expires")}: {formatDate(token.expires_at, locale)}
                      </p>
                      <p className={styles.sessionSecondary}>
                        {t("mcpLastUsed")}: {formatDate(token.last_used_at, locale)}
                      </p>
                    </div>
                    <Button
                      variant="dangerGhost"
                      size="sm"
                      loading={revokingId === token.id}
                      disabled={revokingId === token.id}
                      onClick={() => void handleRevoke(token)}
                    >
                      {revokingId === token.id ? t("working") : t("mcpRevoke")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      ) : null}
    </Page>
  );
}
