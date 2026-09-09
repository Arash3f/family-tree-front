"use client";

import { useEffect } from "react";

/**
 * Registers the installable service worker once on the client.
 * Skips localhost HTTPS-less quirks are fine — modern Chrome allows SW on localhost.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* install is best-effort; ignore registration failures in private mode */
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
