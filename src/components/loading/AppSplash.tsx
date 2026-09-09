"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { TreeLoading } from "./TreeLoading";
import styles from "./AppSplash.module.css";

type Props = {
  brand: string;
  label: string;
};

const STORAGE_KEY = "ft-splash-seen";
/** Slightly longer than CSS animation (0.8s / instant reduced). Kept short for LCP. */
const FAILSAFE_MS = 900;

/** Survives soft navigations (e.g. locale switch) without re-blocking the UI. */
let seenThisSession = false;

const emptySubscribe = () => () => {};

function hasSeenSplash() {
  if (seenThisSession) return true;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashSeen() {
  seenThisSession = true;
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Visual-only splash: never captures pointer events so header controls
 * (theme / locale) stay clickable. Unmounts after the exit animation.
 *
 * Skipped entirely when the user prefers reduced motion, so hero LCP is not
 * covered by an overlay. `useSyncExternalStore` keeps SSR/hydration aligned.
 */
export function AppSplash({ brand, label }: Props) {
  const alreadySeen = useSyncExternalStore(
    emptySubscribe,
    hasSeenSplash,
    () => false,
  );
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
  const [finished, setFinished] = useState(false);
  const gone = alreadySeen || reduceMotion || finished;

  useEffect(() => {
    if (alreadySeen || reduceMotion) {
      if (reduceMotion) markSplashSeen();
      return;
    }

    const timer = window.setTimeout(() => {
      markSplashSeen();
      setFinished(true);
    }, FAILSAFE_MS);
    return () => window.clearTimeout(timer);
  }, [alreadySeen, reduceMotion]);

  if (gone) return null;

  return (
    <div
      id="ft-splash"
      className={styles.overlay}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        markSplashSeen();
        setFinished(true);
      }}
    >
      <TreeLoading brand={brand} label={label} />
    </div>
  );
}
