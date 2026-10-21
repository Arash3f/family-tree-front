"use client";

import { create } from "zustand";
import {
  clearSession,
  endImpersonation,
  fetchCurrentUser,
  impersonateUser,
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
  fullname: string;
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
  /** Start acting as another user (admin only). */
  impersonate: (userId: string) => Promise<void>;
  /** Leave impersonation and come back as the admin. */
  stopImpersonating: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (partial: Partial<AuthUser>) => void;
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

  impersonate: async (userId) => {
    await impersonateUser(userId);
    const next = await fetchCurrentUser();
    set({ user: next, status: "authenticated" });
  },

  stopImpersonating: async () => {
    const restored = endImpersonation();
    if (!restored) {
      set({ user: null, status: "anonymous" });
      return;
    }
    const next = await loadUser();
    set({ user: next, status: next ? "authenticated" : "anonymous" });
    if (next) scheduleProactiveTokenRefresh();
  },

  refreshUser: async () => {
    const next = await loadUser();
    set({
      user: next,
      status: next ? "authenticated" : "anonymous",
    });
  },

  patchUser: (partial) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...partial } });
  },

  hasPermission: (permission) =>
    Boolean(get().user?.permissions?.includes(permission)),
}));
