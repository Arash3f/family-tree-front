/**
 * How a tree is shown. `full` and `minimal` are the two canvas (graph) styles —
 * `minimal` shows only the photo, name and family name, lighter to paint on a
 * large tree; both share one card size, so the layout does not depend on it.
 * `profile` is not a canvas at all: a search-first explorer that opens one
 * person as a rich profile and walks the family by relationships.
 */
export type PedigreeCardVariant = "full" | "minimal" | "profile";

/** Query parameter on the tree page that carries the variant. */
export const CARD_VARIANT_PARAM = "view";

/** The canvas (graph) variants — `profile` is handled by a separate view. */
export type PedigreeCanvasVariant = "full" | "minimal";

/** Reads the query value; anything but a known variant is the full view. */
export function parseCardVariant(
  value: string | string[] | undefined,
): PedigreeCardVariant {
  if (value === "minimal") return "minimal";
  if (value === "profile") return "profile";
  return "full";
}

/** Tree page href for the given variant (the full view needs no parameter). */
export function treePageHref(
  treeId: string,
  variant: PedigreeCardVariant,
): string {
  const base = `/dashboard/trees/${treeId}`;
  return variant === "full"
    ? base
    : `${base}?${CARD_VARIANT_PARAM}=${variant}`;
}
