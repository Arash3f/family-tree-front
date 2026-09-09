import { toLatinDigits } from "@/lib/localeDigits";
import type {
  Gender,
  Marriage,
  ParentLink,
  ParentRelationshipType,
  Person,
  PersonCreateInput,
} from "@/lib/auth/types";

export type ParentRole = "father" | "mother";

export type LinkAsParentOf = {
  childId: string;
  role: ParentRole;
};

export type PersonFormState = {
  name: string;
  family_name: string;
  gender: Gender;
  birth_date: string;
  death_date: string;
  birth_place: string;
  death_place: string;
  notes: string;
  marriage_id: string;
  parent1_id: string;
  parent1_type: ParentRelationshipType;
  parent2_id: string;
  parent2_type: ParentRelationshipType;
  photoFile: File | null;
  photoRemoved: boolean;
};

export type PanelMode =
  | { kind: "none" }
  | {
      kind: "create-person";
      defaults?: Partial<PersonFormState>;
      linkAsParentOf?: LinkAsParentOf;
    }
  | { kind: "edit-person"; personId: string }
  | { kind: "create-marriage"; spouseAId?: string }
  | { kind: "relate"; fromId: string };

export const emptyPersonForm = (): PersonFormState => ({
  name: "",
  family_name: "",
  gender: "male",
  birth_date: "",
  death_date: "",
  birth_place: "",
  death_place: "",
  notes: "",
  marriage_id: "",
  parent1_id: "",
  parent1_type: "biological",
  parent2_id: "",
  parent2_type: "biological",
  photoFile: null,
  photoRemoved: false,
});

export function personToForm(person: Person): PersonFormState {
  const [p1, p2] = person.parents;
  return {
    name: person.name,
    family_name: person.family_name ?? "",
    gender: person.gender,
    birth_date: person.birth_date ?? "",
    death_date: person.death_date ?? "",
    birth_place: person.birth_place ?? "",
    death_place: person.death_place ?? "",
    notes: person.notes ?? "",
    marriage_id: person.marriage_id ?? "",
    parent1_id: p1?.parent_id ?? "",
    parent1_type: p1?.relationship_type ?? "biological",
    parent2_id: p2?.parent_id ?? "",
    parent2_type: p2?.relationship_type ?? "biological",
    photoFile: null,
    photoRemoved: false,
  };
}

export function buildParents(form: PersonFormState): ParentLink[] {
  const parents: ParentLink[] = [];
  if (form.parent1_id) {
    parents.push({
      parent_id: form.parent1_id,
      relationship_type: form.parent1_type,
    });
  }
  if (form.parent2_id && form.parent2_id !== form.parent1_id) {
    parents.push({
      parent_id: form.parent2_id,
      relationship_type: form.parent2_type,
    });
  }
  return parents;
}

/** Prefer an active marriage between the two parents; otherwise the earliest. */
export function findOriginMarriageId(
  parentAId: string,
  parentBId: string,
  marriages: Marriage[],
): string | null {
  if (!parentAId || !parentBId || parentAId === parentBId) return null;
  const pair = new Set([parentAId, parentBId]);
  const matches = marriages.filter((marriage) => {
    const spouses = new Set([marriage.spouse_a_id, marriage.spouse_b_id]);
    return pair.size === spouses.size && [...pair].every((id) => spouses.has(id));
  });
  if (matches.length === 0) return null;
  const active = matches.find((marriage) => !marriage.divorced_at);
  return (active ?? matches[0])!.id;
}

/**
 * Dates are typed in the active calendar's digits, so they are latinised here;
 * the API only ever sees Latin digits. Leaving `photoObjectKey` out of the call
 * omits the field entirely, which is how an update keeps the existing photo.
 */
export function personPayloadFromForm(
  form: PersonFormState,
  photoObjectKey?: string | null,
  marriages?: Marriage[],
): PersonCreateInput {
  const parents = buildParents(form);
  let marriageId = form.marriage_id || null;
  if (marriages && parents.length >= 2) {
    marriageId =
      findOriginMarriageId(parents[0]!.parent_id, parents[1]!.parent_id, marriages) ??
      null;
  } else if (parents.length < 2) {
    marriageId = null;
  }

  return {
    name: form.name.trim(),
    family_name: form.family_name.trim() || null,
    gender: form.gender,
    birth_date: toLatinDigits(form.birth_date.trim()) || null,
    death_date: toLatinDigits(form.death_date.trim()) || null,
    birth_place: form.birth_place.trim() || null,
    death_place: form.death_place.trim() || null,
    notes: form.notes.trim() || null,
    parents,
    marriage_id: marriageId,
    ...(photoObjectKey !== undefined
      ? { photo_object_key: photoObjectKey }
      : {}),
  };
}
