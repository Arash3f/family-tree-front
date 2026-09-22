import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Paths that must stay out of the marketing crawl (private app + API proxy).
 * Login/register are left crawlable on purpose: they carry `noindex`, and a
 * crawler blocked here would never read it and could still index the bare URL.
 */
function disallowedPaths(): string[] {
  const localeScoped = routing.locales.map((locale) => `/${locale}/dashboard`);
  return [...localeScoped, "/backend/"];
}

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: disallowedPaths(),
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
