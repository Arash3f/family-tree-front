"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { hasStoredTokens, isTokenStorageEventKey } from "@/lib/auth/storage";
import { useAuthStore } from "@/stores/auth-store";
import styles from "./AuthGuard.module.css";

type Props = {
  children: ReactNode;
};

function subscribeTokenStorage(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (isTokenStorageEventKey(event.key)) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

/**
 * Lets the shell render as soon as tokens exist, instead of blocking the whole
 * dashboard on `/auth/me`. Anonymous users still see the gate + redirect.
 */
export function AuthGuard({ children }: Props) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();
  const hasTokens = useSyncExternalStore(
    subscribeTokenStorage,
    hasStoredTokens,
    () => false,
  );

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "authenticated" || (status === "loading" && hasTokens)) {
    return children;
  }

  return (
    <div className={styles.gate} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden />
    </div>
  );
}
