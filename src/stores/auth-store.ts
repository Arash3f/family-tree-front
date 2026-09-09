"use client";

import { create } from "zustand";
import {
  clearSession,
  fetchCurrentUser,
  loginRequest,
  logoutAllRequest,
  logoutRequest,
  registerRequest,
  scheduleProactiveTokenRefresh,
} from "@/lib/auth/client";
import { hasStoredTokens } from "@/lib/auth/storage";
import type { AuthUser } from "@/lib/auth/types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type RegisterInput = {
  username: string;
  password: string;
  re_password: string;
  email?: string | null;
  phone?: string | null;
  country_code?: string | null;
};

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  bootstrap: () => Promise<void>;
  syncFromStorage: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

async function loadUser(): Promise<AuthUser | null> {
  if (!hasStoredTokens()) return null;
  try {
    return await fetchCurrentUser();
  } catch {
    clearSession();
    return null;
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: "loading",
  user: null,

  bootstrap: async () => {
    const next = await loadUser();
    set({
      user: next,
      status: next ? "authenticated" : "anonymous",
    });
    if (next) scheduleProactiveTokenRefresh();
  },

  syncFromStorage: async () => {
    if (!hasStoredTokens()) {
      set({ user: null, status: "anonymous" });
      return;
    }
    const next = await loadUser();
    set({
      user: next,
      status: next ? "authenticated" : "anonymous",
    });
  },

  login: async (username, password) => {
    await loginRequest(username, password);
    const next = await fetchCurrentUser();
    set({ user: next, status: "authenticated" });
    scheduleProactiveTokenRefresh();
  },

  register: async (input) => {
    await registerRequest(input);
    const next = await fetchCurrentUser();
    set({ user: next, status: "authenticated" });
    scheduleProactiveTokenRefresh();
  },

  logout: async () => {
    await logoutRequest();
    set({ user: null, status: "anonymous" });
  },

  logoutAll: async () => {
    await logoutAllRequest();
    set({ user: null, status: "anonymous" });
  },

  refreshUser: async () => {
    const next = await loadUser();
    set({
      user: next,
      status: next ? "authenticated" : "anonymous",
    });
  },

  hasPermission: (permission) =>
    Boolean(get().user?.permissions?.includes(permission)),
}));
