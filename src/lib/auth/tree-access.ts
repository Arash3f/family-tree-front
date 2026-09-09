/** Per-tree membership access (must stay in sync with backend TreeAccessPermissions). */
export const TreeAccess = {
  VIEW: "view",
  PERSON_CREATE: "person_create",
  PERSON_UPDATE: "person_update",
  PERSON_DELETE: "person_delete",
  MARRIAGE_CREATE: "marriage_create",
  MARRIAGE_UPDATE: "marriage_update",
  MARRIAGE_DELETE: "marriage_delete",
  MARRIAGE_DIVORCE: "marriage_divorce",
  UPLOAD_PHOTO: "upload_photo",
  MEMBER_ADD: "member_add",
  MEMBER_REMOVE: "member_remove",
  VIEW_BIRTH_DATE: "view_birth_date",
  VIEW_MARRIAGE_DATE: "view_marriage_date",
  VIEW_PHOTO: "view_photo",
  TICKET_MANAGE: "ticket_manage",
} as const;

export type TreeAccessPermission =
  (typeof TreeAccess)[keyof typeof TreeAccess];

export const TREE_ACCESS_ALL: readonly TreeAccessPermission[] = [
  TreeAccess.VIEW,
  TreeAccess.PERSON_CREATE,
  TreeAccess.PERSON_UPDATE,
  TreeAccess.PERSON_DELETE,
  TreeAccess.MARRIAGE_CREATE,
  TreeAccess.MARRIAGE_UPDATE,
  TreeAccess.MARRIAGE_DELETE,
  TreeAccess.MARRIAGE_DIVORCE,
  TreeAccess.UPLOAD_PHOTO,
  TreeAccess.MEMBER_ADD,
  TreeAccess.MEMBER_REMOVE,
  TreeAccess.VIEW_BIRTH_DATE,
  TreeAccess.VIEW_MARRIAGE_DATE,
  TreeAccess.VIEW_PHOTO,
  TreeAccess.TICKET_MANAGE,
];

/**
 * Selecting a capability also requires these (must stay in sync with backend).
 * Editing a person or a marriage must expose the protected values it can
 * overwrite, so those views are pulled in alongside the write capability.
 */
export const TREE_ACCESS_REQUIREMENTS: Record<
  string,
  readonly string[]
> = {
  [TreeAccess.PERSON_CREATE]: [TreeAccess.VIEW],
  [TreeAccess.PERSON_UPDATE]: [
    TreeAccess.VIEW,
    TreeAccess.VIEW_BIRTH_DATE,
    TreeAccess.VIEW_PHOTO,
  ],
  [TreeAccess.PERSON_DELETE]: [TreeAccess.VIEW],
  [TreeAccess.MARRIAGE_CREATE]: [TreeAccess.VIEW],
  [TreeAccess.MARRIAGE_UPDATE]: [
    TreeAccess.VIEW,
    TreeAccess.VIEW_MARRIAGE_DATE,
  ],
  [TreeAccess.MARRIAGE_DELETE]: [TreeAccess.VIEW],
  [TreeAccess.MARRIAGE_DIVORCE]: [
    TreeAccess.VIEW,
    TreeAccess.VIEW_MARRIAGE_DATE,
  ],
  [TreeAccess.UPLOAD_PHOTO]: [TreeAccess.VIEW, TreeAccess.VIEW_PHOTO],
  [TreeAccess.MEMBER_ADD]: [TreeAccess.VIEW],
  [TreeAccess.MEMBER_REMOVE]: [TreeAccess.VIEW],
  [TreeAccess.VIEW_BIRTH_DATE]: [TreeAccess.VIEW],
  [TreeAccess.VIEW_MARRIAGE_DATE]: [TreeAccess.VIEW],
  [TreeAccess.VIEW_PHOTO]: [TreeAccess.VIEW],
  [TreeAccess.TICKET_MANAGE]: [TreeAccess.VIEW],
};

/**
 * How the picker and member badges lay the capabilities out: people, marriage,
 * person photo, members, then the read-only views.
 */
export const TREE_ACCESS_GROUPS: readonly {
  id: string;
  items: readonly TreeAccessPermission[];
}[] = [
  {
    id: "person",
    items: [
      TreeAccess.PERSON_CREATE,
      TreeAccess.PERSON_UPDATE,
      TreeAccess.PERSON_DELETE,
    ],
  },
  {
    id: "marriage",
    items: [
      TreeAccess.MARRIAGE_CREATE,
      TreeAccess.MARRIAGE_UPDATE,
      TreeAccess.MARRIAGE_DELETE,
      TreeAccess.MARRIAGE_DIVORCE,
    ],
  },
  {
    id: "photo",
    items: [TreeAccess.UPLOAD_PHOTO],
  },
  {
    id: "members",
    items: [TreeAccess.MEMBER_ADD, TreeAccess.MEMBER_REMOVE],
  },
  {
    id: "tickets",
    items: [TreeAccess.TICKET_MANAGE],
  },
  {
    id: "views",
    items: [
      TreeAccess.VIEW,
      TreeAccess.VIEW_BIRTH_DATE,
      TreeAccess.VIEW_MARRIAGE_DATE,
      TreeAccess.VIEW_PHOTO,
    ],
  },
];

/** Group a set of granted access names for display, keeping the group order. */
export function groupTreeAccess(
  permissionNames: Iterable<string>,
): { id: string; items: TreeAccessPermission[] }[] {
  const present = new Set(permissionNames);
  return TREE_ACCESS_GROUPS.map((group) => ({
    id: group.id,
    items: group.items.filter((item) => present.has(item)),
  })).filter((group) => group.items.length > 0);
}

export function getTreeAccessRequirements(
  permissionName: string,
): readonly string[] {
  return TREE_ACCESS_REQUIREMENTS[permissionName] ?? [];
}

export function expandTreeAccess(
  permissionNames: Iterable<string>,
): Set<string> {
  const result = new Set(permissionNames);
  const queue = [...result];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const required of getTreeAccessRequirements(current)) {
      if (!result.has(required)) {
        result.add(required);
        queue.push(required);
      }
    }
  }
  return result;
}

export function getTreeAccessCompanions(permissionName: string): string[] {
  return [...expandTreeAccess([permissionName])]
    .filter((name) => name !== permissionName)
    .sort();
}

export function getTreeAccessRequiring(
  permissionName: string,
  selectedNames: Iterable<string>,
): string[] {
  return [...selectedNames].filter((selected) => {
    if (selected === permissionName) return false;
    return expandTreeAccess([selected]).has(permissionName);
  });
}

export function normalizeTreeAccess(
  permissionNames: Iterable<string>,
): string[] {
  const known = new Set(
    [...permissionNames].filter((name) =>
      (TREE_ACCESS_ALL as readonly string[]).includes(name),
    ),
  );
  if (known.size === 0) known.add(TreeAccess.VIEW);
  return [...expandTreeAccess(known)].sort();
}

export function minimizeExplicitTreeAccess(
  selectedNames: Iterable<string>,
): Set<string> {
  const selected = [...selectedNames];
  const explicit = new Set(selected);
  for (const name of selected) {
    const others = selected.filter((n) => n !== name);
    if (expandTreeAccess(others).has(name)) {
      explicit.delete(name);
    }
  }
  return explicit;
}

export function treeAccessSetsEqual(
  a: Iterable<string>,
  b: Iterable<string>,
): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}
