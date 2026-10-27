import { readFileSync } from "node:fs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * The release this bundle was built from — `package.json` is the single source
 * of truth, bumped together with the `vX.Y.Z` git tag, so the footer cannot
 * claim a version the build is not.
 */
const { version: appVersion } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

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
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  // Avoid 308 on /backend/.../ which used to strip Authorization before the API.
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: devAllowedOrigins,
  // The runner image drops `sharp` so @vercel/og rasterizes through resvg.wasm
  // (see Dockerfile). Without sharp the image optimizer cannot run in
  // standalone mode, and the single next/image on the landing page (the author
  // photo) is already a small local asset, so serve it as-is.
  images: { unoptimized: true },
  // /backend/* is proxied by src/app/backend/[...path]/route.ts (preserves Auth,
  // does not follow upstream redirects).
};

export default withNextIntl(nextConfig);
