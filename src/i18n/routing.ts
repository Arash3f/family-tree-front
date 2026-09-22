import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fa"],
  defaultLocale: "en",
  localePrefix: "always",
  // Pages declare hreflang themselves (`languageAlternates`, sitemap). The
  // middleware's `Link` header pointed x-default at `/` instead and contradicted them.
  alternateLinks: false,
});

export type AppLocale = (typeof routing.locales)[number];
