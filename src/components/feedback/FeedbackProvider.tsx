"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import {
  disposeFeedbackTimers,
  useFeedbackStore,
} from "@/stores/feedback-store";
import dialogStyles from "./FeedbackDialog.module.css";
import toastStyles from "./FeedbackToast.module.css";

/**
 * Renders toast / confirm UI. Imperative APIs live in the Zustand store so
 * callers that only fire feedback do not re-render when toasts open/close.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  useEffect(() => () => disposeFeedbackTimers(), []);

  return (
    <>
      {children}
      <FeedbackHost />
    </>
  );
}

function FeedbackHost() {
  const t = useTranslations("feedback");
  const titleId = useId();
  const messageId = useId();
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  const confirmDialog = useFeedbackStore((s) => s.confirmDialog);
  const toasts = useFeedbackStore((s) => s.toasts);
  const settleConfirm = useFeedbackStore((s) => s.settleConfirm);
  const removeToast = useFeedbackStore((s) => s.removeToast);

  useEffect(() => {
    if (!confirmDialog) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        settleConfirm(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryBtnRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmDialog, settleConfirm]);

  const confirmTitle =
    confirmDialog?.title ??
    (confirmDialog?.mode === "notice" ? t("infoTitle") : t("confirmTitle"));
  const confirmToneClass = confirmDialog?.danger
    ? dialogStyles.danger
    : dialogStyles.info;
  const isNotice = confirmDialog?.mode === "notice";

  return (
    <>
      {toasts.length > 0 ? (
        <div className={toastStyles.stack} aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => {
            const toastTitle =
              toast.title ??
              (toast.tone === "error"
                ? t("errorTitle")
                : toast.tone === "success"
                  ? t("successTitle")
                  : t("infoTitle"));

            return (
              <div
                key={toast.id}
                className={`${toastStyles.toast} ${toastStyles[toast.tone]}${
                  toast.leaving ? ` ${toastStyles.leaving}` : ""
                }`}
                role={toast.tone === "error" ? "alert" : "status"}
              >
                <div className={toastStyles.body}>
                  <p className={toastStyles.title}>{toastTitle}</p>
                  <p className={toastStyles.message}>{toast.message}</p>
                </div>
                <button
                  type="button"
                  className={toastStyles.dismiss}
                  aria-label={t("close")}
                  onClick={() => removeToast(toast.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {confirmDialog ? (
        <div className={dialogStyles.root} role="presentation">
          <button
            type="button"
            className={dialogStyles.backdrop}
            aria-label={t("close")}
            onClick={() => settleConfirm(false)}
          />
          <div
            className={`${dialogStyles.dialog} ${confirmToneClass}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
          >
            <h2 id={titleId} className={dialogStyles.title}>
              {confirmTitle}
            </h2>
            <p id={messageId} className={dialogStyles.message}>
              {confirmDialog.message}
            </p>
            <div className={dialogStyles.actions}>
              {isNotice ? null : (
                <button
                  type="button"
                  className={dialogStyles.ghostBtn}
                  onClick={() => settleConfirm(false)}
                >
                  {confirmDialog.cancelLabel ?? t("cancel")}
                </button>
              )}
              <button
                ref={primaryBtnRef}
                type="button"
                className={
                  confirmDialog.danger
                    ? dialogStyles.dangerBtn
                    : dialogStyles.primaryBtn
                }
                onClick={() => settleConfirm(true)}
              >
                {confirmDialog.confirmLabel ?? (isNotice ? t("ok") : t("confirm"))}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Stable action slice — does not re-render when toasts / dialogs change. */
export function useFeedback() {
  return useFeedbackStore(
    useShallow((s) => ({
      showError: s.showError,
      showSuccess: s.showSuccess,
      showInfo: s.showInfo,
      confirm: s.confirm,
      showNotice: s.showNotice,
      clear: s.clear,
    })),
  );
}
