"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { isFreeAccount } from "@/lib/auth/account-limits";

/**
 * The credit line an export carries, or `undefined` when the viewer's plan
 * drops it. Anyone without a paid plan gets it, signed-out demo visitors
 * included.
 */
export function useExportWatermark(): string | undefined {
  const t = useTranslations("pedigree");
  const { user } = useAuth();
  return user && !isFreeAccount(user.account_type)
    ? undefined
    : t("exportWatermark");
}
