"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { TreeMemberAccessPicker } from "@/components/app/TreeMemberAccessPicker";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Form, FormActions } from "@/components/ui/Form";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import { TreeAccess, normalizeTreeAccess } from "@/lib/auth/tree-access";
import styles from "./TreeMemberAccessDialog.module.css";

type AddMode = {
  mode: "add";
  onSubmit: (username: string, access: string[]) => Promise<void>;
};

type EditMode = {
  mode: "edit";
  memberLabel: string;
  initialAccess: string[];
  onSubmit: (access: string[]) => Promise<void>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
} & (AddMode | EditMode);

/**
 * Remount key so opening the dialog (or switching the edited member) starts
 * from fresh local state — avoids setState-inside-effect that ESLint rejects.
 */
function dialogInstanceKey(props: Props): string {
  if (props.mode === "add") return "add";
  return `edit:${props.memberLabel}\0${props.initialAccess.join("\0")}`;
}

export function TreeMemberAccessDialog(props: Props) {
  const { open, onClose, busy = false } = props;

  if (!open) return null;

  return (
    <TreeMemberAccessDialogOpen
      key={dialogInstanceKey(props)}
      {...props}
      onClose={onClose}
      busy={busy}
    />
  );
}

function TreeMemberAccessDialogOpen(props: Props) {
  const { onClose, busy = false } = props;
  const t = useTranslations("trees");
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState("");
  const [access, setAccess] = useState<string[]>(() =>
    props.mode === "edit"
      ? normalizeTreeAccess(props.initialAccess)
      : [TreeAccess.VIEW],
  );

  const onEscape = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useFocusTrap(modalRef, true, onEscape);
  useScrollLock(true);

  const title =
    props.mode === "add"
      ? t("addMemberTitle")
      : t("memberAccessEditTitle", { name: props.memberLabel });
  const hint =
    props.mode === "add" ? t("addMemberSupport") : t("memberAccessEditSupport");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (props.mode === "add") {
      const trimmed = username.trim();
      if (!trimmed) return;
      await props.onSubmit(trimmed, normalizeTreeAccess(access));
      return;
    }
    await props.onSubmit(normalizeTreeAccess(access));
  };

  const canSubmit =
    props.mode === "add" ? username.trim().length > 0 : access.length > 0;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
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
          <div className={styles.headerText}>
            <h2 id={titleId}>{title}</h2>
            <p className={styles.hint}>{hint}</p>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              if (!busy) onClose();
            }}
            aria-label={t("memberAccessCancel")}
            disabled={busy}
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

        <Form columns="single" onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.body}>
            {props.mode === "add" ? (
              <TextField
                label={t("memberUser")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={busy}
                placeholder={t("memberUsernamePlaceholder")}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            ) : null}

            <TreeMemberAccessPicker
              selected={access}
              onChange={setAccess}
              disabled={busy}
              resetKey={dialogInstanceKey(props)}
            />
          </div>

          <FormActions
            secondary={
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onClose}
              >
                {t("memberAccessCancel")}
              </Button>
            }
          >
            <Button
              type="submit"
              loading={busy}
              disabled={busy || !canSubmit}
            >
              {busy
                ? t("working")
                : props.mode === "add"
                  ? t("memberAdd")
                  : t("memberAccessSave")}
            </Button>
          </FormActions>
        </Form>
      </div>
    </div>
  );
}
