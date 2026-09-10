"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { listFamilyTrees } from "@/lib/auth/client";
import { freeUserAtTreeLimit } from "@/lib/auth/account-limits";
import { useFreeAccountNotice } from "@/lib/auth/useFreeAccountNotice";
import { AuthApiError, Permissions, type FamilyTree } from "@/lib/auth/types";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { OverflowMarquee } from "@/components/ui/OverflowMarquee";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./TreesView.module.css";

type TreeScope = "all" | "owned" | "joined";

export function TreesListView() {
  const t = useTranslations("trees");
  const { status, user: me, hasPermission } = useAuth();
  const { showFreeAccountNotice } = useFreeAccountNotice();
  const router = useRouter();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [scope, setScope] = useState<TreeScope>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canCreate = hasPermission(Permissions.TREE_CREATE);
  const canManage = hasPermission(Permissions.TREE_UPDATE);
  const atFreeTreeLimit = freeUserAtTreeLimit(me, trees);

  const { ownedTrees, joinedTrees } = useMemo(() => {
    const owned: FamilyTree[] = [];
    const joined: FamilyTree[] = [];
    for (const tree of trees) {
      if (me && tree.owner_user_id === me.id) owned.push(tree);
      else joined.push(tree);
    }
    return { ownedTrees: owned, joinedTrees: joined };
  }, [trees, me]);

  const showScopeTabs = ownedTrees.length > 0 && joinedTrees.length > 0;

  const visibleTrees = useMemo(() => {
    if (!showScopeTabs || scope === "all") return trees;
    if (scope === "owned") return ownedTrees;
    return joinedTrees;
  }, [joinedTrees, ownedTrees, scope, showScopeTabs, trees]);

  const emptyMessage = (() => {
    if (!showScopeTabs || scope === "all") return t("empty");
    if (scope === "owned") return t("emptyOwned");
    return t("emptyJoined");
  })();

  useEffect(() => {
    // AuthGuard renders children while bootstrap is still loading; wait for
    // the real session before treating a missing permission as a deny.
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.TREE_READ)) {
      router.replace("/dashboard");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await listFamilyTrees();
        if (!cancelled) setTrees(items);
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
  }, [status, hasPermission, router, t]);

  const onCreateClick = async () => {
    if (atFreeTreeLimit) {
      await showFreeAccountNotice();
      return;
    }
    router.push("/dashboard/trees/new");
  };

  return (
    <Page>
      <PageHeader
        title={t("title")}
        support={t("support")}
        actions={
          canCreate ? (
            <Button type="button" onClick={() => void onCreateClick()}>
              {t("new")}
            </Button>
          ) : null
        }
      />

      {showScopeTabs ? (
        <div
          className={styles.scopeTrack}
          role="tablist"
          aria-label={t("scopeLabel")}
        >
          {(
            [
              ["all", t("scopeAll")],
              ["owned", t("scopeOwned")],
              ["joined", t("scopeJoined")],
            ] as const
          ).map(([value, label]) => {
            const selected = scope === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                className={
                  selected
                    ? `${styles.scopeTab} ${styles.scopeTabActive}`
                    : styles.scopeTab
                }
                onClick={() => setScope(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {loading ? <p className={styles.empty}>{t("loading")}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && !error && visibleTrees.length === 0 ? (
        <Panel quiet className={styles.emptyPanel}>
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>{emptyMessage}</p>
            <p className={styles.emptyHint}>{t("emptyHint")}</p>
            {canCreate ? (
              <Button type="button" onClick={() => void onCreateClick()}>
                {t("new")}
              </Button>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {!loading && !error && visibleTrees.length > 0 ? (
        <Panel
          delay={1}
          title={t("resultCount", { count: visibleTrees.length })}
        >
          <ul className={styles.treeList}>
            {visibleTrees.map((tree) => {
              const owned = Boolean(me && tree.owner_user_id === me.id);
              return (
                <li key={tree.id}>
                  <article className={styles.treeCard}>
                    <Link
                      className={styles.treeMain}
                      href={`/dashboard/trees/${tree.id}`}
                      draggable={false}
                      onContextMenu={(event) => event.preventDefault()}
                    >
                      <p className={styles.treeName}>
                        <OverflowMarquee title={tree.name}>{tree.name}</OverflowMarquee>
                      </p>
                      <div className={styles.badgeRow}>
                        <span
                          className={`${styles.badge} ${
                            owned ? styles.badgeOwned : styles.badgeJoined
                          }`}
                        >
                          {owned ? t("roleOwned") : t("roleJoined")}
                        </span>
                      </div>
                      <span className={styles.treeAction}>{t("open")}</span>
                    </Link>
                    {canManage ? (
                      <Link
                        className={styles.treeSettings}
                        href={`/dashboard/trees/${tree.id}/settings`}
                        draggable={false}
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        {t("manage")}
                      </Link>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </Page>
  );
}
