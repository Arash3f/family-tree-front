import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

/** Paths that must stay out of the marketing crawl (auth + private app + API proxy). */
function disallowedPaths(): string[] {
  const localeScoped = routing.locales.flatMap((locale) => [
    `/${locale}/dashboard`,
    `/${locale}/login`,
    `/${locale}/register`,
  ]);
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
