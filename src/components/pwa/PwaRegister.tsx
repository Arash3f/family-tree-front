"use client";

import { useEffect } from "react";

/**
 * Registers the installable service worker once on the client.
 * Skips localhost HTTPS-less quirks are fine — modern Chrome allows SW on localhost.
 *
 * Dev builds never register it: the worker caches `/_next` chunks, and Turbopack
 * rewrites them on every compile, so a cached chunk crashes the client with
 * "module factory is not available". A worker left over from an earlier run is
 * removed along with its caches.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .then(() => ("caches" in window ? caches.keys() : []))
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {});
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
