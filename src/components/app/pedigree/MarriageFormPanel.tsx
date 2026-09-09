"use client";

import type { Dispatch, SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Person } from "@/lib/auth/types";
import { personDisplayName } from "@/lib/pedigree/layout";
import { Button } from "@/components/ui/Button";
import { Field, SelectField } from "@/components/ui/Field";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { DateField } from "./LazyDateField";
import styles from "./PedigreeView.module.css";

export type MarriageFormState = {
  spouse_a_id: string;
  spouse_b_id: string;
  married_at: string;
};

type Props = {
  form: MarriageFormState;
  setForm: Dispatch<SetStateAction<MarriageFormState>>;
  personOptions: Person[];
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
};

export function MarriageFormPanel({
  form,
  setForm,
  personOptions,
  busy,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormRow>
        <header className={styles.panelHeader}>
          <h2>{t("createMarriageTitle")}</h2>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>
      </FormRow>
      <SelectField
        label={t("fields.spouseA")}
        required
        value={form.spouse_a_id}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, spouse_a_id: e.target.value }))
        }
        disabled={busy}
        filterable
        filterPlaceholder={t("searchPlaceholder")}
        filterEmptyLabel={t("noMatchingPeople")}
      >
        <option value="">{t("selectPerson")}</option>
        {personOptions.map((person) => (
          <option key={person.id} value={person.id}>
            {personDisplayName(person)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t("fields.spouseB")}
        required
        value={form.spouse_b_id}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, spouse_b_id: e.target.value }))
        }
        disabled={busy}
        filterable
        filterPlaceholder={t("searchPlaceholder")}
        filterEmptyLabel={t("noMatchingPeople")}
      >
        <option value="">{t("selectPerson")}</option>
        {personOptions
          .filter((person) => person.id !== form.spouse_a_id)
          .map((person) => (
            <option key={person.id} value={person.id}>
              {personDisplayName(person)}
            </option>
          ))}
      </SelectField>
      <Field label={t("fields.marriedAt")} required>
        {({ id }) => (
          <DateField
            id={id}
            value={form.married_at}
            onChange={(married_at) =>
              setForm((prev) => ({ ...prev, married_at }))
            }
            locale={locale}
            required
            disabled={busy}
            placeholder={t("dateHint")}
          />
        )}
      </Field>
      <FormActions>
        <Button type="submit" loading={busy}>
          {t("save")}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {t("cancel")}
        </Button>
      </FormActions>
    </Form>
  );
}
