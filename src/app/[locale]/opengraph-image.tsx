import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import {
  brandOpenGraphResponse,
  OG_IMAGE_SIZE,
} from "@/lib/brand-icon";
import { routing, type AppLocale } from "@/i18n/routing";

export const alt = "Family Tree / شجره‌نامه";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function OpenGraphImage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = (
    hasLocale(routing.locales, raw) ? raw : routing.defaultLocale
  ) as AppLocale;
  const tHero = await getTranslations({ locale, namespace: "hero" });

  return brandOpenGraphResponse({
    brand: tHero("brand"),
    headline: tHero("headline"),
    dir: locale === "fa" ? "rtl" : "ltr",
  });
}
