"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { isFreeAccountLimitError } from "@/lib/auth/account-limits";

export function useFreeAccountNotice() {
  const t = useTranslations("feedback");
  const { showNotice, showError } = useFeedback();

  const showFreeAccountNotice = useCallback(async () => {
    await showNotice(t("freeAccountMessage"), {
      title: t("freeAccountTitle"),
    });
  }, [showNotice, t]);

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
