import type { AccountType, AuthUser, FamilyTree } from "@/lib/auth/types";

export const FREE_MAX_OWNED_TREES = 2;
export const FREE_MAX_PERSONS_PER_TREE = 20;
export const FREE_MAX_MARRIAGES_PER_TREE = 8;

/** Matches backend `ErrorCode.FREE_ACCOUNT_LIMIT`. */
export const FREE_ACCOUNT_LIMIT_CODE = 1711;

export function isFreeAccount(
  accountType: AccountType | null | undefined,
): boolean {
  return accountType === "free";
}

export function isFreeAccountLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "errorCode" in error &&
    (error as { errorCode: unknown }).errorCode === FREE_ACCOUNT_LIMIT_CODE
  );
}

export function ownedTreeCount(
  trees: FamilyTree[],
  userId: string | undefined,
): number {
  if (!userId) return 0;
  return trees.filter((tree) => tree.owner_user_id === userId).length;
}

export function freeUserAtTreeLimit(
  user: Pick<AuthUser, "id" | "account_type"> | null | undefined,
  trees: FamilyTree[],
): boolean {
  if (!user || !isFreeAccount(user.account_type)) return false;
  return ownedTreeCount(trees, user.id) >= FREE_MAX_OWNED_TREES;
}

export function freeOwnerAtPersonLimit(
  user: Pick<AuthUser, "id" | "account_type"> | null | undefined,
  tree: Pick<FamilyTree, "owner_user_id"> | null | undefined,
  personCount: number,
  additional = 1,
): boolean {
  if (!user || !tree || user.id !== tree.owner_user_id) return false;
  if (!isFreeAccount(user.account_type)) return false;
  return personCount + additional > FREE_MAX_PERSONS_PER_TREE;
}

export function freeOwnerAtMarriageLimit(
  user: Pick<AuthUser, "id" | "account_type"> | null | undefined,
  tree: Pick<FamilyTree, "owner_user_id"> | null | undefined,
  marriageCount: number,
  additional = 1,
): boolean {
  if (!user || !tree || user.id !== tree.owner_user_id) return false;
  if (!isFreeAccount(user.account_type)) return false;
  return marriageCount + additional > FREE_MAX_MARRIAGES_PER_TREE;
}
