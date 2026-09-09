import { allOrCancelled, getApiBaseUrl } from "@/lib/api";
import {
  buildExportBasename,
  downloadBlob,
  filenameFromDisposition,
} from "@/lib/pedigree/download";
import {
  clearStoredTokens,
  getStoredTokens,
  isTokenStorageEventKey,
  setStoredTokens,
} from "./storage";
import {
  isAccessTokenExpired,
  msUntilProactiveRefresh,
} from "./token-timing";
import {
  AuthApiError,
  type AppPermission,
  type AppRole,
  type AppUser,
  type AuthTokens,
  type AuthUser,
  type ClosestRelationship,
  type FamilyTree,
  type Marriage,
  type MarriageCreateInput,
  type MarriageUpdateData,
  type MediaUploadResult,
  type Paginated,
  type Person,
  type PersonCreateInput,
  type PersonUpdateData,
  type TicketCategory,
  type TicketDetail,
  type TicketMessage,
  type TicketStatus,
  type TicketSummary,
  type TreeMembership,
  type UserSession,
} from "./types";

type ApiFetchOptions = RequestInit & {
  skipAuth?: boolean;
  _retried?: boolean;
};

let refreshInFlight: Promise<AuthTokens | null> | null = null;
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let storageListenerAttached = false;
const authListeners = new Set<() => void>();
const REFRESH_LOCK_NAME = "ft-auth-refresh";
const REFRESH_LOCK_STORAGE_KEY = "ft.refresh_lock";
const REFRESH_LOCK_TTL_MS = 15_000;

export function subscribeAuthChange(listener: () => void): () => void {
  ensureStorageSyncListener();
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function notifyAuthChange(): void {
  authListeners.forEach((listener) => listener());
}

function clearProactiveRefreshTimer(): void {
  if (proactiveRefreshTimer !== null) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

export function scheduleProactiveTokenRefresh(): void {
  if (typeof window === "undefined") return;

  clearProactiveRefreshTimer();
  const tokens = getStoredTokens();
  if (!tokens?.access_token) return;

  const delay = msUntilProactiveRefresh(tokens.access_token);
  if (delay === null) return;

  proactiveRefreshTimer = setTimeout(() => {
    proactiveRefreshTimer = null;
    void refreshTokens().finally(() => scheduleProactiveTokenRefresh());
  }, delay);
}

function ensureStorageSyncListener(): void {
  if (typeof window === "undefined" || storageListenerAttached) return;
  storageListenerAttached = true;

  window.addEventListener("storage", (event) => {
    if (!isTokenStorageEventKey(event.key)) return;
    scheduleProactiveTokenRefresh();
    notifyAuthChange();
  });
}

async function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, run);
  }
  return withStorageRefreshLock(run);
}

async function withStorageRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") return run();

  const deadline = Date.now() + REFRESH_LOCK_TTL_MS;
  while (Date.now() < deadline) {
    const now = Date.now();
    const raw = localStorage.getItem(REFRESH_LOCK_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(REFRESH_LOCK_STORAGE_KEY, String(now));
      try {
        return await run();
      } finally {
        localStorage.removeItem(REFRESH_LOCK_STORAGE_KEY);
      }
    }

    const acquiredAt = Number(raw);
    if (!Number.isFinite(acquiredAt) || now - acquiredAt > REFRESH_LOCK_TTL_MS) {
      localStorage.setItem(REFRESH_LOCK_STORAGE_KEY, String(now));
      try {
        return await run();
      } finally {
        localStorage.removeItem(REFRESH_LOCK_STORAGE_KEY);
      }
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }

  return run();
}

async function performTokenRefresh(): Promise<AuthTokens | null> {
  const current = getStoredTokens();
  if (!current?.refresh_token) {
    clearStoredTokens();
    notifyAuthChange();
    return null;
  }

  if (!isAccessTokenExpired(current.access_token, 5_000)) {
    return current;
  }

  const refreshTokenUsed = current.refresh_token;

  try {
    const response = await fetch(authUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshTokenUsed }),
      cache: "no-store",
    });

    if (!response.ok) {
      const latest = getStoredTokens();
      if (
        latest?.refresh_token &&
        latest.refresh_token !== refreshTokenUsed &&
        !isAccessTokenExpired(latest.access_token, 5_000)
      ) {
        return latest;
      }

      clearStoredTokens();
      notifyAuthChange();
      return null;
    }

    const tokens = (await response.json()) as AuthTokens;
    setStoredTokens(tokens);
    notifyAuthChange();
    scheduleProactiveTokenRefresh();
    return tokens;
  } catch {
    const latest = getStoredTokens();
    if (
      latest?.refresh_token &&
      latest.refresh_token !== refreshTokenUsed &&
      !isAccessTokenExpired(latest.access_token, 5_000)
    ) {
      return latest;
    }

    clearStoredTokens();
    notifyAuthChange();
    return null;
  }
}

function authUrl(path: string): string {
  const normalized =
    path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") : path;
  return `${getApiBaseUrl()}${normalized}`;
}

export async function parseError(response: Response): Promise<AuthApiError> {
  const body = await response.json().catch(() => null);
  let message = `Request failed (${response.status})`;
  let detail: unknown = body;
  let errorCode: number | string | null = null;

  if (body && typeof body === "object") {
    const payload = body as Record<string, unknown>;
    detail = "detail" in payload ? payload.detail : body;

    if (typeof payload.message === "string" && payload.message.trim()) {
      message = payload.message.trim();
    } else if (typeof detail === "string" && detail.trim()) {
      message = detail.trim();
    } else if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (typeof first === "string" && first.trim()) {
        message = first.trim();
      } else if (first && typeof first === "object" && "msg" in first) {
        message = String((first as { msg: unknown }).msg);
      }
    }

    if (
      typeof payload.error_code === "number" ||
      typeof payload.error_code === "string"
    ) {
      errorCode = payload.error_code;
    }
  }

  return new AuthApiError(message, response.status, detail, errorCode);
}

async function refreshTokens(): Promise<AuthTokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = withRefreshLock(performTokenRefresh).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { skipAuth = false, _retried = false, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (
    typeof document !== "undefined" &&
    !requestHeaders.has("Accept-Language")
  ) {
    const lang = document.documentElement.lang?.trim() || "en";
    requestHeaders.set("Accept-Language", lang);
  }

  if (!skipAuth) {
    const tokens = getStoredTokens();
    if (tokens?.access_token) {
      requestHeaders.set("Authorization", `Bearer ${tokens.access_token}`);
    }
  }

  const response = await fetch(authUrl(path), {
    ...rest,
    headers: requestHeaders,
    cache: "no-store",
  });

  if (skipAuth || response.status !== 401 || _retried) {
    return response;
  }

  const refreshed = await refreshTokens();
  if (!refreshed) {
    return response;
  }

  return apiFetch(path, { ...options, _retried: true });
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<AuthTokens> {
  const body = new URLSearchParams({
    username,
    password,
    grant_type: "password",
  });

  const response = await apiFetch("/auth/login", {
    method: "POST",
    skipAuth: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokens = await jsonOrThrow<AuthTokens>(response);
  setStoredTokens(tokens);
  notifyAuthChange();
  scheduleProactiveTokenRefresh();
  return tokens;
}

export async function registerRequest(input: {
  username: string;
  password: string;
  re_password: string;
  email?: string | null;
  phone?: string | null;
  country_code?: string | null;
}): Promise<AuthTokens> {
  const response = await apiFetch("/auth/register", {
    method: "POST",
    skipAuth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: input.username,
      password: input.password,
      re_password: input.re_password,
      email: input.email || null,
      phone: input.phone || null,
      country_code: input.country_code || null,
    }),
  });

  const tokens = await jsonOrThrow<AuthTokens>(response);
  setStoredTokens(tokens);
  notifyAuthChange();
  scheduleProactiveTokenRefresh();
  return tokens;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch("/auth/me");
  const data = await jsonOrThrow<
    Partial<AuthUser> & { id: string; username: string; fullname: string }
  >(response);
  return {
    id: data.id,
    username: data.username,
    fullname: data.fullname,
    email: data.email ?? null,
    phone: data.phone ?? null,
    role_id: data.role_id ?? null,
    role_name: data.role_name ?? null,
    permissions: data.permissions ?? [],
    permission_details: data.permission_details ?? [],
    session_id: data.session_id ?? "",
    account_type: data.account_type === "paid" ? "paid" : "free",
  };
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    clearProactiveRefreshTimer();
    clearStoredTokens();
    notifyAuthChange();
  }
}

export async function logoutAllRequest(): Promise<void> {
  try {
    await apiFetch("/auth/logout-all", { method: "POST" });
  } finally {
    clearProactiveRefreshTimer();
    clearStoredTokens();
    notifyAuthChange();
  }
}

export async function fetchMySessions(): Promise<UserSession[]> {
  const response = await apiFetch("/auth/sessions");
  return jsonOrThrow<UserSession[]>(response);
}

export async function revokeMySession(sessionId: string): Promise<void> {
  const response = await apiFetch(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
  await jsonOrThrow(response);
}

export async function changeOwnPassword(input: {
  current_password: string;
  new_password: string;
  re_password: string;
}): Promise<void> {
  const response = await apiFetch("/auth/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await jsonOrThrow(response);
}

export async function listUsers(page = 1, pageSize = 30): Promise<Paginated<AppUser>> {
  const response = await apiFetch("/users/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pagination: { page, page_size: pageSize, offset: 0 },
      filters: {},
      sort: { sort_order: "desc", sort_by: "id" },
    }),
  });
  return jsonOrThrow(response);
}

export async function getUser(userId: string): Promise<AppUser> {
  const response = await apiFetch(`/users/${userId}`);
  return jsonOrThrow(response);
}

export async function createUser(input: {
  username: string;
  fullname: string;
  password: string;
  re_password: string;
  role_id?: string | null;
  account_type?: "free" | "paid";
}): Promise<AppUser> {
  const response = await apiFetch("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(response);
}

export async function updateUser(input: {
  user_id: string;
  username?: string;
  fullname?: string;
  password?: string;
  re_password?: string;
  role_id?: string | null;
  account_type?: "free" | "paid";
}): Promise<AppUser> {
  const data: Record<string, unknown> = {};
  if (input.username !== undefined) data.username = input.username;
  if (input.fullname !== undefined) data.fullname = input.fullname;
  if (input.password !== undefined) data.password = input.password;
  if (input.re_password !== undefined) data.re_password = input.re_password;
  if (input.role_id !== undefined) data.role_id = input.role_id;
  if (input.account_type !== undefined) data.account_type = input.account_type;

  const response = await apiFetch("/users", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      where: { user_id: input.user_id },
      data,
    }),
  });
  return jsonOrThrow(response);
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await apiFetch(`/users/${userId}`, {
    method: "DELETE",
  });
  await jsonOrThrow(response);
}

export async function listUserSessions(userId: string): Promise<UserSession[]> {
  const response = await apiFetch(`/users/${userId}/sessions`);
  return jsonOrThrow(response);
}

export async function revokeUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const response = await apiFetch(`/users/${userId}/sessions/${sessionId}`, {
    method: "DELETE",
  });
  await jsonOrThrow(response);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const response = await apiFetch(`/users/${userId}/sessions/revoke-all`, {
    method: "POST",
  });
  await jsonOrThrow(response);
}

export async function listRoles(page = 1, pageSize = 100): Promise<Paginated<AppRole>> {
  const response = await apiFetch("/roles/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pagination: { page, page_size: pageSize, offset: 0 },
      filters: {},
      sort: { sort_order: "asc", sort_by: "name" },
    }),
  });
  return jsonOrThrow(response);
}

export async function getRole(roleId: string): Promise<AppRole> {
  const response = await apiFetch(`/roles/${roleId}`);
  return jsonOrThrow(response);
}

export async function createRole(input: {
  name: string;
  permission_ids: string[];
}): Promise<AppRole> {
  const response = await apiFetch("/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(response);
}

export async function updateRole(input: {
  role_id: string;
  name?: string;
  permission_ids?: string[];
}): Promise<AppRole> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.permission_ids !== undefined) data.permission_ids = input.permission_ids;

  const response = await apiFetch("/roles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      where: { role_id: input.role_id },
      data,
    }),
  });
  return jsonOrThrow(response);
}

export async function deleteRole(roleId: string): Promise<void> {
  const response = await apiFetch(`/roles/${roleId}`, {
    method: "DELETE",
  });
  await jsonOrThrow(response);
}

export async function listPermissions(
  page = 1,
  pageSize = 100,
): Promise<Paginated<AppPermission>> {
  const response = await apiFetch("/permissions/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pagination: { page, page_size: pageSize, offset: 0 },
      filters: {},
      sort: { sort_order: "asc", sort_by: "name" },
    }),
  });
  return jsonOrThrow(response);
}

export async function listTickets(options?: {
  page?: number;
  pageSize?: number;
  status?: TicketStatus | null;
  category?: TicketCategory | null;
  familyTreeId?: string | null;
}): Promise<Paginated<TicketSummary>> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 30;
  const filters: Record<string, unknown> = {};
  if (options?.status) filters.status = options.status;
  if (options?.category) filters.category = options.category;
  if (options?.familyTreeId) filters.family_tree_id = options.familyTreeId;

  const response = await apiFetch("/tickets/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pagination: { page, page_size: pageSize, offset: 0 },
      filters,
      sort: { sort_order: "desc", sort_by: "created_at" },
    }),
  });
  return jsonOrThrow(response);
}

export async function getTicket(ticketId: string): Promise<TicketDetail> {
  const response = await apiFetch(`/tickets/${ticketId}`);
  return jsonOrThrow(response);
}

export async function createTicket(input: {
  title: string;
  body: string;
  category: TicketCategory;
  family_tree_id?: string | null;
}): Promise<TicketDetail> {
  const response = await apiFetch("/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(response);
}

export async function addTicketMessage(
  ticketId: string,
  body: string,
): Promise<TicketMessage> {
  const response = await apiFetch(`/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return jsonOrThrow(response);
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Promise<TicketSummary> {
  const response = await apiFetch(`/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return jsonOrThrow(response);
}

export async function listFamilyTrees(): Promise<FamilyTree[]> {
  const response = await apiFetch("/family-trees");
  return jsonOrThrow(response);
}

export async function getFamilyTree(
  treeId: string,
  signal?: AbortSignal,
): Promise<FamilyTree> {
  const response = await apiFetch(`/family-trees/${treeId}`, { signal });
  return jsonOrThrow(response);
}

export async function createFamilyTree(input: {
  name: string;
}): Promise<FamilyTree> {
  const response = await apiFetch("/family-trees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(response);
}

export async function updateFamilyTree(
  treeId: string,
  input: { name: string },
): Promise<FamilyTree> {
  const response = await apiFetch(`/family-trees/${treeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(response);
}

export async function deleteFamilyTree(treeId: string): Promise<void> {
  const response = await apiFetch(`/family-trees/${treeId}`, {
    method: "DELETE",
  });
  await jsonOrThrow(response);
}

export async function listTreeMembers(
  treeId: string,
): Promise<TreeMembership[]> {
  const response = await apiFetch(`/family-trees/${treeId}/members`);
  return jsonOrThrow(response);
}

export async function addTreeMember(
  treeId: string,
  username: string,
  permissions: string[] = ["view"],
): Promise<TreeMembership> {
  const response = await apiFetch(`/family-trees/${treeId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, permissions }),
  });
  return jsonOrThrow(response);
}

export async function updateTreeMember(
  treeId: string,
  userId: string,
  permissions: string[],
): Promise<TreeMembership> {
  const response = await apiFetch(
    `/family-trees/${treeId}/members/${userId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    },
  );
  return jsonOrThrow(response);
}

export async function removeTreeMember(
  treeId: string,
  userId: string,
): Promise<void> {
  const response = await apiFetch(
    `/family-trees/${treeId}/members/${userId}`,
    { method: "DELETE" },
  );
  await jsonOrThrow(response);
}

/**
 * Fetch every page of a paginated endpoint.
 *
 * The first page also reports `total`, which tells us exactly how many more
 * pages exist — so the remainder go out together instead of one after another.
 * A 500-person tree drops from five sequential round-trips to two.
 *
 * Pages are large deliberately: fewer, fatter requests beat many small ones
 * once latency dominates, which it does here.
 */
async function listAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Paginated<T>>,
  signal?: AbortSignal,
): Promise<T[]> {
  // Must not exceed the API's MAX_PAGE_SIZE (100); a larger value is rejected
  // with 422 and no rows come back at all.
  const pageSize = 100;
  const first = await fetchPage(1, pageSize);

  const total = first.total;
  if (signal?.aborted || first.items.length === 0 || total <= first.items.length) {
    return first.items;
  }

  const pageCount = Math.ceil(total / pageSize);
  const rest = await allOrCancelled(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchPage(index + 2, pageSize),
    ),
    signal,
  );
  // Cancelled: the caller is gone, so what already arrived is as good an answer
  // as any. Callers that pass a signal check it before using the result.
  if (!rest) return first.items;

  const items = [...first.items];
  for (const page of rest) items.push(...page.items);
  return items;
}

export async function listPersons(
  treeId: string,
  options?: { page?: number; pageSize?: number; signal?: AbortSignal },
): Promise<Paginated<Person>> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 100;
  const response = await apiFetch(`/family-trees/${treeId}/persons/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options?.signal,
    body: JSON.stringify({
      pagination: { page, page_size: pageSize, offset: 0 },
      filters: {},
      sort: { sort_order: "asc", sort_by: "name" },
    }),
  });
  return jsonOrThrow(response);
}

export async function listAllPersons(
  treeId: string,
  signal?: AbortSignal,
): Promise<Person[]> {
  return listAllPages(
    (page, pageSize) => listPersons(treeId, { page, pageSize, signal }),
    signal,
  );
}

export async function getPerson(
  treeId: string,
  personId: string,
): Promise<Person> {
  const response = await apiFetch(
    `/family-trees/${treeId}/persons/${personId}`,
  );
  return jsonOrThrow(response);
}

export async function createPerson(
  treeId: string,
  input: PersonCreateInput,
): Promise<Person> {
  const response = await apiFetch(`/family-trees/${treeId}/persons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(response);
}

export async function updatePerson(
  treeId: string,
  personId: string,
  data: PersonUpdateData,
): Promise<Person> {
  const response = await apiFetch(`/family-trees/${treeId}/persons`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      where: { person_id: personId },
      data,
    }),
  });
  return jsonOrThrow(response);
}

export async function deletePerson(
  treeId: string,
  personId: string,
): Promise<void> {
  const response = await apiFetch(
    `/family-trees/${treeId}/persons/${personId}`,
    { method: "DELETE" },
  );
  await jsonOrThrow(response);
}

export async function getClosestRelationship(
  treeId: string,
  fromPersonId: string,
  toPersonId: string,
): Promise<ClosestRelationship> {
  const response = await apiFetch(
    `/family-trees/${treeId}/persons/${fromPersonId}/relation/${toPersonId}`,
  );
  const data = await jsonOrThrow<ClosestRelationship>(response);
  return {
    ...data,
    paths: Array.isArray(data.paths) ? data.paths : [],
  };
}

/** Diverse alternate kinship routes; follow-up after getClosestRelationship. */
export async function getAlternativeRelationshipPaths(
  treeId: string,
  fromPersonId: string,
  toPersonId: string,
  options?: { signal?: AbortSignal },
): Promise<ClosestRelationship> {
  const response = await apiFetch(
    `/family-trees/${treeId}/persons/${fromPersonId}/relation/${toPersonId}/alternatives`,
    { signal: options?.signal },
  );
  const data = await jsonOrThrow<ClosestRelationship>(response);
  return {
    ...data,
    paths: Array.isArray(data.paths) ? data.paths : [],
  };
}

export async function listMarriages(
  treeId: string,
  options?: { page?: number; pageSize?: number; signal?: AbortSignal },
): Promise<Paginated<Marriage>> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 100;
  const response = await apiFetch(`/family-trees/${treeId}/marriages/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options?.signal,
    body: JSON.stringify({
      pagination: { page, page_size: pageSize, offset: 0 },
      filters: {},
      sort: { sort_order: "desc", sort_by: "id" },
    }),
  });
  return jsonOrThrow(response);
}

export async function listAllMarriages(
  treeId: string,
  signal?: AbortSignal,
): Promise<Marriage[]> {
  return listAllPages(
    (page, pageSize) => listMarriages(treeId, { page, pageSize, signal }),
    signal,
  );
}

export async function getMarriage(
  treeId: string,
  marriageId: string,
): Promise<Marriage> {
  const response = await apiFetch(
    `/family-trees/${treeId}/marriages/${marriageId}`,
  );
  return jsonOrThrow(response);
}

export async function createMarriage(
  treeId: string,
  input: MarriageCreateInput,
): Promise<Marriage> {
  const response = await apiFetch(`/family-trees/${treeId}/marriages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(response);
}

export async function updateMarriage(
  treeId: string,
  marriageId: string,
  data: MarriageUpdateData,
): Promise<Marriage> {
  const response = await apiFetch(`/family-trees/${treeId}/marriages`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      where: { marriage_id: marriageId },
      data,
    }),
  });
  return jsonOrThrow(response);
}

export async function deleteMarriage(
  treeId: string,
  marriageId: string,
): Promise<void> {
  const response = await apiFetch(`/family-trees/${treeId}/marriages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: marriageId }),
  });
  await jsonOrThrow(response);
}

export async function divorceMarriage(
  treeId: string,
  marriageId: string,
  divorcedAt: string,
): Promise<void> {
  const response = await apiFetch(`/family-trees/${treeId}/marriages/divorce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marriage_id: marriageId,
      divorced_at: divorcedAt,
    }),
  });
  await jsonOrThrow(response);
}

export async function uploadMedia(
  treeId: string,
  file: File,
): Promise<MediaUploadResult> {
  const body = new FormData();
  // Prefer a real image MIME when the OS left File.type empty (common on mobile).
  const typed =
    file.type && file.type !== "application/octet-stream"
      ? file
      : new File([file], file.name, {
          type: guessImageMime(file.name) ?? "application/octet-stream",
          lastModified: file.lastModified,
        });
  body.append("file", typed);
  // Tree-scoped: uploading a person photo is gated by the tree's upload_photo
  // access, so the request carries the tree it belongs to.
  const response = await apiFetch(`/family-trees/${treeId}/media/upload`, {
    method: "POST",
    body,
  });
  return jsonOrThrow(response);
}

function guessImageMime(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

async function downloadBinary(path: string, fallbackName: string): Promise<void> {
  const response = await apiFetch(path);
  if (!response.ok) {
    throw await parseError(response);
  }
  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackName,
  );
  downloadBlob(blob, filename.replace(/\.xlsx$/i, ""), "xlsx");
}

export async function downloadTreeExcelSample(
  treeId: string,
  treeName?: string,
): Promise<void> {
  const locale =
    typeof document !== "undefined"
      ? document.documentElement.lang?.trim() || "en"
      : "en";
  const suffix = locale.startsWith("fa") ? "fa" : "en";
  const base = buildExportBasename(
    [treeName, "sample", suffix],
    `family-tree-sample-${suffix}`,
  );
  await downloadBinary(`/family-trees/${treeId}/excel/sample`, `${base}.xlsx`);
}

export async function exportTreeExcel(
  treeId: string,
  treeName?: string,
): Promise<void> {
  const locale =
    typeof document !== "undefined"
      ? document.documentElement.lang?.trim() || "en"
      : "en";
  const suffix = locale.startsWith("fa") ? "fa" : "en";
  const base = buildExportBasename(
    [treeName, "export", suffix],
    `family-tree-export-${suffix}`,
  );
  await downloadBinary(`/family-trees/${treeId}/excel/export`, `${base}.xlsx`);
}

export type TreeExcelImportResult = {
  persons_created: number;
  marriages_created: number;
};

export type TreeExcelPreviewPerson = {
  ref: string;
  name: string;
  family_name: string | null;
  gender: string;
  birth_date: string | null;
  death_date: string | null;
  parent1_ref: string | null;
  parent2_ref: string | null;
  marriage_ref: string | null;
  row_number: number;
  already_exists: boolean;
  existing_label: string | null;
  duplicate_of_ref: string | null;
  warning: string | null;
  /** Who the *_ref codes point at, so the preview reads without decoding them. */
  parent1_label: string | null;
  parent2_label: string | null;
  marriage_label: string | null;
};

export type TreeExcelPreviewMarriage = {
  ref: string;
  spouse_a_ref: string;
  spouse_b_ref: string;
  married_at: string;
  divorced_at: string | null;
  row_number: number;
  already_exists: boolean;
  duplicate_of_ref: string | null;
  warning: string | null;
  spouse_a_label: string | null;
  spouse_b_label: string | null;
};

export type TreeExcelImportInclude = {
  person_refs: string[];
  marriage_refs: string[];
};

export type TreeExcelPreviewResult = {
  valid: boolean;
  persons: TreeExcelPreviewPerson[];
  marriages: TreeExcelPreviewMarriage[];
  errors: string[];
};

export async function previewTreeExcel(
  treeId: string,
  file: File,
): Promise<TreeExcelPreviewResult> {
  const body = new FormData();
  body.append("file", file);
  const response = await apiFetch(`/family-trees/${treeId}/excel/import/preview`, {
    method: "POST",
    body,
  });
  return jsonOrThrow(response);
}

export async function importTreeExcel(
  treeId: string,
  file: File,
  include?: TreeExcelImportInclude,
): Promise<TreeExcelImportResult> {
  const body = new FormData();
  body.append("file", file);
  if (include) {
    body.append("include", JSON.stringify(include));
  }
  const response = await apiFetch(`/family-trees/${treeId}/excel/import`, {
    method: "POST",
    body,
  });
  return jsonOrThrow(response);
}

export function clearSession(): void {
  clearProactiveRefreshTimer();
  clearStoredTokens();
  notifyAuthChange();
}

export { refreshTokens };
