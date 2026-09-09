"use client";

import { create } from "zustand";

export type ToastTone = "error" | "success" | "info";

export type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export type NoticeOptions = {
  title?: string;
  confirmLabel?: string;
};

export type ConfirmState = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  mode: "confirm" | "notice";
  resolve: (value: boolean) => void;
};

export type ToastItem = {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
  leaving?: boolean;
};

type FeedbackState = {
  confirmDialog: ConfirmState | null;
  toasts: ToastItem[];
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  showNotice: (message: string, options?: NoticeOptions) => Promise<void>;
  clear: () => void;
  settleConfirm: (value: boolean) => void;
  removeToast: (id: number) => void;
};

const TOAST_DURATION_MS = 4200;
const TOAST_EXIT_MS = 180;

const toastTimers = new Map<number, number>();
let toastIdSeq = 0;

function clearToastTimers() {
  for (const timer of toastTimers.values()) {
    window.clearTimeout(timer);
  }
  toastTimers.clear();
}

function scheduleToastRemoval(id: number) {
  const timer = window.setTimeout(() => {
    useFeedbackStore.getState().removeToast(id);
  }, TOAST_DURATION_MS);
  toastTimers.set(id, timer);
}

export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  confirmDialog: null,
  toasts: [],

  showError: (message, title) => {
    const id = ++toastIdSeq;
    set((state) => ({
      toasts: [...state.toasts, { id, tone: "error", message, title }],
    }));
    scheduleToastRemoval(id);
  },

  showSuccess: (message, title) => {
    const id = ++toastIdSeq;
    set((state) => ({
      toasts: [...state.toasts, { id, tone: "success", message, title }],
    }));
    scheduleToastRemoval(id);
  },

  showInfo: (message, title) => {
    const id = ++toastIdSeq;
    set((state) => ({
      toasts: [...state.toasts, { id, tone: "info", message, title }],
    }));
    scheduleToastRemoval(id);
  },

  confirm: (message, options = {}) =>
    new Promise<boolean>((resolve) => {
      const current = get().confirmDialog;
      if (current) current.resolve(false);
      set({
        confirmDialog: {
          message,
          title: options.title,
          confirmLabel: options.confirmLabel,
          cancelLabel: options.cancelLabel,
          danger: options.danger ?? true,
          mode: "confirm",
          resolve,
        },
      });
    }),

  showNotice: (message, options = {}) =>
    new Promise<void>((resolve) => {
      const current = get().confirmDialog;
      if (current) current.resolve(false);
      set({
        confirmDialog: {
          message,
          title: options.title,
          confirmLabel: options.confirmLabel,
          danger: false,
          mode: "notice",
          resolve: () => resolve(),
        },
      });
    }),

  settleConfirm: (value) => {
    const current = get().confirmDialog;
    if (current) current.resolve(value);
    set({ confirmDialog: null });
  },

  removeToast: (id) => {
    const existing = toastTimers.get(id);
    if (existing) {
      window.clearTimeout(existing);
      toastTimers.delete(id);
    }

    const target = get().toasts.find((toast) => toast.id === id);
    if (!target || target.leaving) return;

    set((state) => ({
      toasts: state.toasts.map((toast) =>
        toast.id === id ? { ...toast, leaving: true } : toast,
      ),
    }));

    const exitTimer = window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
      toastTimers.delete(id);
    }, TOAST_EXIT_MS);
    toastTimers.set(id, exitTimer);
  },

  clear: () => {
    get().settleConfirm(false);
    clearToastTimers();
    set({ toasts: [] });
  },
}));

/** Dispose timers when the feedback host unmounts (locale/layout remount). */
export function disposeFeedbackTimers() {
  clearToastTimers();
}
