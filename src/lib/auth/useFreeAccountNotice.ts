"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useRouter } from "@/i18n/navigation";
import {
  isFreeAccountLimitError,
  UPGRADE_REQUEST_HREF,
} from "@/lib/auth/account-limits";
import { Permissions } from "@/lib/auth/types";

export function useFreeAccountNotice() {
  const t = useTranslations("feedback");
  const { showNotice, showError, confirm } = useFeedback();
  const { hasPermission } = useAuth();
  const router = useRouter();

  /**
   * Explains the free quota and, for anyone who can file a ticket, offers the
   * way past it: an upgrade request, opened with its category already chosen.
   */
  const showFreeAccountNotice = useCallback(async () => {
    const options = { title: t("freeAccountTitle") };
    if (!hasPermission(Permissions.TICKET_CREATE)) {
      await showNotice(t("freeAccountMessage"), options);
      return;
    }
    const upgrade = await confirm(t("freeAccountMessage"), {
      ...options,
      confirmLabel: t("freeAccountUpgrade"),
      cancelLabel: t("freeAccountLater"),
    });
    if (upgrade) router.push(UPGRADE_REQUEST_HREF);
  }, [confirm, hasPermission, router, showNotice, t]);

  const handleMaybeFreeLimit = useCallback(
    async (err: unknown, fallbackMessage: string) => {
      if (isFreeAccountLimitError(err)) {
        await showFreeAccountNotice();
        return true;
      }
      showError(fallbackMessage);
      return false;
    },
    [showError, showFreeAccountNotice],
  );

  return { showFreeAccountNotice, handleMaybeFreeLimit };
}
