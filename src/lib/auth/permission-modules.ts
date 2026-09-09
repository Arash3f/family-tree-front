const MODULE_ORDER = [
  "user",
  "role",
  "permission",
  "tree",
  "ticket",
] as const;

const MODULE_RANK = new Map<string, number>(
  MODULE_ORDER.map((moduleName, index) => [moduleName, index]),
);

export type PermissionWithName = {
  name: string;
};

export type PermissionModuleGroup<T extends PermissionWithName> = {
  module: string;
  permissions: T[];
};

export function getPermissionModule(name: string): string {
  const separatorIndex = name.indexOf("_");
  return separatorIndex > 0 ? name.slice(0, separatorIndex) : name;
}

export function groupPermissionsByModule<T extends PermissionWithName>(
  permissions: T[],
): PermissionModuleGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const permission of permissions) {
    const moduleName = getPermissionModule(permission.name);
    const group = groups.get(moduleName);
    if (group) group.push(permission);
    else groups.set(moduleName, [permission]);
  }

  return [...groups.entries()]
    .sort(([moduleNameA], [moduleNameB]) => {
      const rankA = MODULE_RANK.get(moduleNameA) ?? Number.MAX_SAFE_INTEGER;
      const rankB = MODULE_RANK.get(moduleNameB) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB || moduleNameA.localeCompare(moduleNameB);
    })
    .map(([moduleName, groupedPermissions]) => ({
      module: moduleName,
      permissions: groupedPermissions,
    }));
}
