"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { createFamilyTree, listFamilyTrees } from "@/lib/auth/client";
import { freeUserAtTreeLimit } from "@/lib/auth/account-limits";
import { useFreeAccountNotice } from "@/lib/auth/useFreeAccountNotice";
import { AuthApiError, Permissions, getApiErrorMessage } from "@/lib/auth/types";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./TreesView.module.css";

export function TreeCreateView() {
  const t = useTranslations("trees");
  const { user, hasPermission } = useAuth();
  const { showFreeAccountNotice, handleMaybeFreeLimit } = useFreeAccountNotice();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = name.trim().length > 0;

  useEffect(() => {
    if (!hasPermission(Permissions.TREE_CREATE)) {
      router.replace("/dashboard/trees");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const trees = await listFamilyTrees();
        if (cancelled) return;
        if (freeUserAtTreeLimit(user, trees)) {
          await showFreeAccountNotice();
          if (!cancelled) router.replace("/dashboard/trees");
        }
      } catch {
        // If the pre-check fails, still allow the form; backend enforces.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPermission, router, user, showFreeAccountNotice]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const trees = await listFamilyTrees();
      if (freeUserAtTreeLimit(user, trees)) {
        await showFreeAccountNotice();
        setBusy(false);
        return;
      }
      const tree = await createFamilyTree({ name: name.trim() });
      router.replace(`/dashboard/trees/${tree.id}`);
    } catch (err) {
      const handled = await handleMaybeFreeLimit(
        err,
        err instanceof AuthApiError
          ? err.message
          : getApiErrorMessage(err, t("createError")),
      );
      if (!handled) {
        setError(err instanceof AuthApiError ? err.message : t("createError"));
      }
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <PageHeader
        back={{ href: "/dashboard/trees", label: t("back") }}
        title={t("createTitle")}
        support={t("createSupport")}
      />

      <Panel quiet className={styles.createNote}>
        <p className={styles.createNoteTitle}>{t("createHintTitle")}</p>
        <p className={styles.createNoteBody}>{t("createHint")}</p>
      </Panel>

      <Panel delay={1}>
        <Form columns="single" onSubmit={onSubmit}>
          <TextField
            label={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={100}
            disabled={busy}
            autoComplete="off"
            hint={t("nameHint")}
          />

          {error ? <Alert tone="error">{error}</Alert> : null}

          <FormActions>
            <Button
              type="submit"
              loading={busy}
              disabled={!canSubmit || busy}
            >
              {busy ? t("creating") : t("createSubmit")}
            </Button>
          </FormActions>
        </Form>
      </Panel>
    </Page>
  );
}
