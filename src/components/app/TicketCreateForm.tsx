"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { createTicket, listFamilyTrees } from "@/lib/auth/client";
import {
  AuthApiError,
  Permissions,
  type FamilyTree,
  type TicketCategory,
  type TicketDetail,
} from "@/lib/auth/types";
import { Button } from "@/components/ui/Button";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Form, FormActions, FormRow } from "@/components/ui/Form";

const NO_TREES: FamilyTree[] = [];

const CATEGORIES: TicketCategory[] = [
  "general",
  "account",
  "technical",
  "bug",
  "feature_request",
  "other",
];

type Props = {
  preferredFamilyTreeId?: string;
  /** When set, the tree selector stays locked to this tree. */
  lockTreeId?: string;
  /** Compact layout for dialogs (fewer body rows). */
  compact?: boolean;
  onCreated: (ticket: TicketDetail) => void;
  onCancel?: () => void;
};

export function TicketCreateForm({
  preferredFamilyTreeId,
  lockTreeId,
  compact = false,
  onCreated,
  onCancel,
}: Props) {
  const t = useTranslations("tickets");
  const { hasPermission } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [selectedTreeId, setSelectedTreeId] = useState(lockTreeId ?? "");
  const [fetchedTrees, setFetchedTrees] = useState<FamilyTree[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReadTrees = hasPermission(Permissions.TREE_READ);
  const trees = canReadTrees ? fetchedTrees : NO_TREES;
  const showTreePicker = canReadTrees && !lockTreeId;
  const familyTreeId = lockTreeId ?? selectedTreeId;

  useEffect(() => {
    if (!canReadTrees || lockTreeId) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listFamilyTrees();
        if (!cancelled) {
          setFetchedTrees(items);
          if (
            preferredFamilyTreeId &&
            items.some((tree) => tree.id === preferredFamilyTreeId)
          ) {
            setSelectedTreeId(preferredFamilyTreeId);
          }
        }
      } catch {
        if (!cancelled) setFetchedTrees([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadTrees, preferredFamilyTreeId, lockTreeId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ticket = await createTicket({
        title: title.trim(),
        body: body.trim(),
        category,
        family_tree_id: familyTreeId || null,
      });
      onCreated(ticket);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t("createError"));
      setBusy(false);
    }
  };

  return (
    <Form onSubmit={onSubmit}>
      <TextField
        label={t("fieldTitle")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        required
        disabled={busy}
      />

      <SelectField
        label={t("fieldCategory")}
        value={category}
        onChange={(e) => setCategory(e.target.value as TicketCategory)}
        required
        disabled={busy}
      >
        {CATEGORIES.map((value) => (
          <option key={value} value={value}>
            {t(`category.${value}`)}
          </option>
        ))}
      </SelectField>

      {showTreePicker ? (
        <SelectField
          label={t("fieldTree")}
          hint={t("fieldTreeHint")}
          value={familyTreeId}
          onChange={(e) => setSelectedTreeId(e.target.value)}
          disabled={busy}
        >
          <option value="">{t("treeNone")}</option>
          {trees.map((tree) => (
            <option key={tree.id} value={tree.id}>
              {tree.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <FormRow>
        <TextAreaField
          label={t("fieldBody")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={compact ? 5 : 8}
          required
          disabled={busy}
        />
      </FormRow>

      {error ? (
        <FormRow>
          <Alert tone="error">{error}</Alert>
        </FormRow>
      ) : null}

      <FormActions>
        <Button type="submit" loading={busy} disabled={busy}>
          {busy ? t("creating") : t("createSubmit")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </FormActions>
    </Form>
  );
}
