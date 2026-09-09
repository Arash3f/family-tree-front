/**
 * A fake backend for Playwright runs, so the authenticated screens can be
 * exercised without standing up the real API. The fixtures deliberately lean
 * long — names, tree names, and ticket titles are sized to the worst realistic
 * case, because responsive layout only breaks on the long strings.
 */

const ALL_PERMISSIONS = [
  "user_create",
  "user_delete",
  "user_read",
  "user_update",
  "role_create",
  "role_delete",
  "role_read",
  "role_update",
  "permission_read",
  "marriage_create",
  "marriage_read",
  "marriage_update",
  "marriage_delete",
  "marriage_divorce",
  "person_create",
  "person_read",
  "person_update",
  "person_delete",
  "media_upload",
  "ticket_create",
  "ticket_read",
  "ticket_reply",
  "tree_create",
  "tree_read",
  "tree_update",
  "tree_delete",
  "tree_member_add",
  "tree_member_remove",
];

const LONG_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TREE_ID = "22222222-2222-4222-8222-222222222222";
const ROLE_ID = "33333333-3333-4333-8333-333333333333";
const TICKET_ID = "44444444-4444-4444-8444-444444444444";

const ME = {
  id: USER_ID,
  username: "abdolrahman.mohammadi",
  fullname: "عبدالرحمان محمدی‌نژاد اصفهانی",
  role_id: ROLE_ID,
  role_name: "Administrator with full access",
  permissions: ALL_PERMISSIONS,
  permission_details: ALL_PERMISSIONS.map((name) => ({
    name,
    description_en: `Allows the holder to ${name.replace(/_/g, " ")} within any tree they can reach.`,
    description_fa: `به دارنده اجازه می‌دهد در هر درختی که به آن دسترسی دارد، ${name.replace(/_/g, " ")} را انجام دهد.`,
  })),
  session_id: "session-current",
};

const SESSIONS = [
  {
    id: "session-current",
    user_agent: LONG_UA,
    ip_address: "192.168.100.201",
    created_at: "2026-08-01T09:15:00Z",
    expires_at: "2026-09-01T09:15:00Z",
    is_current: true,
  },
  {
    id: "session-other",
    user_agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    ip_address: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    created_at: "2026-07-22T18:40:00Z",
    expires_at: "2026-08-22T18:40:00Z",
    is_current: false,
  },
];

const USERS = [
  {
    id: USER_ID,
    username: "abdolrahman.mohammadi",
    fullname: "عبدالرحمان محمدی‌نژاد اصفهانی",
    role_id: ROLE_ID,
    last_session_at: "2026-08-14T21:05:00Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    username: "a.very.long.username.for.overflow.testing",
    fullname: "Bartholomew Fitzgerald-Montgomery III",
    role_id: null,
    last_session_at: null,
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    username: "zahra.k",
    fullname: "زهرا کریمی",
    role_id: ROLE_ID,
    last_session_at: "2026-08-10T07:00:00Z",
  },
];

const ROLES = [
  { id: ROLE_ID, name: "Administrator with full access", permission_ids: [], user_count: 2 },
  { id: "77777777-7777-4777-8777-777777777777", name: "مدیر درخت خانوادگی", permission_ids: [], user_count: 5 },
];

const PERMISSIONS = ALL_PERMISSIONS.map((name, index) => ({
  id: `perm-${index}`,
  name,
  description_en: `Allows the holder to ${name.replace(/_/g, " ")}.`,
  description_fa: `اجازه‌ی ${name.replace(/_/g, " ")}.`,
}));

ROLES[0].permission_ids = PERMISSIONS.map((p) => p.id);
ROLES[1].permission_ids = PERMISSIONS.slice(0, 8).map((p) => p.id);

const TREES = [
  {
    id: TREE_ID,
    name: "شجره‌نامه‌ی خاندان محمدی‌نژاد اصفهانی",
    owner_user_id: USER_ID,
    my_permissions: ["view", "edit", "add_persons"],
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    name: "A Shared Tree With A Deliberately Very Long Name For Layout Testing",
    owner_user_id: "55555555-5555-4555-8555-555555555555",
    my_permissions: ["view"],
  },
];

const TICKETS = [
  {
    id: TICKET_ID,
    title: "Export to PDF renders the top of the tree incorrectly on A3 paper",
    status: "open",
    category: "bug",
    created_by_user_id: USER_ID,
    created_by_can_manage: true,
    viewer_can_manage: true,
    family_tree_id: TREE_ID,
    family_tree_name: TREES[0].name,
    created_at: "2026-08-12T10:00:00Z",
    updated_at: "2026-08-13T11:30:00Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    title: "درخواست افزودن قابلیت جست‌وجوی پیشرفته در فهرست افراد",
    status: "in_progress",
    category: "feature_request",
    created_by_user_id: "66666666-6666-4666-8666-666666666666",
    created_by_can_manage: false,
    viewer_can_manage: true,
    family_tree_id: null,
    family_tree_name: null,
    created_at: "2026-08-05T08:20:00Z",
    updated_at: "2026-08-11T16:45:00Z",
  },
];

const TICKET_DETAIL = {
  ...TICKETS[0],
  messages: [
    {
      id: "msg-1",
      ticket_id: TICKET_ID,
      author_user_id: USER_ID,
      body: "When exporting a tree with more than roughly two hundred people to A3 landscape, the top row of cards is cut in half on the first page and repeated on the second. Smaller trees are fine.",
      created_at: "2026-08-12T10:00:00Z",
      updated_at: null,
    },
    {
      id: "msg-2",
      ticket_id: TICKET_ID,
      author_user_id: "66666666-6666-4666-8666-666666666666",
      body: "ممنون از گزارش. توانستیم بازتولیدش کنیم و به‌نظر می‌رسد مربوط به هم‌پوشانی صفحه‌هاست. در نسخه‌ی بعدی اصلاح می‌شود.",
      created_at: "2026-08-13T11:30:00Z",
      updated_at: null,
    },
  ],
};

const MEMBERS = [
  {
    id: "mem-1",
    tree_id: TREE_ID,
    user_id: USER_ID,
    role: "owner",
    permissions: ["view", "edit", "add_persons"],
    username: "abdolrahman.mohammadi",
  },
  {
    id: "mem-2",
    tree_id: TREE_ID,
    user_id: "66666666-6666-4666-8666-666666666666",
    role: "member",
    permissions: ["view"],
    username: "zahra.k",
  },
];

/** A small but structurally complete pedigree: four generations, two branches. */
function buildTree() {
  const persons = [];
  const marriages = [];
  const id = (n) => `p-${String(n).padStart(3, "0")}`;
  const mid = (n) => `m-${String(n).padStart(3, "0")}`;

  const add = (n, name, gender, parents, marriageId, extra = {}) => {
    persons.push({
      id: id(n),
      name,
      gender,
      birth_date: extra.birth ?? "1950-01-01",
      death_date: extra.death ?? null,
      family_name: extra.family ?? "محمدی‌نژاد",
      birth_place: "اصفهان",
      death_place: null,
      notes: null,
      parents: parents.map((p) => ({
        parent_id: id(p),
        relationship_type: "biological",
      })),
      marriage_id: marriageId ? mid(marriageId) : null,
      photo_object_key: null,
      photo_url: null,
    });
  };

  add(1, "غلامحسین", "male", [], 1, { birth: "1920-03-11", death: "1998-06-02" });
  add(2, "فاطمه", "female", [], 1, { birth: "1925-08-19", death: "2004-01-14" });
  marriages.push({
    id: mid(1),
    spouse_a_id: id(1),
    spouse_b_id: id(2),
    married_at: "1945-05-01",
    divorced_at: null,
  });

  add(3, "محمدرضا", "male", [1, 2], 2, { birth: "1948-02-20" });
  add(4, "Elizabeth Anne Whitmore-Castellanos", "female", [], 2, {
    birth: "1951-11-05",
    family: "Whitmore-Castellanos",
  });
  marriages.push({
    id: mid(2),
    spouse_a_id: id(3),
    spouse_b_id: id(4),
    married_at: "1972-09-14",
    divorced_at: "1995-03-30",
  });

  add(5, "زهرا", "female", [1, 2], 3, { birth: "1952-07-07" });
  add(6, "اسماعیل", "male", [], 3, { birth: "1949-04-18" });
  marriages.push({
    id: mid(3),
    spouse_a_id: id(6),
    spouse_b_id: id(5),
    married_at: "1974-01-22",
    divorced_at: null,
  });

  add(7, "علی‌اکبر", "male", [3, 4], 4, { birth: "1975-06-30" });
  add(8, "مریم", "female", [], 4, { birth: "1978-12-01" });
  marriages.push({
    id: mid(4),
    spouse_a_id: id(7),
    spouse_b_id: id(8),
    married_at: "2001-04-11",
    divorced_at: null,
  });

  add(9, "سارا", "female", [3, 4], null, { birth: "1980-10-12" });
  add(10, "حسین", "male", [5, 6], null, { birth: "1977-02-02" });
  add(11, "امیرحسین", "male", [7, 8], null, { birth: "2003-05-16" });
  add(12, "نرگس", "female", [7, 8], null, { birth: "2006-09-09" });

  return { persons, marriages };
}

const TREE_DATA = buildTree();

function paginate(items, body) {
  let page = 1;
  let pageSize = 100;
  try {
    const parsed = JSON.parse(body || "{}");
    page = parsed?.pagination?.page ?? 1;
    pageSize = parsed?.pagination?.page_size ?? 100;
  } catch {
    // Body is optional for some list calls.
  }
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  };
}

/**
 * Installs the mock onto a Playwright page. Returns a list of any request the
 * mock did not recognise, so a route that quietly 404s is visible in the run
 * rather than showing up as an empty screen.
 */
export async function installMockApi(page) {
  const unmatched = [];

  await page.route("**/backend/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname.replace(/^\/backend/, "");
    const method = request.method();
    const body = request.postData();

    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });

    if (p === "/health") return json({ status: "ok", postgres: "ok", neo4j: "ok" });
    if (p === "/auth/me") return json(ME);
    if (p === "/auth/sessions") return json(SESSIONS);
    if (p === "/auth/login")
      return json({ access_token: "t", refresh_token: "r", token_type: "bearer" });
    if (p === "/auth/refresh")
      return json({ access_token: "t", refresh_token: "r", token_type: "bearer" });
    if (p === "/auth/logout" || p === "/auth/logout-all") return json({});

    if (p === "/users/list") return json(paginate(USERS, body));
    if (p === "/roles/list") return json(paginate(ROLES, body));
    if (p === "/permissions/list") return json(paginate(PERMISSIONS, body));
    if (p === "/tickets/list") return json(paginate(TICKETS, body));

    if (p === "/family-trees" && method === "GET") return json(TREES);

    let m;
    if ((m = p.match(/^\/users\/([^/]+)\/sessions$/))) return json(SESSIONS);
    if ((m = p.match(/^\/users\/([^/]+)$/)))
      return json(USERS.find((u) => u.id === m[1]) ?? USERS[0]);
    if ((m = p.match(/^\/roles\/([^/]+)$/)))
      return json(ROLES.find((r) => r.id === m[1]) ?? ROLES[0]);
    if ((m = p.match(/^\/tickets\/([^/]+)$/))) return json(TICKET_DETAIL);
    if ((m = p.match(/^\/family-trees\/([^/]+)\/members$/))) return json(MEMBERS);
    if ((m = p.match(/^\/family-trees\/([^/]+)\/persons\/list$/)))
      return json(paginate(TREE_DATA.persons, body));
    if ((m = p.match(/^\/family-trees\/([^/]+)\/marriages\/list$/)))
      return json(paginate(TREE_DATA.marriages, body));
    if ((m = p.match(/^\/family-trees\/([^/]+)$/)))
      return json(TREES.find((t) => t.id === m[1]) ?? TREES[0]);

    unmatched.push(`${method} ${p}`);
    return json({ detail: "not mocked" }, 404);
  });

  return unmatched;
}

export const MOCK_IDS = { USER_ID, TREE_ID, ROLE_ID, TICKET_ID };
