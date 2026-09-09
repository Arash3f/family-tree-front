"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  Gender,
  Marriage,
  ParentRelationshipType,
  Person,
} from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { personDisplayName } from "@/lib/pedigree/layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import {
  Field,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import {
  Form,
  FormActions,
  FormRow,
  FormSection,
} from "@/components/ui/Form";
import { DateField } from "./LazyDateField";
import { marriagePeriodText } from "./marriage-text";
import {
  findOriginMarriageId,
  type LinkAsParentOf,
  type PersonFormState,
} from "./person-form";
import styles from "./PedigreeView.module.css";

type Mode =
  | { kind: "create"; linkAsParentOf?: LinkAsParentOf }
  | { kind: "edit"; personId: string };

type Props = {
  mode: Mode;
  form: PersonFormState;
  setForm: Dispatch<SetStateAction<PersonFormState>>;
  busy: boolean;
  /** People selectable as a parent: everyone but the person being edited. */
  parentOptions: Person[];
  /** Label under each parent option, e.g. whose child they are. */
  parentOptionHint: (person: Person) => string | null;
  marriageOptions: { id: string; label: string }[];
  marriages: Marriage[];
  /** Marriages of the person being edited, empty while creating. */
  editingMarriages: Marriage[];
  /** Display name for a spouse id, falling back to the raw id. */
  nameOf: (personId: string) => string;
  /** Name of the child this new person is being added as a parent of. */
  parentOfName: string | null;
  existingPhotoUrl: string | null;
  divorceDate: string;
  onDivorceDateChange: (value: string) => void;
  canReadMarriages: boolean;
  canUpdateMarriage: boolean;
  canDeleteMarriage: boolean;
  canDivorce: boolean;
  canUpload: boolean;
  onSubmit: () => void;
  onClose: () => void;
  onUpdateMarriedAt: (marriage: Marriage, marriedAt: string) => void;
  onDivorce: (marriage: Marriage) => void;
  onDeleteMarriage: (marriage: Marriage) => void;
};

function parentOptionLabel(
  person: Person,
  hint: string | null,
): string {
  const name = personDisplayName(person);
  return hint ? `${name} — ${hint}` : name;
}

export function PersonFormPanel({
  mode,
  form,
  setForm,
  busy,
  parentOptions,
  parentOptionHint,
  marriageOptions,
  marriages,
  editingMarriages,
  nameOf,
  parentOfName,
  existingPhotoUrl,
  divorceDate,
  onDivorceDateChange,
  canReadMarriages,
  canUpdateMarriage,
  canDeleteMarriage,
  canDivorce,
  canUpload,
  onSubmit,
  onClose,
  onUpdateMarriedAt,
  onDivorce,
  onDeleteMarriage,
}: Props) {
  const t = useTranslations("pedigree");
  const locale = useLocale();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const creatingParent = mode.kind === "create" ? mode.linkAsParentOf : undefined;

  const pickedPhotoUrl = useMemo(() => {
    if (!form.photoFile) return null;
    return URL.createObjectURL(form.photoFile);
  }, [form.photoFile]);

  useEffect(() => {
    return () => {
      if (pickedPhotoUrl) URL.revokeObjectURL(pickedPhotoUrl);
    };
  }, [pickedPhotoUrl]);

  useEffect(() => {
    const nextId =
      form.parent1_id && form.parent2_id
        ? findOriginMarriageId(form.parent1_id, form.parent2_id, marriages)
        : null;
    const normalized = nextId ?? "";
    setForm((prev) =>
      prev.marriage_id === normalized
        ? prev
        : { ...prev, marriage_id: normalized },
    );
  }, [form.parent1_id, form.parent2_id, marriages, setForm]);

  const originMarriageLabel = useMemo(() => {
    if (!form.marriage_id) return null;
    return (
      marriageOptions.find((marriage) => marriage.id === form.marriage_id)
        ?.label ?? null
    );
  }, [form.marriage_id, marriageOptions]);

  const activeSpouseCount = editingMarriages.filter(
    (marriage) => !marriage.divorced_at,
  ).length;

  const photoPreview =
    pickedPhotoUrl ??
    (form.photoRemoved || form.photoFile ? null : existingPhotoUrl);

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormRow>
        <header className={styles.panelHeader}>
          <h2>
            {mode.kind === "create"
              ? creatingParent?.role === "father"
                ? t("createFatherTitle")
                : creatingParent?.role === "mother"
                  ? t("createMotherTitle")
                  : t("createPersonTitle")
              : t("editPersonTitle")}
          </h2>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>
        {creatingParent && parentOfName ? (
          <p className={styles.support}>
            {t(
              creatingParent.role === "father"
                ? "addFatherNote"
                : "addMotherNote",
              { name: parentOfName },
            )}
          </p>
        ) : null}
      </FormRow>

      <TextField
        label={t("fields.name")}
        value={form.name}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, name: e.target.value }))
        }
        required
        disabled={busy}
      />
      <TextField
        label={t("fields.familyName")}
        value={form.family_name}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, family_name: e.target.value }))
        }
        disabled={busy}
      />
      <SelectField
        label={t("fields.gender")}
        value={form.gender}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, gender: e.target.value as Gender }))
        }
        disabled={busy || Boolean(creatingParent)}
      >
        <option value="male">{t("gender.male")}</option>
        <option value="female">{t("gender.female")}</option>
      </SelectField>
      <Field label={t("fields.birthDate")}>
        {({ id }) => (
          <DateField
            id={id}
            value={form.birth_date}
            onChange={(birth_date) =>
              setForm((prev) => ({ ...prev, birth_date }))
            }
            locale={locale}
            disabled={busy}
            clearable
            placeholder={t("dateHint")}
          />
        )}
      </Field>
      <Field label={t("fields.deathDate")}>
        {({ id }) => (
          <DateField
            id={id}
            value={form.death_date}
            onChange={(death_date) =>
              setForm((prev) => ({ ...prev, death_date }))
            }
            locale={locale}
            disabled={busy}
            clearable
            placeholder={t("dateHint")}
          />
        )}
      </Field>
      <TextField
        label={t("fields.birthPlace")}
        value={form.birth_place}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, birth_place: e.target.value }))
        }
        disabled={busy}
      />
      <TextField
        label={t("fields.deathPlace")}
        value={form.death_place}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, death_place: e.target.value }))
        }
        disabled={busy}
      />
      <FormRow>
        <TextAreaField
          label={t("fields.notes")}
          value={form.notes}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, notes: e.target.value }))
          }
          rows={3}
          disabled={busy}
        />
      </FormRow>

      <FormSection title={t("fields.parents")}>
        <SelectField
          label={t("fields.parent1")}
          value={form.parent1_id}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, parent1_id: e.target.value }))
          }
          disabled={busy}
          filterable
          filterPlaceholder={t("searchPlaceholder")}
          filterEmptyLabel={t("noMatchingPeople")}
        >
          <option value="">{t("none")}</option>
          {parentOptions.map((person) => (
            <option key={person.id} value={person.id}>
              {parentOptionLabel(person, parentOptionHint(person))}
            </option>
          ))}
        </SelectField>
        {form.parent1_id ? (
          <SelectField
            label={t("fields.relationshipType")}
            value={form.parent1_type}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                parent1_type: e.target.value as ParentRelationshipType,
              }))
            }
            disabled={busy}
          >
            <option value="biological">{t("relationship.biological")}</option>
            <option value="adoptive">{t("relationship.adoptive")}</option>
            <option value="step">{t("relationship.step")}</option>
          </SelectField>
        ) : null}
        <SelectField
          label={t("fields.parent2")}
          value={form.parent2_id}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, parent2_id: e.target.value }))
          }
          disabled={busy}
          filterable
          filterPlaceholder={t("searchPlaceholder")}
          filterEmptyLabel={t("noMatchingPeople")}
        >
          <option value="">{t("none")}</option>
          {parentOptions.map((person) => (
            <option key={person.id} value={person.id}>
              {parentOptionLabel(person, parentOptionHint(person))}
            </option>
          ))}
        </SelectField>
        {form.parent2_id ? (
          <SelectField
            label={t("fields.relationshipType")}
            value={form.parent2_type}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                parent2_type: e.target.value as ParentRelationshipType,
              }))
            }
            disabled={busy}
          >
            <option value="biological">{t("relationship.biological")}</option>
            <option value="adoptive">{t("relationship.adoptive")}</option>
            <option value="step">{t("relationship.step")}</option>
          </SelectField>
        ) : null}
        {canReadMarriages && form.parent1_id && form.parent2_id ? (
          <FormRow>
            <p className={styles.originMarriageNote}>
              {originMarriageLabel
                ? t("originMarriageAuto", { couple: originMarriageLabel })
                : t("originMarriageMissing")}
            </p>
          </FormRow>
        ) : null}
      </FormSection>

      {mode.kind === "edit" && canReadMarriages && editingMarriages.length > 0 ? (
        <FormSection
          title={
            <>
              {t("marriagesTitle")}
              {activeSpouseCount > 1 ? (
                <Badge tone="accent">
                  {t("activeSpousesCount", {
                    count: formatLocaleDigits(activeSpouseCount, locale),
                  })}
                </Badge>
              ) : null}
            </>
          }
        >
          <FormRow>
          <ul className={styles.list}>
            {editingMarriages.map((marriage, index) => {
              const otherId =
                marriage.spouse_a_id === mode.personId
                  ? marriage.spouse_b_id
                  : marriage.spouse_a_id;
              const spouseOrdinal = editingMarriages
                .slice(0, index + 1)
                .filter((item) => !item.divorced_at).length;
              return (
                <li key={marriage.id} className={styles.marriageRow}>
                  <div>
                    <p className={styles.spouseTitle}>
                      {!marriage.divorced_at
                        ? t("spouseOrdinal", {
                            n: formatLocaleDigits(spouseOrdinal, locale),
                          })
                        : t("formerSpouse")}
                      {": "}
                      {nameOf(otherId)}
                    </p>
                    <p className={styles.meta}>
                      {marriagePeriodText(marriage, locale, (years) =>
                        t("marriageDuration", {
                          count: formatLocaleDigits(years, locale),
                        }),
                      )}
                    </p>
                    {marriage.divorced_at ? (
                      <Badge>{t("divorced")}</Badge>
                    ) : (
                      <Badge tone="accent">{t("spouseActive")}</Badge>
                    )}
                  </div>
                  {canUpdateMarriage ? (
                    <Field label={t("fields.marriedAt")} required>
                      {({ id }) => (
                        <DateField
                          id={id}
                          value={marriage.married_at ?? ""}
                          onChange={(value) =>
                            onUpdateMarriedAt(marriage, value)
                          }
                          locale={locale}
                          required
                          disabled={busy}
                          placeholder={t("dateHint")}
                        />
                      )}
                    </Field>
                  ) : null}
                  {!marriage.divorced_at && canDivorce ? (
                    <>
                      <Field label={t("fields.divorcedAt")}>
                        {({ id }) => (
                          <DateField
                            id={id}
                            value={divorceDate}
                            onChange={onDivorceDateChange}
                            locale={locale}
                            disabled={busy}
                            placeholder={t("dateHint")}
                          />
                        )}
                      </Field>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onDivorce(marriage)}
                      >
                        {t("divorce")}
                      </Button>
                    </>
                  ) : null}
                  {canDeleteMarriage ? (
                    <Button
                      variant="dangerGhost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onDeleteMarriage(marriage)}
                    >
                      {t("delete")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          </FormRow>
        </FormSection>
      ) : null}

      {canUpload || photoPreview ? (
        <FormRow>
          <Field label={t("fields.photo")}>
            {({ id }) => (
              <div className={styles.photoField}>
                {photoPreview ? (
                  <div className={styles.photoPreview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <div className={styles.photoPreviewMeta}>
                      {form.photoFile ? (
                        <p className={styles.meta}>{t("photoChosen")}</p>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          if (photoInputRef.current) {
                            photoInputRef.current.value = "";
                          }
                          setForm((prev) => ({
                            ...prev,
                            photoFile: null,
                            photoRemoved: true,
                          }));
                        }}
                      >
                        {t("photoRemove")}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {canUpload ? (
                  <input
                    id={id}
                    ref={photoInputRef}
                    className={styles.fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        photoFile: e.target.files?.[0] ?? null,
                        photoRemoved: false,
                      }))
                    }
                    disabled={busy}
                  />
                ) : null}
              </div>
            )}
          </Field>
        </FormRow>
      ) : null}

      <FormActions>
        <Button type="submit" loading={busy}>
          {t("save")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          {t("cancel")}
        </Button>
      </FormActions>
    </Form>
  );
}
