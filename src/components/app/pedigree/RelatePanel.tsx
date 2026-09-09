"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Person } from "@/lib/auth/types";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { PersonSearchResults } from "./PersonSearchResults";
import styles from "./PedigreeView.module.css";

type Props = {
  fromName: string;
  /** Id of the picked target, empty until one is chosen. */
  pickedId: string;
  pickedName: string | null;
  searchPeople: (query: string) => Person[];
  hint: (person: Person) => string | null;
  busy: boolean;
  onPick: (personId: string) => void;
  onClearPick: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClose: () => void;
  relationResult: ReactNode;
};

export function RelatePanel({
  fromName,
  pickedId,
  pickedName,
  searchPeople,
  hint,
  busy,
  onPick,
  onClearPick,
  onSubmit,
  onCancel,
  onClose,
  relationResult,
}: Props) {
  const t = useTranslations("pedigree");
  const [search, setSearch] = useState("");
  const results = useMemo(() => searchPeople(search), [searchPeople, search]);

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormRow>
        <header className={styles.panelHeader}>
          <h2>{t("findRelation")}</h2>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>
        <p className={styles.support}>{t("relationFrom", { name: fromName })}</p>
      </FormRow>

      <FormRow className={styles.personPicker}>
        <Field label={t("fields.relateTo")}>
          {({ id, className }) =>
            pickedName ? (
              <div className={styles.pickedPerson}>
                <span>{pickedName}</span>
                <button
                  type="button"
                  className={styles.clearPick}
                  disabled={busy}
                  onClick={() => {
                    onClearPick();
                    setSearch("");
                  }}
                >
                  {t("clearSelection")}
                </button>
              </div>
            ) : (
              <>
                <input
                  id={id}
                  className={className}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.scrollIntoView({
                      block: "center",
                      inline: "nearest",
                    });
                  }}
                  placeholder={t("relateSearchPlaceholder")}
                  disabled={busy}
                  autoComplete="off"
                  enterKeyHint="search"
                  required={!pickedId}
                />
                <PersonSearchResults
                  people={results}
                  hint={hint}
                  onPick={(person) => {
                    onPick(person.id);
                    setSearch("");
                  }}
                />
              </>
            )
          }
        </Field>
      </FormRow>

      <FormActions>
        <Button type="submit" loading={busy} disabled={!pickedId}>
          {t("runRelation")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </FormActions>

      {relationResult ? <FormRow>{relationResult}</FormRow> : null}
    </Form>
  );
}
