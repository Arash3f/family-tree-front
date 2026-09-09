# Family Tree Frontend

> Next.js client for the Family Tree API. Browse and edit multi-tenant trees, walk
> kinship paths on a canvas, and manage users, roles and support tickets — in English
> and Persian, light or dark.

**Next.js · React · TypeScript · next-intl · Zustand · XYFlow — same-origin `/backend` proxy to the API.**

| | |
|---|---|
| Version | `0.1.0` |
| Node | `22` (Alpine in Docker) |
| Package manager | [pnpm](https://pnpm.io) `10.34.5` |
| Companion API | [family-tree-backend](https://github.com/Arash3f/family-tree-backend) |

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Talking to the API](#talking-to-the-api)
- [Testing and quality](#testing-and-quality)
- [Commits](#commits)
- [Project layout](#project-layout)
- [Docker](#docker)
- [Troubleshooting](#troubleshooting)

---

## What it does

This app is the browser UI for a multi-tenant genealogy product. Each family tree is a
tenant: after sign-in you only see trees you belong to, and every person, marriage and
relationship query is scoped to that tree through the backend.

You can:

- Sign in with JWT access + refresh tokens, rotate sessions, and change your password
- Create and manage **family trees**, memberships and per-tree access
- Edit **persons** and **marriages**, upload photos, and ask for the **closest relationship path**
- Explore the tree on an interactive **pedigree canvas** (pan, zoom, collapse, export)
- **Import / export** Excel workbooks (preview before write)
- Administer **users**, **roles** and **permissions**, and raise **support tickets**
- Use the product in **English** or **Persian** (`en` / `fa`), with light or dark theme
- Install it as a **PWA** (service worker under `public/sw.js`)

### Design notes

**Browser never needs the API’s public host.** By default the client calls same-origin
`/backend/*`. A Next.js route handler proxies those requests to `API_PROXY_TARGET`,
forwarding `Authorization` and refusing to follow upstream redirects (so FastAPI slash
redirects cannot strip the bearer token).

**Tokens live in the browser; the proxy is not a BFF session store.** Access and refresh
tokens are kept in `localStorage`, refreshed proactively before expiry, and sent as
`Authorization: Bearer …` on each API call. The proxy only rewrites the URL.

**Locales are first-class routes.** Every page is under `/en/…` or `/fa/…` (`localePrefix:
always`). Copy lives in `messages/en.json` and `messages/fa.json`.

---

## Architecture

```
  Browser (Next.js App Router)
  ├── Landing / marketing  (locale site routes)
  ├── Auth screens         (login)
  ├── Dashboard            (trees, users, roles, tickets, profile)
  └── Pedigree canvas      (@xyflow/react + pedigree layout helpers)
           │
           │  fetch("/backend/…")   ← default NEXT_PUBLIC_API_BASE_URL
           ▼
  src/app/backend/[...path]/route.ts
           │  server-side proxy (preserves Auth, redirect: manual)
           ▼
  API_PROXY_TARGET  →  family-tree-backend  (FastAPI · Postgres · Neo4j · …)
```

| Layer | Responsibility |
|-------|----------------|
| `src/app/[locale]/…` | Routes: `(site)`, `(auth)`, `(app)/dashboard` |
| `src/components/…` | UI for landing, auth, dashboard, pedigree, shared primitives |
| `src/lib/auth/` | Token storage, refresh lock, API client, permissions / tree access |
| `src/lib/pedigree/` | Graph indexing, collapse, layout, image/PDF export |
| `src/lib/api.ts` | `getApiBaseUrl()`, health probe |
| `src/stores/` | Zustand stores (auth, feedback toasts) |
| `src/i18n/` | next-intl routing and request config |
| `messages/` | EN / FA catalogues |

Dependencies point toward `lib` and the API client: views call `src/lib/auth/client.ts`,
which builds URLs from `getApiBaseUrl()` and never hard-codes the upstream host.

---

## Tech stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Next.js `16.3` (App Router, `standalone` output) | RSC-friendly routing, production image without full `node_modules` |
| UI | React `19` + TypeScript `5` | Typed components, modern React |
| i18n | next-intl | Locale segments, message catalogues, RTL-ready FA |
| Theming | next-themes | Light / dark without flash |
| Pedigree | `@xyflow/react` | Canvas graph with controlled layout helpers |
| State | Zustand | Small client stores for auth session UI and toasts |
| Dates | react-multi-date-picker + react-date-object | Gregorian UI; Jalali-friendly where the product needs it |
| Quality | ESLint (next/core-web-vitals) · husky · lint-staged · commitlint | Gate commits on lint + conventional gitmoji messages |
| Runtime image | Node `22-alpine`, non-root `nextjs` user | Small surface, healthcheck on `:3000` |

---

## Quick start

**Requires Node 22+ and pnpm 10.34.5.** A reachable Family Tree API is needed for anything
beyond the static shell (see [Talking to the API](#talking-to-the-api)).

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open **http://localhost:5173** — the root redirects into the default locale (`/en`).

| | |
|---|---|
| Dev server | http://localhost:5173 |
| Health via proxy | http://localhost:5173/backend/health |
| API ReDoc (via proxy) | http://localhost:5173/backend/redoc |

Point `.env.local` at your API:

```env
API_PROXY_TARGET=http://127.0.0.1:8001
```

If the backend is already up (Compose quick start from the API repo publishes **8001**), the
dashboard and pedigree work against that instance with no CORS setup.

---

## Local development

### Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next dev server on port **5173** |
| `pnpm build` / `pnpm start` | Production build and start (also **5173** locally) |
| `pnpm lint` | ESLint |
| `pnpm test` | Node test runner over `src/**/*.test.mts` |
| `pnpm cz` | Guided commit (`git commit` → Commitizen hook) |
| `pnpm test:layout` / `pnpm test:export` | Playwright-assisted layout / export checks |
| `pnpm shots` | Landing screenshots |

### Phone / LAN preview

```bash
pnpm dev --hostname 0.0.0.0
```

Extra hosts that may load Next.js dev assets go in `DEV_ALLOWED_ORIGINS` (comma-separated) or
`allowedDevOrigins` in `next.config.ts`. Same-origin `/backend` still works from another
device on the LAN as long as the proxy can reach `API_PROXY_TARGET`.

### Working with the API repo

Typical split:

1. Run datastores + API from [family-tree-backend](https://github.com/Arash3f/family-tree-backend)
   (`docker compose …` or host uvicorn on `8001`)
2. Set `API_PROXY_TARGET=http://127.0.0.1:8001` in `.env.local`
3. Run `pnpm dev` here

Do not set `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:8001` unless you intentionally want
the **browser** to call the API cross-origin (CORS + cookie caveats). Prefer the proxy.

---

## Configuration

Environment is read at build time for `NEXT_PUBLIC_*` and at runtime for the server proxy.
[.env.example](.env.example) is the template; copy it to `.env.local` for development.

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `API_PROXY_TARGET` | Server only | `http://127.0.0.1:8001` | Upstream origin for `/backend/*` |
| `NEXT_PUBLIC_API_BASE_URL` | Client bundle | `/backend` | Base URL used by `getApiBaseUrl()` |
| `NEXT_PUBLIC_SITE_URL` | Build / metadata | (unset locally) | Canonical origin for sitemap, Open Graph, robots |
| `DEV_ALLOWED_ORIGINS` | Dev server | — | Extra hosts for Next.js `allowedDevOrigins` |

### Rules of thumb

- **Keep `NEXT_PUBLIC_API_BASE_URL=/backend` (or unset)** so the browser stays same-origin.
- **Change `API_PROXY_TARGET`** when the API moves (local port, staging host, production API).
- **Set `NEXT_PUBLIC_SITE_URL`** for production builds so metadata and sitemap use the real public origin.
- Trailing slashes on either base URL are stripped in code; do not rely on them.

---

## Talking to the API

All authenticated calls go through `src/lib/auth/client.ts` → `authUrl(path)` →
`${getApiBaseUrl()}${path}`. Media URLs returned as relative paths are resolved the same way
in `src/lib/media.ts` (photos stay on `/backend/media/…`, not a raw MinIO host).

Useful upstream docs (via proxy when the API is reachable):

| | |
|---|---|
| ReDoc | `/backend/redoc` |
| Swagger | `/backend/api_docs` |
| Health | `/backend/health` |

Contract details (list-as-`POST`, permissions, Excel preview, GraphQL) live in the
[backend README](https://github.com/Arash3f/family-tree-backend#api-reference). This frontend
mirrors those routes; it does not redefine them.

The service worker skips caching `/backend` so API responses are never served stale from the
PWA cache.

---

## Testing and quality

### Unit tests

Node’s built-in test runner, with a small alias hook for `@/` imports:

```bash
pnpm test
```

Coverage today is focused on pedigree layout/export helpers, auth timing / tree access, and
API health helpers (`src/**/*.test.mts`).

### Lint

```bash
pnpm lint
```

ESLint uses `eslint-config-next` (core-web-vitals + TypeScript). On commit, **lint-staged**
runs `eslint --fix` on staged `src/**/*.{js,jsx,ts,tsx}`.

### Browser-assisted scripts

| Script | Notes |
|--------|-------|
| `pnpm test:layout` | Layout probe (`scripts/check-layout.mjs`) |
| `pnpm test:export` | Export e2e (`scripts/export-e2e.mjs`) |
| `pnpm shots` | Landing screenshots |
| `pnpm bench:layout` | Layout micro-benchmark |

These expect a running app (and sometimes Playwright). They are not part of the husky
pre-commit hook.

---

## Commits

Husky wires three hooks (same idea as the backend’s Commitizen + gitmoji flow):

| Hook | Runs |
|------|------|
| `pre-commit` | `lint-staged` (ESLint `--fix` on staged source) |
| `prepare-commit-msg` | Commitizen (`cz-customizable`) for plain `git commit` / `pnpm cz` |
| `commit-msg` | `commitlint` with `commitlint-config-gitmoji` |

```bash
pnpm cz
# or
git commit          # opens the guided prompt when you omit -m
git commit -m "…"   # skips the prompt; commitlint still validates
```

Types and scopes are defined in [.cz-config.js](.cz-config.js) (kept in sync with
[.cz.toml](.cz.toml) for agent-assisted message drafting). Example:

```text
:sparkles: feat(pedigree): add branch folding controls
:wrench: fix(i18n): show localized permission labels
:package: chore(config): tighten Docker healthcheck
```

Scopes include `ui`, `auth`, `pedigree`, `landing`, `i18n`, `theme`, `api`, `lib`,
`config`, `docs`, `tests`, `ci`, `deps`. Scope may be omitted.

---

## Project layout

```
family-tree-front/
├── src/
│   ├── app/
│   │   ├── [locale]/           # (site) landing · (auth) login · (app) dashboard
│   │   └── backend/[...path]/ # Same-origin API proxy
│   ├── components/             # app · auth · landing · pedigree · ui · theme · pwa …
│   ├── lib/
│   │   ├── auth/               # client, storage, permissions, tree access
│   │   ├── pedigree/           # index, collapse, layout, export
│   │   ├── api.ts              # base URL + health
│   │   └── media.ts            # person photo URL resolution
│   ├── stores/                 # Zustand (auth, feedback)
│   ├── i18n/                   # routing + request
│   └── proxy.ts                # next-intl middleware matcher (skips /backend)
├── messages/                   # en.json · fa.json
├── public/                     # icons, sw.js, static assets
├── scripts/                    # layout / export / screenshot helpers
├── .husky/                     # pre-commit · commit-msg · prepare-commit-msg
├── .cz-config.js               # Commitizen prompts
├── commitlint.config.js
├── eslint.config.mjs
├── next.config.ts
└── Dockerfile                  # deps → builder → runner (standalone)
```

---

## Docker

Multi-stage production image: **deps → builder → runner** (Next.js `standalone`, non-root
user, healthcheck on `:3000`).

### Build

```bash
docker build -t familytree-frontend .
```

Client calls stay on `/backend` by default. Override only if you intentionally want the
browser to call the API cross-origin:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  -t familytree-frontend .
```

Default build-arg: `NEXT_PUBLIC_API_BASE_URL=/backend`.

Public site origin for sitemap / Open Graph / robots:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-frontend.example.com \
  -t familytree-frontend .
```

### Run

Point the server-side proxy at your API (required for `/backend/*`):

```bash
docker run --rm -p 3000:3000 \
  -e API_PROXY_TARGET=https://family-api.arash-alfooneh.ir \
  familytree-frontend
```

Open **http://localhost:3000**. Browser requests hit `/backend/health`; the container
forwards them to `API_PROXY_TARGET`.

### Image notes

- pnpm is installed via npm (pinned), with a GitHub static-binary fallback if the npm registry is unreachable
- BuildKit cache mounts the pnpm store (`--mount=type=cache`) to speed rebuilds
- Runtime ships only `public`, `.next/standalone`, and `.next/static` — no full `node_modules`
- Healthcheck: `GET http://127.0.0.1:3000/` every 30s after a 25s start period

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Dashboard stuck / auth errors, `/backend/health` unreachable | API down or wrong `API_PROXY_TARGET` | Confirm API on the target host/port; curl `API_PROXY_TARGET/health` from the machine running Next |
| Login works on localhost but fails from a phone on Wi‑Fi | Phone hits the Next host, but proxy still points at `127.0.0.1` of that phone | Run API on a LAN IP or Docker published port the **Next server** can reach; keep browser on `/backend` |
| `Authorization` missing after a 308 | Upstream redirected (trailing slash) | Proxy uses `redirect: "manual"`; ensure you are not bypassing it with a direct `NEXT_PUBLIC_API_BASE_URL` to the API |
| Stale API data in the installed PWA | Unlikely for `/backend` (SW bypasses it) | Hard-refresh or unregister the service worker if you changed caching logic |
| Commit rejected by commitlint | Message not gitmoji / unknown type or scope | Use `pnpm cz`, or match `.cz-config.js` (`:sparkles: feat(scope): …`) |
| `pnpm prepare` / husky noise on CI | Hooks not needed in the image | Docker build does not rely on husky at runtime; local `pnpm install` runs `prepare` |

---

## Related

- Backend (API, Postgres, Neo4j, Celery, MinIO): [Arash3f/family-tree-backend](https://github.com/Arash3f/family-tree-backend)
- This repository: [Arash3f/family-tree-front](https://github.com/Arash3f/family-tree-front)
