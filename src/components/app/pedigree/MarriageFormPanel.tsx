"use client";

import type { Dispatch, SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Person } from "@/lib/auth/types";
import { personDisplayName } from "@/lib/pedigree/layout";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Field, SelectField } from "@/components/ui/Field";
import { Form, FormActions, FormRow } from "@/components/ui/Form";
import { DateField } from "./LazyDateField";
import { underageSpouseLabels } from "./marriage-age";
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
  const personById = new Map(personOptions.map((person) => [person.id, person]));
  const spouseA = personById.get(form.spouse_a_id);
  const spouseB = personById.get(form.spouse_b_id);
  const underageNames = underageSpouseLabels(
    [
      spouseA
        ? { label: personDisplayName(spouseA), birth_date: spouseA.birth_date }
        : null,
      spouseB
        ? { label: personDisplayName(spouseB), birth_date: spouseB.birth_date }
        : null,
    ].filter((item): item is { label: string; birth_date: string | null } =>
      Boolean(item),
    ),
    form.married_at,
  );

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
      {underageNames.length > 0 ? (
        <Alert tone="warning">
          {t("underageMarriageWarning", {
            names: underageNames.join(locale === "fa" ? "، " : ", "),
          })}
        </Alert>
      ) : null}
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
