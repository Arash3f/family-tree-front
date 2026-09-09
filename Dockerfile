# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.34.5

# Shared toolchain. Prefer npm global install; fall back to pnpm's static binary
# when registry.npmjs.org is flaky (common on some networks/proxies).
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ARG PNPM_VERSION
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=180000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000

RUN set -eu; \
    if npm install -g "pnpm@${PNPM_VERSION}"; then \
      echo "pnpm installed via npm"; \
    else \
      echo "npm registry failed — installing pnpm static binary"; \
      wget -qO /usr/local/bin/pnpm \
        "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linuxstatic-x64"; \
      chmod +x /usr/local/bin/pnpm; \
    fi; \
    pnpm --version

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Browser calls must stay same-origin (`/backend` → route handler → API_PROXY_TARGET).
# Do not bake a localhost/upstream URL into the client bundle unless you intentionally
# want cross-origin API calls (CORS + cookie/auth caveats).
ARG NEXT_PUBLIC_API_BASE_URL=/backend
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN pnpm build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_PROXY_TARGET=http://127.0.0.1:8001

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN addgroup -S nodejs \
  && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
