import type { Marriage, Person } from "@/lib/auth/types";
import { collectBranchIds, subsetByIds } from "@/lib/pedigree/layout";

/** Generations of descendants the branch view draws; `null` means all of them. */
export type BranchDepth = 1 | 2 | 3 | null;

/** The depth choices the branch view offers, in the order they are shown. */
export const BRANCH_DEPTHS: BranchDepth[] = [1, 2, 3, null];

export type BranchViewOptions = {
  depth: BranchDepth;
  /** Draw the root's own parents (and their spouses) above the branch. */
  includeParents: boolean;
};

/**
 * The slice of a tree the profile view's branch card draws: one person, their
 * descendants down to `depth`, the spouses of that set, and — when asked — the
 * generation right above them.
 *
 * Kept apart from {@link subsetForBranch} because that one is the canvas branch
 * preview, which has no depth limit and never reaches above its root.
 *
 * @param persons - Every person of the tree
 * @param marriages - Every marriage of the tree
 * @param rootId - Person the branch hangs from
 * @param options - How deep to go, and whether to include the root's parents
 *
 * @returns The clipped `persons` and `marriages` lists, empty when `rootId` is
 *   not part of `persons`
 *
 * @example
 * ```ts
 * const branch = subsetForBranchView(persons, marriages, person.id, {
 *   depth: 2,
 *   includeParents: true,
 * })
 * ```
 */
export function subsetForBranchView(
  persons: Person[],
  marriages: Marriage[],
  rootId: string,
  options: BranchViewOptions,
): { persons: Person[]; marriages: Marriage[] } {
  const keepIds = collectBranchIds(rootId, persons, marriages, {
    maxDepth: options.depth,
  });
  if (keepIds.size === 0) return { persons: [], marriages: [] };

  if (options.includeParents) {
    const root = persons.find((person) => person.id === rootId);
    const parentIds = new Set(
      (root?.parents ?? []).map((link) => link.parent_id),
    );
    for (const id of parentIds) keepIds.add(id);
    // A parent's own spouse comes along so the couple keeps its chrome.
    for (const marriage of marriages) {
      if (
        parentIds.has(marriage.spouse_a_id) ||
        parentIds.has(marriage.spouse_b_id)
      ) {
        keepIds.add(marriage.spouse_a_id);
        keepIds.add(marriage.spouse_b_id);
      }
    }
  }

  return subsetByIds(persons, marriages, keepIds);
}
