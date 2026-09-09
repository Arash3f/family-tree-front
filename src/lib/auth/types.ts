export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type AuthPermissionDetail = {
  name: string;
  description_en: string;
  description_fa: string;
};

export type AccountType = "free" | "paid";

export type AuthUser = {
  id: string;
  username: string;
  fullname: string;
  email?: string | null;
  phone?: string | null;
  role_id: string | null;
  role_name: string | null;
  permissions: string[];
  permission_details: AuthPermissionDetail[];
  session_id: string;
  account_type: AccountType;
};

export type UserSession = {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string | null;
  expires_at: string;
  is_current: boolean;
};

export type AppUser = {
  id: string;
  username: string;
  fullname: string;
  role_id: string | null;
  account_type?: AccountType;
  last_session_at?: string | null;
};

export type AppRole = {
  id: string;
  name: string;
  permission_ids: string[];
  user_count?: number;
};

export type AppPermission = {
  id: string;
  name: string;
  description_en?: string;
  description_fa?: string;
};

export type TicketStatus = "open" | "in_progress" | "closed";

export type TicketCategory =
  | "general"
  | "account"
  | "technical"
  | "bug"
  | "feature_request"
  | "other";

export type TicketMessage = {
  id: string;
  ticket_id: string;
  author_user_id: string;
  body: string;
  created_at: string | null;
  updated_at: string | null;
};

export type TicketSummary = {
  id: string;
  title: string;
  status: TicketStatus;
  category: TicketCategory;
  created_by_user_id: string;
  created_by_can_manage: boolean;
  viewer_can_manage: boolean;
  family_tree_id: string | null;
  family_tree_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TicketDetail = TicketSummary & {
  messages: TicketMessage[];
};

export type TicketQueueRole = "mine" | "incoming" | "staff";

export function ticketQueueRole(
  ticket: Pick<TicketSummary, "created_by_user_id" | "created_by_can_manage">,
  userId: string | undefined,
): TicketQueueRole {
  if (userId && ticket.created_by_user_id === userId) return "mine";
  if (ticket.created_by_can_manage) return "staff";
  return "incoming";
}

export type TreeMemberRole = "owner" | "member";

export type TreeAccessPermission =
  | "view"
  | "person_create"
  | "person_update"
  | "person_delete"
  | "marriage_create"
  | "marriage_update"
  | "marriage_delete"
  | "marriage_divorce"
  | "upload_photo"
  | "member_add"
  | "member_remove"
  | "view_birth_date"
  | "view_marriage_date"
  | "view_photo"
  | "ticket_manage";

export type FamilyTree = {
  id: string;
  name: string;
  owner_user_id: string;
  my_permissions?: TreeAccessPermission[];
};

export type TreeMembership = {
  id: string;
  tree_id: string;
  user_id: string;
  role: TreeMemberRole;
  permissions: TreeAccessPermission[];
  username?: string | null;
};

export type Gender = "male" | "female";

export type ParentRelationshipType = "biological" | "adoptive" | "step";

export type ParentLink = {
  parent_id: string;
  relationship_type: ParentRelationshipType;
};

export type Person = {
  id: string;
  name: string;
  gender: Gender;
  birth_date: string | null;
  death_date: string | null;
  family_name: string | null;
  birth_place: string | null;
  death_place: string | null;
  notes: string | null;
  parents: ParentLink[];
  marriage_id: string | null;
  photo_object_key: string | null;
  photo_url: string | null;
};

export type PersonCreateInput = {
  name: string;
  gender: Gender;
  birth_date?: string | null;
  death_date?: string | null;
  family_name?: string | null;
  birth_place?: string | null;
  death_place?: string | null;
  notes?: string | null;
  parents?: ParentLink[];
  marriage_id?: string | null;
  photo_object_key?: string | null;
};

export type PersonUpdateData = {
  name?: string;
  gender?: Gender;
  birth_date?: string | null;
  death_date?: string | null;
  family_name?: string | null;
  birth_place?: string | null;
  death_place?: string | null;
  notes?: string | null;
  parents?: ParentLink[];
  marriage_id?: string | null;
  photo_object_key?: string | null;
};

export type Marriage = {
  id: string;
  spouse_a_id: string;
  spouse_b_id: string;
  married_at: string | null;
  divorced_at: string | null;
};

export type MarriageCreateInput = {
  spouse_a_id: string;
  spouse_b_id: string;
  married_at: string;
};

export type MarriageUpdateData = {
  spouse_a_id?: string;
  spouse_b_id?: string;
  married_at?: string;
  divorced_at?: string | null;
};

export type ClosestRelationshipPath = {
  distance: number;
  path_person_ids: string[];
  relationship_types: string[];
};

export type ClosestRelationship = {
  from_person_id: string;
  to_person_id: string;
  found: boolean;
  distance: number | null;
  path_person_ids: string[];
  relationship_types: string[];
  paths: ClosestRelationshipPath[];
};

export type MediaUploadResult = {
  object_key: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

/**
 * System RBAC permissions. Genealogy (person_*, marriage_*), media_upload, and
 * tree_member_add/remove moved to per-tree access, so they are no longer part
 * of the system role catalog.
 */
export const Permissions = {
  USER_CREATE: "user_create",
  USER_DELETE: "user_delete",
  USER_READ: "user_read",
  USER_UPDATE: "user_update",
  ROLE_CREATE: "role_create",
  ROLE_DELETE: "role_delete",
  ROLE_READ: "role_read",
  ROLE_UPDATE: "role_update",
  PERMISSION_READ: "permission_read",
  TICKET_CREATE: "ticket_create",
  TICKET_READ: "ticket_read",
  TICKET_REPLY: "ticket_reply",
  TREE_CREATE: "tree_create",
  TREE_READ: "tree_read",
  TREE_UPDATE: "tree_update",
  TREE_DELETE: "tree_delete",
} as const;

/**
 * System permissions that older backends may still return in the permission
 * catalog. The role picker filters these out so they never appear as
 * assignable system RBAC, regardless of what the API sends.
 */
export const REMOVED_SYSTEM_PERMISSIONS: ReadonlySet<string> = new Set([
  "person_create",
  "person_read",
  "person_update",
  "person_delete",
  "marriage_create",
  "marriage_read",
  "marriage_update",
  "marriage_delete",
  "marriage_divorce",
  "media_upload",
  "tree_member_add",
  "tree_member_remove",
]);

export function isAssignableSystemPermission(name: string): boolean {
  return !REMOVED_SYSTEM_PERMISSIONS.has(name);
}

export class AuthApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  readonly errorCode: number | string | null;

  constructor(
    message: string,
    status: number,
    detail?: unknown,
    errorCode: number | string | null = null,
  ) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.detail = detail;
    this.errorCode = errorCode;
  }
}

/** Prefer backend `message`, then AuthApiError.message, else fallback. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthApiError && error.message.trim()) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
