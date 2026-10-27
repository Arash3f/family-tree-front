import { getTranslations } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { brandOpenGraphResponse } from "@/lib/brand-icon";
import { getGuide } from "@/lib/guides";

// Rendered per request, never at build: the Docker build stage still carries
// sharp, whose binary there cannot rasterize SVG (see the runner's Dockerfile
// note), while the runtime image renders through resvg.wasm. A plain route,
// not the opengraph-image convention, so the URL has no generated suffix and
// the Article JSON-LD can name it.
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ locale: string; slug: string }>;
};

/** The guide's title on the brand card, in its own language and direction. */
export async function GET(_request: Request, { params }: Context) {
  const { locale, slug } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    return new Response(null, { status: 404 });
  }
  const guide = await getGuide(locale as AppLocale, slug);
  if (!guide) return new Response(null, { status: 404 });
  const tHero = await getTranslations({ locale, namespace: "hero" });

  return brandOpenGraphResponse({
    brand: tHero("brand"),
    headline: guide.title,
    dir: locale === "fa" ? "rtl" : "ltr",
  });
}
