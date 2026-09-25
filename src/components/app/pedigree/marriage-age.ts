import { ageInYears } from "@/lib/pedigree/dates";

/** Soft alarm threshold — matches backend ``MarriageRulesService.MIN_MARRIAGE_AGE``. */
export const MIN_MARRIAGE_AGE = 18;

export function isUnderageAtMarriage(
  birthDate: string | null | undefined,
  marriedAt: string | null | undefined,
): boolean {
  const age = ageInYears(birthDate, marriedAt);
  return age !== null && age < MIN_MARRIAGE_AGE;
}

/** Display names of spouses under the soft legal-age threshold on the wedding date. */
export function underageSpouseLabels(
  spouses: Array<{
    label: string;
    birth_date?: string | null;
  }>,
  marriedAt: string | null | undefined,
): string[] {
  return spouses
    .filter((spouse) => isUnderageAtMarriage(spouse.birth_date, marriedAt))
    .map((spouse) => spouse.label);
}
