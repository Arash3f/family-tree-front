import { Permissions, type AppPermission } from "@/lib/auth/types";

/** Selecting a permission also requires these (must stay in sync with backend). */
export const PERMISSION_REQUIREMENTS: Record<string, readonly string[]> = {
  [Permissions.USER_CREATE]: [Permissions.USER_READ, Permissions.ROLE_READ],
  [Permissions.USER_UPDATE]: [Permissions.USER_READ, Permissions.ROLE_READ],
  [Permissions.USER_DELETE]: [Permissions.USER_READ],
  [Permissions.ROLE_CREATE]: [Permissions.ROLE_READ, Permissions.PERMISSION_READ],
  [Permissions.ROLE_UPDATE]: [Permissions.ROLE_READ, Permissions.PERMISSION_READ],
  [Permissions.ROLE_DELETE]: [Permissions.ROLE_READ],
  [Permissions.TICKET_CREATE]: [Permissions.TICKET_READ],
  [Permissions.TICKET_REPLY]: [Permissions.TICKET_READ],
  [Permissions.TREE_CREATE]: [Permissions.TREE_READ],
  [Permissions.TREE_UPDATE]: [Permissions.TREE_READ],
  [Permissions.TREE_DELETE]: [Permissions.TREE_READ],
};

export function getDirectRequirements(permissionName: string): readonly string[] {
  return PERMISSION_REQUIREMENTS[permissionName] ?? [];
}

export function expandWithRequirements(
  permissionNames: Iterable<string>,
): Set<string> {
  const result = new Set(permissionNames);
  const queue = [...result];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const required of getDirectRequirements(current)) {
      if (!result.has(required)) {
        result.add(required);
        queue.push(required);
      }
    }
  }
  return result;
}

/** All required companions for one permission (transitive, excluding itself). */
export function getRequiredCompanions(permissionName: string): string[] {
  return [...expandWithRequirements([permissionName])]
    .filter((name) => name !== permissionName)
    .sort();
}

/** Permissions currently selected that force `permissionName` to stay on. */
export function getRequiringPermissions(
  permissionName: string,
  selectedNames: Iterable<string>,
): string[] {
  return [...selectedNames].filter((selected) => {
    if (selected === permissionName) return false;
    return expandWithRequirements([selected]).has(permissionName);
  });
}

/** Expand a selected id set with all mandatory companions. */
export function expandSelectedPermissionIds(
  selectedIds: Iterable<string>,
  permissions: AppPermission[],
): Set<string> {
  const idByName = new Map(permissions.map((p) => [p.name, p.id]));
  const nameById = new Map(permissions.map((p) => [p.id, p.name]));

  const selectedNames: string[] = [];
  for (const id of selectedIds) {
    const name = nameById.get(id);
    if (name) selectedNames.push(name);
  }

  const expandedNames = expandWithRequirements(selectedNames);
  const next = new Set<string>();
  for (const name of expandedNames) {
    const id = idByName.get(name);
    if (id) next.add(id);
  }
  // Keep any unknown ids that were already selected.
  for (const id of selectedIds) {
    next.add(id);
  }
  return next;
}

export function selectionNeedsBundleExpansion(
  selectedIds: Iterable<string>,
  permissions: AppPermission[],
): boolean {
  const expanded = expandSelectedPermissionIds(selectedIds, permissions);
  const current = new Set(selectedIds);
  if (expanded.size !== current.size) return true;
  for (const id of expanded) {
    if (!current.has(id)) return true;
  }
  return false;
}

function sameIdSet(a: Iterable<string>, b: Iterable<string>): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

/**
 * Keep only ids that are not already implied by the rest of the selection.
 * Used so auto-granted prerequisites can be dropped when their parent is unchecked.
 */
export function minimizeExplicitPermissionIds(
  selectedIds: Iterable<string>,
  permissions: AppPermission[],
): Set<string> {
  const nameById = new Map(permissions.map((p) => [p.id, p.name]));
  const selected = [...selectedIds];
  const selectedNames = selected
    .map((id) => nameById.get(id))
    .filter((name): name is string => Boolean(name));

  const explicit = new Set(selected);
  for (const id of selected) {
    const name = nameById.get(id);
    if (!name) continue;
    const others = selectedNames.filter((n) => n !== name);
    if (expandWithRequirements(others).has(name)) {
      explicit.delete(id);
    }
  }
  return explicit;
}

export function setsEqualPermissionIds(
  a: Iterable<string>,
  b: Iterable<string>,
): boolean {
  return sameIdSet(a, b);
}
