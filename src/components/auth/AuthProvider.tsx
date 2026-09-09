"use client";

import { useEffect, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { subscribeAuthChange } from "@/lib/auth/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Bootstraps the auth store once per mount and keeps it in sync with
 * cross-tab / storage auth events. State lives in Zustand — not Context.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await useAuthStore.getState().bootstrap();
      if (cancelled) return;
    })();

    const unsubscribe = subscribeAuthChange(() => {
      void useAuthStore.getState().syncFromStorage();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return children;
}

export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      status: s.status,
      user: s.user,
      login: s.login,
      register: s.register,
      logout: s.logout,
      logoutAll: s.logoutAll,
      refreshUser: s.refreshUser,
      hasPermission: s.hasPermission,
    })),
  );
}
