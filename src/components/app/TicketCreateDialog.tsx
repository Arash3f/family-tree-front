"use client";

import { useCallback, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import { TicketCreateForm } from "@/components/app/TicketCreateForm";
import styles from "./TicketCreateDialog.module.css";

type Props = {
  treeId: string;
  open: boolean;
  onClose: () => void;
};

export function TicketCreateDialog({ treeId, open, onClose }: Props) {
  const t = useTranslations("tickets");
  const { showSuccess } = useFeedback();
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  const onEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap(modalRef, open, onEscape);
  useScrollLock(open);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId}>{t("createTitle")}</h2>
            <p className={styles.hint}>{t("quickCreateSupport")}</p>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label={t("cancel")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <TicketCreateForm
          lockTreeId={treeId}
          compact
          onCreated={() => {
            showSuccess(t("createSuccess"));
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
