"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useRouter } from "@/i18n/navigation";
import styles from "./ImpersonationBanner.module.css";

/**
 * Standing warning that the signed-in session is an admin acting as someone
 * else, with the way back out.
 *
 * The flag comes from `/auth/me` (`is_impersonating`), so it reflects the
 * token the server actually accepted rather than anything the client guessed.
 * Leaving sends nothing to the server — the impersonation token has no session
 * to close, so dropping it locally and restoring the parked admin pair is the
 * whole exit.
 */
export function ImpersonationBanner() {
  const t = useTranslations("users");
  const { user, stopImpersonating } = useAuth();
  const { showError } = useFeedback();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  if (!user?.is_impersonating) return null;

  const name = user.fullname || user.username;

  const onLeave = async () => {
    setLeaving(true);
    try {
      await stopImpersonating();
      router.replace("/dashboard/users");
    } catch {
      showError(t("impersonatingExitError"));
    } finally {
      // Always re-enable. On success this banner usually unmounts anyway, but
      // if anything leaves it on screen (a slow /auth/me, a failed refresh) a
      // button stuck in `disabled` would strand the admin as someone else
      // with no way back except reloading the page.
      setLeaving(false);
    }
  };

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <HiOutlineExclamationTriangle className={styles.icon} aria-hidden />
      <p className={styles.text}>{t("impersonating", { name })}</p>
      <button
        type="button"
        className={styles.exitBtn}
        disabled={leaving}
        onClick={() => void onLeave()}
      >
        {t("impersonatingExit")}
      </button>
    </div>
  );
}
