import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Hosts allowed to load Next.js dev assets (theme, menu, locale need client JS). */
const devAllowedOrigins = [
  "127.0.0.1",
  "localhost",
  // Phone / LAN preview over Wi-Fi (`pnpm dev --hostname 0.0.0.0`).
  "10.109.65.124",
  ...(process.env.DEV_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Avoid 308 on /backend/.../ which used to strip Authorization before the API.
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: devAllowedOrigins,
  // /backend/* is proxied by src/app/backend/[...path]/route.ts (preserves Auth,
  // does not follow upstream redirects).
};

export default withNextIntl(nextConfig);
