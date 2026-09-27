import type { ClosestRelationship } from "@/lib/auth/types";
import type { RelationPathView } from "./useGraphFocus";

function nonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Prefer the active locale; fall back to the other language when missing. */
export function pickLocalizedKinship(
  locale: string,
  fa: string | null | undefined,
  en: string | null | undefined,
): string | null {
  const faVal = nonEmpty(fa);
  const enVal = nonEmpty(en);
  const preferFa = locale === "fa" || locale.startsWith("fa-");
  return preferFa ? (faVal ?? enVal) : (enVal ?? faVal);
}

export function relationshipToPathViews(
  result: ClosestRelationship,
  locale: string,
): RelationPathView[] {
  const raw =
    result.paths?.length > 0
      ? result.paths
      : [
          {
            distance: result.distance ?? 0,
            path_person_ids: result.path_person_ids,
            relationship_types: result.relationship_types,
            label_fa: result.label_fa,
            label_en: result.label_en,
            description_fa: result.description_fa,
            description_en: result.description_en,
          },
        ];
  return raw.map((path) => ({
    ids: path.path_person_ids.map(String),
    distance: path.distance,
    kinship: pickLocalizedKinship(locale, path.label_fa, path.label_en),
    kinshipDetail: pickLocalizedKinship(
      locale,
      path.description_fa,
      path.description_en,
    ),
  }));
}
