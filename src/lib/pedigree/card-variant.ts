/**
 * How person cards render on the tree canvas. `minimal` shows only the photo,
 * name and family name — lighter to paint on a large tree. Both share one
 * card size, so the layout does not depend on it.
 */
export type PedigreeCardVariant = "full" | "minimal";

/** Query parameter on the tree page that carries the variant. */
export const CARD_VARIANT_PARAM = "view";

/** Reads the query value; anything but `minimal` is the full view. */
export function parseCardVariant(
  value: string | string[] | undefined,
): PedigreeCardVariant {
  return value === "minimal" ? "minimal" : "full";
}

/** Tree page href for the given variant (the full view needs no parameter). */
export function treePageHref(
  treeId: string,
  variant: PedigreeCardVariant,
): string {
  const base = `/dashboard/trees/${treeId}`;
  return variant === "minimal" ? `${base}?${CARD_VARIANT_PARAM}=minimal` : base;
}
